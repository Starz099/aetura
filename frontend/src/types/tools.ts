import type { ReactNode } from "react";

export interface ToolStrategy {
  id: string;
  name: string;
  description: string;
  icon?: string;
  renderPanel: () => ReactNode;
  onActivate?: () => void;
  onDeactivate?: () => void;
}

export interface BackgroundPreset {
  id: string;
  label: string;
  imageUrl: string;
}
