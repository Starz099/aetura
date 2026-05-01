import { ZoomToolPanel } from "@/components/editor/tools/zoom";
import { BackgroundToolPanel } from "@/components/editor/tools/background";
import type { ToolStrategy } from "@/types/tools";

export const TOOL_STRATEGIES: Record<string, ToolStrategy> = {
  zoom: {
    id: "zoom",
    name: "Zoom",
    description: "Apply zoom effects to the timeline.",
    renderPanel: () => <ZoomToolPanel />,
  },
  background: {
    id: "background",
    name: "Background",
    description: "Customize the video background.",
    renderPanel: () => <BackgroundToolPanel />,
  },
};

export const getToolStrategy = (id: string): ToolStrategy | null => {
  return TOOL_STRATEGIES[id] || null;
};
