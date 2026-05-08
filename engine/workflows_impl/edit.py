"""Edit workflow implementation for AI-powered video editing."""

import json
from typing import Any, Dict, List, Optional
from ai_engine import AIEngine
from models.script import EditorManifest, ZoomEffect, BackgroundSettings, ZoomAnchor


class EditWorkflow:
    """Workflow for generating and refining video edit manifests via AI."""

    SYSTEM_PROMPT = """You are a professional video editor specializing in high-end SaaS product demos.
Your task is to generate a "Manifest" of edits that make videos look premium, smooth, and engaging.

CRITICAL RULES:
1. ONLY add zoom effects if the user explicitly asks for them (e.g., "add zoom", "zoom in", "focus on").
2. If user asks ONLY for background, return ONLY background settings with empty effects array.
3. Respect the user's explicit request - don't add extra effects they didn't ask for.
4. ALL JSON VALUES MUST BE NUMBERS - NEVER use expressions like "10.08 - 0.5". ALWAYS calculate to final value (9.58).
5. TIMING INTERPRETATION:
   - "at start" or "beginning" → startTime = 0.5-1.0s
   - "at end" or "final" → startTime = duration - 2.0 to duration - 1.0s
   - "middle" → startTime = duration / 2
   - "at X seconds" → startTime = X
   - For specific interactions → startTime = interaction_timestamp - 0.5s

ZOOM EFFECTS (only if requested):
   - Start zoom 0.5s BEFORE interaction timestamp (calculate: timestamp - 0.5).
   - Duration should be 1.5s to 2.0s (hold time includes the before period).
   - Use a multiplier between 1.3 and 1.6 for focus.
   - Anchor coordinates must be NORMALIZED 0-1 range (0.5, 0.5 = center). If you have pixel coords, convert them.

EXAMPLE: If user says "add zoom at start" and duration is 10.5s:
- startTime = 1.0 (near start)
- length = 1.5
- multiplier = 1.4
- anchor = { "x": 0.5, "y": 0.5 }

EXAMPLE: If interaction at timestamp 10.08s:
- startTime = 10.08 - 0.5 = 9.58 (MUST output 9.58, not the expression)
- length = 1.5 or 2.0
- multiplier = 1.4
- anchor = { "x": 0.5, "y": 0.5 }

BACKGROUND SETTINGS:
   - Only enable if user requests "background" or "frame" or similar.
   - Choose a preset that matches the vibe (e.g., 'night-1' for dark mode, 'sunset-1' for warm/creative, 'ocean-1' for clean/professional).
   - Use a padding of 60 and roundedness of 12 for a modern look.

OUTPUT FORMAT - RETURN ONLY THIS JSON, NO OTHER TEXT:
{
  "effects": [
    { "id": "zoom_1", "type": "zoom", "startTime": 1.0, "length": 1.5, "multiplier": 1.4, "anchor": { "x": 0.5, "y": 0.5 } }
  ],
  "background": {
    "enabled": true,
    "presetId": "ocean-1",
    "padding": 60,
    "roundedness": 12
  }
}

ANCHOR EXAMPLES:
- Center: { "x": 0.5, "y": 0.5 }
- Top-left: { "x": 0.0, "y": 0.0 }
- Bottom-right: { "x": 1.0, "y": 1.0 }
"""

    def _format_video_context(self, steps: List[Dict[str, Any]]) -> str:
        """Converts raw step metadata into a readable story for the AI."""
        if not steps:
            return "### VIDEO INTERACTION MAP\nNo specific interaction data available. Please suggest general professional editing enhancements."
        
        lines = ["### VIDEO INTERACTION MAP"]
        for step in steps:
            ts = step.get("timestamp", 0.0)
            action = step.get("action_taken", {})
            tool = action.get("tool_name", "unknown")
            desc = action.get("description", "Interaction")
            
            rect = step.get("element_rect")
            pos_info = ""
            if rect:
                # Calculate center point for the AI
                center_x = rect["x"] + (rect["width"] / 2)
                center_y = rect["y"] + (rect["height"] / 2)
                pos_info = f" at center ({center_x}, {center_y}) [Size: {rect['width']}x{rect['height']}]"
            
            lines.append(f"- [{ts:.2f}s] {desc} (using {tool}){pos_info}")
        
        return "\n".join(lines)

    async def execute(
        self,
        steps: List[Dict[str, Any]],
        user_prompt: str,
        current_manifest: Optional[Dict[str, Any]] = None,
        grok_api_key: str = "",
        duration: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Processes video metadata and user intent to generate an EditorManifest.
        
        Args:
            steps: List of interaction steps from the recording
            user_prompt: User's editing request (e.g., "add zoom at start")
            current_manifest: Current manifest state to update from
            grok_api_key: API key for Groq
            duration: Total video duration in seconds
        """
        engine = AIEngine(api_key=grok_api_key)
        
        video_story = self._format_video_context(steps)
        
        user_context = f"USER GOAL: {user_prompt}\n\n"
        if duration:
            user_context += f"VIDEO DURATION: {duration:.2f} seconds\n"
            user_context += f"TIMING HINTS:\n"
            user_context += f"  - 'at start' or 'beginning' → startTime around 0.5-1.0s\n"
            user_context += f"  - 'at end' or 'final' → startTime around {max(0, duration - 2):.2f}s\n"
            user_context += f"  - 'middle' → startTime around {duration / 2:.2f}s\n\n"
        
        user_context += video_story
        if current_manifest:
            user_context += f"\n\nCURRENT EDIT STATE:\n{json.dumps(current_manifest, indent=2)}"
            user_context += "\n\nPlease update the manifest based on my feedback above."
        else:
            user_context += "\n\nPlease generate a brand new manifest to make this video look premium."

        # In a real implementation, we would use tool calling or structured output.
        # For now, we'll use the prompt-based approach as discussed.
        response = await engine.get_decision(
            system_prompt=self.SYSTEM_PROMPT,
            user_prompt=user_context,
            available_tools=None # We want raw JSON output here
        )
        
        # Parse the JSON from the AI response
        content = response.content
        try:
            # Basic cleaning in case AI includes markdown blocks
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            
            manifest = json.loads(content.strip())
            
            # Post-process effects to ensure they have proper structure
            if "effects" in manifest and isinstance(manifest["effects"], list):
                processed_effects = []
                for idx, effect in enumerate(manifest["effects"]):
                    if not isinstance(effect, dict):
                        continue
                    
                    # Ensure effect has required fields with validated constraints
                    multiplier = float(effect.get("multiplier", 1.4))
                    # Clamp multiplier to 1.3-1.6 range
                    multiplier = max(1.3, min(1.6, multiplier))
                    
                    processed_effect = {
                        "id": effect.get("id", f"zoom_{idx}"),
                        "type": effect.get("type", "zoom"),
                        "startTime": float(effect.get("startTime", 0)),
                        "length": float(effect.get("length", 1.5)),
                        "multiplier": multiplier,
                        "anchor": effect.get("anchor", {"x": 0.5, "y": 0.5})
                    }
                    
                    # Normalize anchor to 0-1 range if it's in pixel coords
                    anchor = processed_effect["anchor"]
                    if isinstance(anchor, dict):
                        x = anchor.get("x", 0.5)
                        y = anchor.get("y", 0.5)
                        # If coordinates are > 1, assume they're pixels and skip normalization
                        # Otherwise treat as normalized already
                        processed_effect["anchor"] = {
                            "x": max(0, min(1, float(x))) if float(x) <= 1 else 0.5,
                            "y": max(0, min(1, float(y))) if float(y) <= 1 else 0.5,
                        }
                    
                    processed_effects.append(processed_effect)
                
                manifest["effects"] = processed_effects
            
            # Ensure background has proper structure with validated constraints
            if "background" not in manifest:
                manifest["background"] = {
                    "enabled": False,
                    "presetId": "ocean-1",
                    "padding": 60,
                    "roundedness": 12
                }
            else:
                bg = manifest["background"]
                # Validate and clamp padding (0-200)
                if "padding" in bg:
                    bg["padding"] = max(0, min(200, int(bg["padding"])))
                else:
                    bg["padding"] = 60
                
                # Validate and clamp roundedness (0-30)
                if "roundedness" in bg:
                    bg["roundedness"] = max(0, min(30, int(bg["roundedness"])))
                else:
                    bg["roundedness"] = 12
            
            return manifest
        except Exception as e:
            print(f"Failed to parse AI manifest: {e}")
            print(f"Response content: {content[:200]}")
            # Return the last known manifest if available, otherwise propagate error
            if current_manifest:
                return current_manifest
            # Propagate error for the endpoint to handle
            raise ValueError(f"AI manifest parsing failed: {str(e)}") from e
