import type { EditorBackgroundSettings, EditorEffectType, ZoomAnchor } from "./editor";

export type ExportDestination = "file";
export type ExportFormat = "mp4" | "gif";
export type ExportResolution = "720p" | "1080p" | "4k";
export type ExportFps = 15 | 30 | 60;

export interface ExportEffect {
  type: EditorEffectType;
  startTime: number;
  length: number;
  multiplier: number;
  anchor: ZoomAnchor;
}

export interface ExportSettings {
  destination: ExportDestination;
  format: ExportFormat;
  resolution: ExportResolution;
  fps: ExportFps;
  optimizeFileSize: boolean;
}

export interface ExportSegment {
  sourceUrl: string;
  inPoint: number;
  outPoint: number;
  startOnTimeline: number;
}

export interface ExportRequest {
  segments: ExportSegment[];
  duration: number;
  effects: ExportEffect[];
  background: EditorBackgroundSettings;
  destination: ExportDestination;
  format: ExportFormat;
  resolution: ExportResolution;
  fps: ExportFps;
  optimizeFileSize: boolean;
}

export interface ExportResult {
  output_path: string;
}

export interface ExportServiceResult {
  status: ExportStatus;
  message: string;
  progressPercent?: number;
  outputPath?: string;
}

export type ExportStatus =
  | "idle"
  | "running"
  | "success"
  | "error"
  | "cancelled";

export type ExportEventKind =
  | "started"
  | "progress"
  | "completed"
  | "failed"
  | "cancelled";

export interface ExportStatusEvent {
  kind: ExportEventKind;
  progressPercent?: number;
  message?: string;
  outputPath?: string;
}

export interface ExportState {
  status: ExportStatus;
  message: string;
  progressPercent: number;
  stage?: ExportStatusEvent["kind"];
  outputPath?: string;
}
