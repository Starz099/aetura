import { useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Textarea,
} from "@/components/ui";
import { useEditorStore } from "@/store/useEditorStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { apiClient } from "@/services/api";

export function AIEditorChat() {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const enrichedSteps = useEditorStore((state) => state.enrichedSteps);
  const effects = useEditorStore((state) => state.effects);
  const backgroundSettings = useEditorStore((state) => state.backgroundSettings);
  const duration = useEditorStore((state) => state.duration);
  const applyManifest = useEditorStore((state) => state.applyManifest);
  // const selectEffect = useEditorStore((state) => state.selectEffect);
  
  const grokApiKeys = useSettingsStore((state) => state.grokApiKeys);

  const handleSend = async () => {
    if (!prompt.trim() || isLoading) return;
    
    if (grokApiKeys.length === 0) {
      alert("Please add a Grok API key in settings.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiClient.editVideo({
        steps: enrichedSteps,
        intent: prompt,
        current_manifest: {
          effects: effects,
          background: backgroundSettings,
        },
        grok_api_key: grokApiKeys[0],
        duration: duration,
      });

      if (response.status === "success" && response.manifest) {
        applyManifest(response.manifest);
        setPrompt(""); // Clear prompt on success
      } else if (response.status === "error") {
        throw new Error(response.message || "AI failed to generate manifest");
      }
    } catch (error) {
      console.error("AI Chat failed:", error);
      alert(error instanceof Error ? error.message : "AI Chat failed. Check console for details.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="min-h-0 flex-1 relative flex flex-col">
      <CardHeader className="pb-1">
        <CardTitle>AI Chat</CardTitle>
        <CardDescription>
          Assistant controls for editing.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 min-h-0 flex-col gap-2">
        <div className="min-h-16 flex-1 rounded-md border border-border/80 bg-muted/35 p-2 text-xs text-muted-foreground shadow-[0_2px_0_var(--shadow-soft)] overflow-y-auto">
          {enrichedSteps.length > 0 
            ? `Ready to edit! (${enrichedSteps.length} interaction points detected).`
            : "Tell the AI what edits you want. It will analyze the video and apply effects."
          }
        </div>
        <Textarea
          placeholder="e.g., 'Make it look premium with zoom effects' or 'Add a professional background'"
          className="min-h-20 resize-none text-xs"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={isLoading}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button 
          className="self-end" 
          onClick={handleSend}
          disabled={isLoading || !prompt.trim()}
        >
          {isLoading ? "Thinking..." : "Send"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default AIEditorChat;
