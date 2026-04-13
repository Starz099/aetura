"""
Workflow abstraction - base class and implementations for automation workflows.
"""
import asyncio
import json
import os
import shutil
import subprocess
import base64
from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any

from browser_engine import BrowserEngine
from ai_engine import AIEngine
from models.script import DemoScript, Step, Action, DOMElement
from tools.manager import AGENT_TOOLS, execute_tool
from tools.dom_extractor import extract_clean_dom
from dom.parser import parse_dom_state
from prompts import WorkflowPrompts


class MockFunction:
    """Mock tool function for creating tool call objects."""
    def __init__(self, name: str, arguments: Dict[str, Any]):
        self.name = name
        self.arguments = json.dumps(arguments)


class MockToolCall:
    """Mock tool call for replaying recorded actions."""
    def __init__(self, name: str, arguments: Dict[str, Any]):
        self.function = MockFunction(name, arguments)


class Workflow(ABC):
    """Abstract base class for automation workflows."""
    
    def __init__(self, grok_api_key: Optional[str] = None):
        """
        Initialize workflow.
        
        Args:
            grok_api_key: API key for Groq/OpenAI (required for AI-driven workflows)
        """
        self.grok_api_key = grok_api_key
        self.browser: Optional[BrowserEngine] = None
        self.ai: Optional[AIEngine] = None
        self.page: Optional[Any] = None
    
    async def initialize(self) -> None:
        """Initialize browser and AI engines."""
        self.browser = BrowserEngine()
        if self.grok_api_key:
            self.ai = AIEngine(self.grok_api_key)
    
    async def cleanup(self) -> None:
        """Clean up resources."""
        if self.browser:
            await self.browser.stop()
            self.browser = None
        self.page = None
    
    @abstractmethod
    async def execute(self, *args, **kwargs) -> dict:
        """Execute the workflow. Must be implemented by subclasses."""
        pass
    
    async def _start_page(self, url: str, headless: bool = False) -> None:
        """Start browser page and navigate to URL."""
        assert self.browser is not None, "Browser not initialized"
        self.page = await self.browser.start(headless=headless)
        await self.page.goto(url)
        await self.page.wait_for_load_state("networkidle")
        await asyncio.sleep(1)
    
    async def _get_dom_state(self) -> str:
        """Get current DOM state."""
        assert self.page is not None, "Page not initialized"
        return await extract_clean_dom(self.page)
    
    async def _extract_and_parse_dom(self) -> tuple[str, List[DOMElement]]:
        """Extract and parse DOM from page."""
        dom_state = await self._get_dom_state()
        parsed_dom = parse_dom_state(dom_state)
        return dom_state, parsed_dom
    
    async def _get_ai_decision(self, system_prompt: str, user_prompt: str) -> Any:
        """Get AI decision on next action."""
        assert self.ai is not None, "AI engine not initialized"
        return await self.ai.get_decision(system_prompt, user_prompt, AGENT_TOOLS)
    
    async def _execute_tool_call(self, tool_call: Any) -> str:
        """Execute a tool call and return result."""
        assert self.page is not None, "Page not initialized"
        return await execute_tool(tool_call, self.page)
    
    async def _replay_approved_steps(self, steps: List[Dict[str, Any]]) -> tuple[int, str, List[Step]]:
        """
        Replay approved steps and return step count, memory, and script steps.
        
        Args:
            steps: List of approved steps to replay
            
        Returns:
            Tuple of (step_count, memory, script_steps)
        """
        step_count = 0
        memory = ""
        script_steps = []
        
        print(f"\n[Replaying {len(steps)} approved steps...]")
        for step_data in steps:
            step_count += 1
            print(f"Replaying Step {step_count}...")
            
            _, parsed_dom = await self._extract_and_parse_dom()
            
            action_name = step_data["action_taken"]["tool_name"]
            action_args = step_data["action_taken"]["arguments"]
            
            mock_call = MockToolCall(action_name, action_args)
            action_result = await self._execute_tool_call(mock_call)
            
            script_steps.append(Step(**step_data))
            memory += f"\n- Tool '{action_name}' returned: {action_result}\n"
            
            assert self.page is not None
            await self.page.wait_for_load_state("networkidle")
            await asyncio.sleep(1)
        
        return step_count, memory, script_steps


