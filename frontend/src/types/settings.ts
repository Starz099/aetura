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

export interface RecordingSettings {
  captureFps: 15 | 30 | 60;
  viewportWidth: number;
  viewportHeight: number;
  recordAudio: boolean;
  outputPreset: RecordingPreset;
}
