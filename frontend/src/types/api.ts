/**
 * Type definitions for API contracts.
 */

export interface DOMElement {
  element_id: number;
  element_type: string;
  text: string;
  href?: string;
}

export interface Action {
  tool_name: string;
  arguments: Record<string, unknown>;
  description: string;
}

export interface Step {
  step_number: number;
  current_url: string;
  action_taken: Action;
  available_elements: DOMElement[];
}

export interface DemoScript {
  goal: string;
  starting_url: string;
  steps: Step[];
}

export interface VideoRecord {
  filename: string;
  absolute_path: string;
  video_url: string;
  created_at: number;
}

// Request types
export interface DraftScriptRequest {
  url: string;
  intent: string;
  grok_api_key: string;
}

export interface ResumeScriptRequest {
  url: string;
  intent: string;
  approved_steps: Step[];
  grok_api_key: string;
}

export type RecordingPreset =
  | "ultrafast"
  | "superfast"
  | "veryfast"
  | "faster"
  | "fast"
  | "medium"
  | "slow"
  | "slower"
  | "veryslow";

export interface RecordingSettingsRequest {
  capture_fps?: 15 | 30 | 60;
  viewport_width?: number;
  viewport_height?: number;
  record_audio?: boolean;
  output_preset?: RecordingPreset;
}

export interface RecordVideoRequest {
  url: string;
  approved_steps: Step[];
  recording_settings?: RecordingSettingsRequest;
}

// Response types
export interface ExploreResponse {
  agent_message?: DemoScript;
  [key: string]: unknown; // Fallback for other response formats
}

export interface RecordResponse {
  status: "success" | "error";
  video_url?: string;
  message?: string;
}

export interface LibraryResponse {
  videos: VideoRecord[];
}

// Error types
export class APIError extends Error {
  public statusCode: number;
  public code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = "APIError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface APIErrorResponse {
  error: string;
  error_code?: string;
  message?: string;
}
