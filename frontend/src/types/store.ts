import type { EditorClip, EditorEffect, EditorBackgroundSettings, ZoomAnchor, EditorManifest } from "./editor";
import type { Step } from "./api";
import type { ExportRequest, ExportSettings } from "./export";

// Timeline Slice
export interface TimelineState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  sourceDuration: number;
  sourceUrl: string | null;
  clips: EditorClip[];
  selectedClipId: string | null;
  enrichedSteps: Step[];
}

export interface TimelineActions {
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  initializeTimeline: (sourceUrl: string, duration: number) => void;
  setEnrichedSteps: (steps: Step[]) => void;
  seekTo: (time: number) => void;
  jumpBy: (delta: number) => void;
  togglePlay: () => void;
  resetTimeline: () => void;
  selectClip: (clipId: string | null) => void;
  cutSelectedClipAtCurrentTime: () => boolean;
  trimClipStart: (clipId: string, nextSourceStart: number) => void;
  trimClipEnd: (clipId: string, nextSourceEnd: number) => void;
}

export type TimelineSlice = TimelineState & TimelineActions;

// Effect Slice
export interface EffectState {
  effects: EditorEffect[];
  selectedEffectId: string | null;
  backgroundSettings: EditorBackgroundSettings;
}

export interface EffectActions {
  addZoomEffect: () => string;
  updateEffect: (
    effectId: string,
    updates: Partial<Omit<EditorEffect, "id" | "type">>,
  ) => void;
  removeEffect: (effectId: string) => void;
  selectEffect: (effectId: string | null) => void;
  updateBackgroundSettings: (
    updates: Partial<EditorBackgroundSettings>,
  ) => void;
  resetBackgroundSettings: () => void;
  applyManifest: (manifest: EditorManifest) => void;
  clampEffect: (
    effect: Omit<EditorEffect, "anchor"> & { anchor?: Partial<ZoomAnchor> | null },
    duration: number,
  ) => EditorEffect;
}

export type EffectSlice = EffectState & EffectActions;

// Export Slice
export interface ExportSlice {
  buildExportRequest: (
    source: string,
    clips: EditorClip[],
    duration: number,
    effects: EditorEffect[],
    background: EditorBackgroundSettings,
    settings?: Partial<ExportSettings>,
  ) => ExportRequest;
}

// Combined State
export type EditorState = TimelineSlice & EffectSlice & ExportSlice;