class DraftWorkflow(Workflow):
    """Workflow for drafting new automation scripts from scratch."""
    
    async def execute(self, url: str, intent: str, grok_api_key: str) -> dict:
        """
        Draft a new automation script.
        
        Args:
            url: Starting URL
            intent: User's goal/task description
            grok_api_key: Groq API key
            
        Returns:
            DemoScript as dictionary
        """
        self.grok_api_key = grok_api_key
        await self.initialize()
        
        try:
            await self._start_page(url, headless=False)
            
            max_steps = 20
            step_count = 0
            memory = ""
            script_steps = []
            
            while step_count < max_steps:
                step_count += 1
                print(f"\n--- Step {step_count} ---")
                
                dom_state, parsed_dom = await self._extract_and_parse_dom()
                system_prompt, user_prompt = WorkflowPrompts.get_draft_prompt(intent)
                
                user_prompt += f"\n\nCurrent URL: {self.page.url}\n"
                user_prompt += f"--- MEMORY LOG ---\n{memory if memory else 'No previous actions.'}\n"
                user_prompt += f"--- CURRENT WEBPAGE ---\n{dom_state}\n"
                
                try:
                    ai_response = await self._get_ai_decision(system_prompt, user_prompt)
                except Exception as e:
                    print(f"API Error: {str(e)}")
                    memory += f"\n- SYSTEM ERROR: Invalid response. Retrying.\n"
                    await asyncio.sleep(1)
                    continue
                
                if ai_response.tool_calls:
                    tool_call = ai_response.tool_calls[0]
                    action_result = await self._execute_tool_call(tool_call)
                    print(f"Action Result: {action_result}")
                    
                    try:
                        args = json.loads(tool_call.function.arguments)
                    except:
                        args = {}
                    
                    action = Action(
                        tool_name=tool_call.function.name,
                        arguments=args,
                        description=f"Used {tool_call.function.name}"
                    )
                    
                    step = Step(
                        step_number=step_count,
                        current_url=self.page.url,
                        action_taken=action,
                        available_elements=parsed_dom
                    )
                    script_steps.append(step)
                    memory += f"\n- Tool '{tool_call.function.name}' returned: {action_result}\n"
                    
                    if "FINISHED:" in action_result:
                        print("\nWorkflow completed successfully.")
                        break
                    
                    await self.page.wait_for_load_state("networkidle")
                    await asyncio.sleep(1)
                else:
                    print("\nWorkflow completed (no tools used).")
                    break
            
            await asyncio.sleep(2)
            
            script = DemoScript(goal=intent, starting_url=url, steps=script_steps)
            return script.model_dump()
        
        finally:
            await self.cleanup()


class ResumeWorkflow(Workflow):
    """Workflow for resuming interrupted automation scripts."""
    
    async def execute(self, url: str, intent: str, approved_steps: List[Dict[str, Any]], grok_api_key: str) -> dict:
        """
        Resume an automation script from approved steps.
        
        Args:
            url: Starting URL
            intent: User's goal/task description
            approved_steps: Previously approved steps to replay
            grok_api_key: Groq API key
            
        Returns:
            DemoScript as dictionary
        """
        self.grok_api_key = grok_api_key
        await self.initialize()
        
        try:
            await self._start_page(url, headless=False)
            
            # Replay approved steps
            step_count, memory, script_steps = await self._replay_approved_steps(approved_steps)
            
            # Let AI continue from here
            max_steps = 15
            print("\n[AI taking over for remaining steps...]")
            
            while step_count < max_steps:
                step_count += 1
                print(f"\n--- Step {step_count} (AI) ---")
                
                dom_state, parsed_dom = await self._extract_and_parse_dom()
                system_prompt, user_prompt = WorkflowPrompts.get_resume_prompt(intent, "Previous steps completed")
                
                user_prompt += f"\n\nCurrent URL: {self.page.url}\n"
                user_prompt += f"--- MEMORY LOG ---\n{memory if memory else 'No actions yet.'}\n"
                user_prompt += f"--- CURRENT WEBPAGE ---\n{dom_state}\n"
                
                try:
                    ai_response = await self._get_ai_decision(system_prompt, user_prompt)
                except Exception as e:
                    print(f"API Error: {str(e)}")
                    memory += f"\n- SYSTEM ERROR: Retrying.\n"
                    await asyncio.sleep(1)
                    continue
                
                if ai_response.tool_calls:
                    tool_call = ai_response.tool_calls[0]
                    action_result = await self._execute_tool_call(tool_call)
                    
                    try:
                        args = json.loads(tool_call.function.arguments)
                    except:
                        args = {}
                    
                    action = Action(
                        tool_name=tool_call.function.name,
                        arguments=args,
                        description=f"Used {tool_call.function.name}"
                    )
                    
                    step = Step(
                        step_number=step_count,
                        current_url=self.page.url,
                        action_taken=action,
                        available_elements=parsed_dom
                    )
                    script_steps.append(step)
                    memory += f"\n- Tool '{tool_call.function.name}' returned: {action_result}\n"
                    
                    if "FINISHED:" in action_result:
                        break
                    
                    await self.page.wait_for_load_state("networkidle")
                    await asyncio.sleep(1)
                else:
                    break
            
            await asyncio.sleep(2)
            
            script = DemoScript(goal=intent, starting_url=url, steps=script_steps)
            return script.model_dump()
        
        finally:
            await self.cleanup()


class RecordWorkflow(Workflow):
    """Workflow for recording demo videos of automation scripts."""
    
    async def execute(self, url: str, approved_steps: List[Dict[str, Any]]) -> str:
        """
        Record a video of automation steps.
        
        Args:
            url: Starting URL
            approved_steps: Steps to record
            
        Returns:
            Path to recorded video file
        """
        # Note: This workflow doesn't need AI, so we don't initialize it
        os.makedirs("recordings", exist_ok=True)
        frames_dir = os.path.abspath("temp_frames")
        
        if os.path.exists(frames_dir):
            shutil.rmtree(frames_dir)
        os.makedirs(frames_dir)
        
        video_path = os.path.abspath(
            f"recordings/demo_{int(asyncio.get_event_loop().time())}.mp4"
        )
        
        # Use direct Playwright async context instead of BrowserEngine
        # to access CDP session for frame capture
        from playwright.async_api import async_playwright
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=False)
            
            context = await browser.new_context(
                viewport={"width": 1920, "height": 1080},
                device_scale_factor=3
            )
            self.page = await context.new_page()
            
            client = await context.new_cdp_session(self.page)
            frame_counter = {"count": 0}
            
            async def handle_frame(event):
                frame_counter["count"] += 1
                data = event.get("data")
                session_id = event.get("sessionId")
                
                with open(
                    os.path.join(frames_dir, f"frame_{frame_counter['count']:05d}.jpg"),
                    "wb"
                ) as f:
                    f.write(base64.b64decode(data))
                
                await client.send("Page.screencastFrameAck", {"sessionId": session_id})
            
            client.on("Page.screencastFrame", handle_frame)
            
            # Navigate and start capture
            print(f"Recording: Navigating to {url}")
            await self.page.goto(url)
            await self.page.wait_for_load_state("networkidle")
            
            print("Starting frame capture...")
            await client.send(
                "Page.startScreencast",
                {"format": "jpeg", "quality": 100, "everyNthFrame": 1}
            )
            
            # Replay steps with cursor visualization
            step_count = 0
            for step_data in approved_steps:
                step_count += 1
                print(f"Recording Step {step_count}...")
                
                await self._get_dom_state()  # For DOM state tracking
                
                action_name = step_data["action_taken"]["tool_name"]
                action_args = step_data["action_taken"]["arguments"]
                
                # Show cursor movement for UI interactions
                if action_name in ["click_element", "hover_element"] and "element_id" in action_args:
                    el_id = action_args["element_id"]
                    box = await self.page.evaluate(f'''
                        () => {{
                            const el = document.querySelector('[data-aetura-id="{el_id}"]');
                            if (!el) return null;
                            const rect = el.getBoundingClientRect();
                            return {{ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }};
                        }}
                    ''')
                    
                    if box:
                        await self.page.evaluate(f"""
                            () => {{
                                let cursor = document.getElementById('aetura-cursor');
                                if (!cursor) {{
                                    cursor = document.createElement('div');
                                    cursor.id = 'aetura-cursor';
                                    cursor.style.width = '24px';
                                    cursor.style.height = '24px';
                                    cursor.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
                                    cursor.style.border = '2px solid white';
                                    cursor.style.borderRadius = '50%';
                                    cursor.style.position = 'fixed';
                                    cursor.style.pointerEvents = 'none';
                                    cursor.style.zIndex = '999999';
                                    cursor.style.transition = 'top 0.5s ease-out, left 0.5s ease-out';
                                    cursor.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
                                    document.body.appendChild(cursor);
                                }}
                                cursor.style.left = '{box["x"]}px';
                                cursor.style.top = '{box["y"]}px';
                            }}
                        """)
                        await asyncio.sleep(0.6)
                
                # Execute action
                mock_call = MockToolCall(action_name, action_args)
                await self._execute_tool_call(mock_call)
                
                await self.page.wait_for_load_state("load")
                await asyncio.sleep(1)
            
            # Stop capture and close browser
            print("Stopping capture...")
            await client.send("Page.stopScreencast")
            await context.close()
            await browser.close()
        
        # Stitch frames into video
        print("Encoding video...")
        ffmpeg_cmd = [
            "ffmpeg", "-y", "-framerate", "30",
            "-i", os.path.join(frames_dir, "frame_%05d.jpg"),
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-profile:v", "main", "-movflags", "+faststart",
            "-crf", "12", video_path
        ]
        subprocess.run(ffmpeg_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        # Cleanup
        shutil.rmtree(frames_dir)
        print(f"Video saved: {video_path}")
        
        return video_path
