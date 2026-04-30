import { create } from "zustand";

import {
  buildSingleClipTimeline,
  findClipAtTimelineTime,
  getSourceDuration,
  getTimelineDuration,
  MIN_CLIP_DURATION,
  MIN_EFFECT_LENGTH,
  rebuildTimeline,
  type EditorClip,
} from "@/lib/editorTimeline";

export type EditorEffectType = "zoom";

export interface ZoomAnchor {
  x: number;
  y: number;
}

export interface EditorEffect {
  id: string;
  type: EditorEffectType;
  startTime: number;
  length: number;
  multiplier: number;
  anchor: ZoomAnchor;
}

export interface ExportEffect {
  type: EditorEffectType;
  startTime: number;
  length: number;
  multiplier: number;
  anchor: ZoomAnchor;
}

export interface EditorBackgroundSettings {
  enabled: boolean;
  presetId: string;
  padding: number;
  roundedness: number;
}

export type ExportDestination = "file";
export type ExportFormat = "mp4" | "gif";
export type ExportResolution = "720p" | "1080p" | "4k";
export type ExportFps = 15 | 30 | 60;

export interface ExportSettings {
  destination: ExportDestination;
  format: ExportFormat;
  resolution: ExportResolution;
  fps: ExportFps;
  optimizeFileSize: boolean;
}

export interface ExportRequest {
  segments: Array<{
    sourceUrl: string;
    inPoint: number;
    outPoint: number;
    startOnTimeline: number;
  }>;
  duration: number;
  effects: ExportEffect[];
  background: EditorBackgroundSettings;
  destination: ExportDestination;
  format: ExportFormat;
  resolution: ExportResolution;
  fps: ExportFps;
  optimizeFileSize: boolean;
}

const defaultExportSettings: ExportSettings = {
  destination: "file",
  format: "mp4",
  resolution: "1080p",
  fps: 60,
  optimizeFileSize: false,
};

export const DEFAULT_ZOOM_LENGTH = 3;
export const DEFAULT_ZOOM_MULTIPLIER = 1.25;
export const DEFAULT_ZOOM_ANCHOR: ZoomAnchor = {
  x: 0.5,
  y: 0.5,
};
export const DEFAULT_BACKGROUND_PRESET_ID = "aurora-1";
export const DEFAULT_BACKGROUND_PADDING = 32;
export const DEFAULT_BACKGROUND_ROUNDEDNESS = 16;
export const MAX_BACKGROUND_ROUNDEDNESS = 32;
export const MAX_BACKGROUND_PADDING = 64;
export const MIN_BACKGROUND_PADDING = 0;
export const MIN_BACKGROUND_ROUNDEDNESS = 0;

const defaultBackgroundSettings: EditorBackgroundSettings = {
  enabled: false,
  presetId: DEFAULT_BACKGROUND_PRESET_ID,
  padding: DEFAULT_BACKGROUND_PADDING,
  roundedness: DEFAULT_BACKGROUND_ROUNDEDNESS,
};

const createEffectId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `effect-${Math.random().toString(36).slice(2, 10)}`;

const createClipId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `clip-${Math.random().toString(36).slice(2, 10)}`;

interface EditorState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  sourceDuration: number;
  sourceUrl: string | null;
  clips: EditorClip[];
  effects: EditorEffect[];
  selectedEffectId: string | null;
  selectedClipId: string | null;
  backgroundSettings: EditorBackgroundSettings;

  setIsPlaying: (isPlaying: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  initializeTimeline: (sourceUrl: string, duration: number) => void;
  seekTo: (time: number) => void;
  jumpBy: (delta: number) => void;
  togglePlay: () => void;
  resetTimeline: () => void;
  addZoomEffect: () => string;
  updateEffect: (
    effectId: string,
    updates: Partial<Omit<EditorEffect, "id" | "type">>,
  ) => void;
  removeEffect: (effectId: string) => void;
  selectEffect: (effectId: string | null) => void;
  selectClip: (clipId: string | null) => void;
  cutSelectedClipAtCurrentTime: () => boolean;
  trimClipStart: (clipId: string, nextSourceStart: number) => void;
  trimClipEnd: (clipId: string, nextSourceEnd: number) => void;
  updateBackgroundSettings: (
    updates: Partial<EditorBackgroundSettings>,
  ) => void;
  resetBackgroundSettings: () => void;
}

const clampTime = (time: number, duration: number) => {
  const safeDuration = Number.isFinite(duration) ? Math.max(duration, 0) : 0;

  if (!Number.isFinite(time)) {
    return 0;
  }

  return Math.min(Math.max(time, 0), safeDuration);
};

const clampNonNegative = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(value, 0);
};

const clampAnchorValue = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0.5;
  }

  return Math.min(Math.max(value, 0), 1);
};

const normalizeZoomAnchor = (anchor?: Partial<ZoomAnchor> | null): ZoomAnchor => ({
  x: clampAnchorValue(anchor?.x ?? DEFAULT_ZOOM_ANCHOR.x),
  y: clampAnchorValue(anchor?.y ?? DEFAULT_ZOOM_ANCHOR.y),
});

type EffectDraft = Omit<EditorEffect, "anchor"> & {
  anchor?: Partial<ZoomAnchor> | null;
};

const clampPaddingValue = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), MAX_BACKGROUND_PADDING);
};

const clampRoundednessValue = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), MAX_BACKGROUND_ROUNDEDNESS);
};

const normalizeBackgroundSettings = (
  settings: EditorBackgroundSettings,
): EditorBackgroundSettings => ({
  enabled: Boolean(settings.enabled),
  presetId: settings.presetId.trim() || DEFAULT_BACKGROUND_PRESET_ID,
  padding: clampPaddingValue(settings.padding),
  roundedness: clampRoundednessValue(settings.roundedness),
});

const clampEffect = (effect: EffectDraft, duration: number): EditorEffect => {
  const safeDuration = Number.isFinite(duration) ? Math.max(duration, 0) : 0;
  let startTime = clampTime(effect.startTime, safeDuration);
  const requestedLength = Number.isFinite(effect.length)
    ? Math.max(effect.length, MIN_EFFECT_LENGTH)
    : MIN_EFFECT_LENGTH;
  const length =
    safeDuration > 0
      ? Math.min(requestedLength, safeDuration)
      : requestedLength;

  if (safeDuration > 0 && startTime + length > safeDuration) {
    startTime = Math.max(safeDuration - length, 0);
  }

  return {
    ...effect,
    startTime,
    length:
      safeDuration > 0
        ? Math.min(
            length,
            Math.max(safeDuration - startTime, MIN_EFFECT_LENGTH),
          )
        : length,
    anchor: normalizeZoomAnchor(effect.anchor),
  };
};

const createDefaultZoomEffect = (
  startTime: number,
  duration: number,
): EditorEffect => {
  const safeDuration = Number.isFinite(duration) ? Math.max(duration, 0) : 0;
  const defaultLength =
    safeDuration > 0
      ? Math.min(DEFAULT_ZOOM_LENGTH, safeDuration)
      : DEFAULT_ZOOM_LENGTH;
  const maxStart =
    safeDuration > 0 ? Math.max(safeDuration - defaultLength, 0) : 0;
  const safeStartTime = clampTime(startTime, safeDuration || startTime);
  const normalizedStart =
    safeDuration > 0 ? Math.min(safeStartTime, maxStart) : safeStartTime;

  return clampEffect(
    {
      id: createEffectId(),
      type: "zoom",
      startTime: normalizedStart,
      length: defaultLength,
      multiplier: DEFAULT_ZOOM_MULTIPLIER,
      anchor: DEFAULT_ZOOM_ANCHOR,
    },
    safeDuration,
  );
};

const buildTimelineState = (
  sourceUrl: string,
  duration: number,
  effects: EditorEffect[] = [],
) => {
  const safeDuration = clampNonNegative(duration);

  return {
    sourceUrl,
    sourceDuration: safeDuration,
    duration: safeDuration,
    currentTime: 0,
    clips: buildSingleClipTimeline(sourceUrl, safeDuration),
    effects: effects.map((effect) => clampEffect(effect, safeDuration)),
    selectedEffectId: null,
    selectedClipId: null,
  };
};

const updateEffectsForDuration = (effects: EditorEffect[], duration: number) =>
  effects.map((effect) => clampEffect(effect, duration));

const cutClipAtTime = (
  state: EditorState,
  clipId: string,
  timelineTime: number,
) => {
  const clipLocation = findClipAtTimelineTime(state.clips, timelineTime);

  if (!clipLocation || clipLocation.clip.id !== clipId) {
    return null;
  }

  const clip = clipLocation.clip;
  const clipDuration = clip.sourceEnd - clip.sourceStart;
  const localTime = clipLocation.localTime;

  if (
    localTime < MIN_CLIP_DURATION ||
    localTime > clipDuration - MIN_CLIP_DURATION
  ) {
    return null;
  }

  const leftClip: EditorClip = {
    ...clip,
    sourceEnd: clip.sourceStart + localTime,
  };

  const rightClip: EditorClip = {
    ...clip,
    id: createClipId(),
    sourceStart: clip.sourceStart + localTime,
  };

  const updatedClips = rebuildTimeline([
    ...state.clips.slice(0, clipLocation.index),
    leftClip,
    rightClip,
    ...state.clips.slice(clipLocation.index + 1),
  ]);

  const nextDuration = getTimelineDuration(updatedClips);

  return {
    clips: updatedClips,
    duration: nextDuration,
    sourceDuration: Math.max(
      state.sourceDuration,
      getSourceDuration(updatedClips),
    ),
    currentTime: timelineTime,
    selectedClipId: rightClip.id,
    effects: updateEffectsForDuration(state.effects, nextDuration),
  };
};

const trimClipStartAt = (
  state: EditorState,
  clipId: string,
  nextSourceStart: number,
) => {
  const clipIndex = state.clips.findIndex((clip) => clip.id === clipId);

  if (clipIndex < 0) {
    return null;
  }

  const clip = state.clips[clipIndex];
  const previousClip = state.clips[clipIndex - 1] ?? null;
  const minSourceStart = previousClip?.sourceEnd ?? 0;
  const maxSourceStart = clip.sourceEnd - MIN_CLIP_DURATION;
  const safeSourceStart = Math.min(
    Math.max(nextSourceStart, minSourceStart),
    maxSourceStart,
  );

  if (safeSourceStart === clip.sourceStart) {
    return null;
  }

  const updatedClips = rebuildTimeline(
    state.clips.map((currentClip) =>
      currentClip.id === clipId
        ? {
            ...currentClip,
            sourceStart: safeSourceStart,
          }
        : currentClip,
    ),
  );

  const nextDuration = getTimelineDuration(updatedClips);

  return {
    clips: updatedClips,
    duration: nextDuration,
    sourceDuration: Math.max(
      state.sourceDuration,
      getSourceDuration(updatedClips),
    ),
    effects: updateEffectsForDuration(state.effects, nextDuration),
  };
};

const trimClipEndAt = (
  state: EditorState,
  clipId: string,
  nextSourceEnd: number,
) => {
  const clipIndex = state.clips.findIndex((clip) => clip.id === clipId);

  if (clipIndex < 0) {
    return null;
  }

  const clip = state.clips[clipIndex];
  const nextClip = state.clips[clipIndex + 1] ?? null;
  const minSourceEnd = clip.sourceStart + MIN_CLIP_DURATION;
  const maxSourceEnd = nextClip?.sourceStart ?? state.sourceDuration;
  const safeSourceEnd = Math.max(
    Math.min(nextSourceEnd, maxSourceEnd),
    minSourceEnd,
  );

  if (safeSourceEnd === clip.sourceEnd) {
    return null;
  }

  const updatedClips = rebuildTimeline(
    state.clips.map((currentClip) =>
      currentClip.id === clipId
        ? {
            ...currentClip,
            sourceEnd: safeSourceEnd,
          }
        : currentClip,
    ),
  );

  const nextDuration = getTimelineDuration(updatedClips);

  return {
    clips: updatedClips,
    duration: nextDuration,
    sourceDuration: Math.max(
      state.sourceDuration,
      getSourceDuration(updatedClips),
    ),
    effects: updateEffectsForDuration(state.effects, nextDuration),
  };
};

export const buildExportRequest = (
  source: string,
  clips: EditorClip[],
  duration: number,
  effects: EditorEffect[],
  background: EditorBackgroundSettings,
  settings?: Partial<ExportSettings>,
): ExportRequest => {
  const safeDuration = Number.isFinite(duration) ? Math.max(duration, 0) : 0;
  const resolvedSettings = {
    ...defaultExportSettings,
    ...settings,
  };
  const normalizedBackground = normalizeBackgroundSettings(background);

  const normalizedEffects = effects
    .map((effect) => clampEffect(effect, safeDuration))
    .sort((a, b) => a.startTime - b.startTime)
    .map((effect) => ({
      type: effect.type,
      startTime: effect.startTime,
      length: effect.length,
      multiplier: effect.multiplier,
      anchor: effect.anchor,
    }));

  // Build segments from clips
  const segments = clips.map((clip) => ({
    sourceUrl: source,
    inPoint: clip.sourceStart,
    outPoint: clip.sourceEnd,
    startOnTimeline: clip.timelineStart,
  }));

  return {
    segments,
    duration: safeDuration,
    effects: normalizedEffects,
    background: normalizedBackground,
    destination: resolvedSettings.destination,
    format: resolvedSettings.format,
    resolution: resolvedSettings.resolution,
    fps: resolvedSettings.fps,
    optimizeFileSize: resolvedSettings.optimizeFileSize,
  };
};

export const useEditorStore = create<EditorState>((set) => ({
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  sourceDuration: 0,
  sourceUrl: null,
  clips: [],
  effects: [],
  selectedEffectId: null,
  selectedClipId: null,
  backgroundSettings: defaultBackgroundSettings,

  setIsPlaying: (playing: boolean) => set({ isPlaying: playing }),
  setCurrentTime: (time: number) =>
    set((state) => ({ currentTime: clampTime(time, state.duration) })),
  setDuration: (duration: number) =>
    set((state) => {
      const safeDuration = clampNonNegative(duration);

      if (state.clips.length === 0 && state.sourceUrl) {
        return buildTimelineState(state.sourceUrl, safeDuration, state.effects);
      }

      return {
        sourceDuration: safeDuration,
      };
    }),
  initializeTimeline: (sourceUrl: string, duration: number) =>
    set(() => buildTimelineState(sourceUrl, duration)),
  seekTo: (time: number) =>
    set((state) => ({ currentTime: clampTime(time, state.duration) })),
  jumpBy: (delta: number) =>
    set((state) => ({
      currentTime: clampTime(state.currentTime + delta, state.duration),
    })),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  resetTimeline: () =>
    set({
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      sourceDuration: 0,
      sourceUrl: null,
      clips: [],
      effects: [],
      selectedEffectId: null,
      selectedClipId: null,
    }),
  addZoomEffect: () => {
    let createdEffectId = "";

    set((state) => {
      const effect = createDefaultZoomEffect(state.currentTime, state.duration);
      createdEffectId = effect.id;

      return {
        effects: [...state.effects, effect],
        selectedEffectId: null,
      };
    });

    return createdEffectId;
  },
  updateEffect: (
    effectId: string,
    updates: Partial<Omit<EditorEffect, "id" | "type">>,
  ) =>
    set((state) => ({
      effects: state.effects.map((effect) => {
        if (effect.id !== effectId) {
          return effect;
        }

        return clampEffect({ ...effect, ...updates }, state.duration);
      }),
    })),
  removeEffect: (effectId: string) =>
    set((state) => ({
      effects: state.effects.filter((effect) => effect.id !== effectId),
      selectedEffectId:
        state.selectedEffectId === effectId ? null : state.selectedEffectId,
    })),
  selectEffect: (effectId: string | null) =>
    set({ selectedEffectId: effectId }),
  selectClip: (clipId: string | null) => set({ selectedClipId: clipId }),
  cutSelectedClipAtCurrentTime: () => {
    let cutResult: ReturnType<typeof cutClipAtTime> = null;

    set((state) => {
      const selectedClip =
        state.selectedClipId !== null
          ? (state.clips.find((clip) => clip.id === state.selectedClipId) ??
            null)
          : null;
      const activeClip = findClipAtTimelineTime(state.clips, state.currentTime);
      const targetClip = selectedClip ?? activeClip?.clip ?? null;

      if (!targetClip) {
        return state;
      }

      cutResult = cutClipAtTime(state, targetClip.id, state.currentTime);

      if (!cutResult) {
        return state;
      }

      return cutResult;
    });

    return cutResult !== null;
  },
  trimClipStart: (clipId: string, nextSourceStart: number) =>
    set((state) => {
      const updated = trimClipStartAt(state, clipId, nextSourceStart);

      if (!updated) {
        return state;
      }

      return {
        ...updated,
        currentTime: clampTime(state.currentTime, updated.duration),
      };
    }),
  trimClipEnd: (clipId: string, nextSourceEnd: number) =>
    set((state) => {
      const updated = trimClipEndAt(state, clipId, nextSourceEnd);

      if (!updated) {
        return state;
      }

      return {
        ...updated,
        currentTime: clampTime(state.currentTime, updated.duration),
      };
    }),
  updateBackgroundSettings: (updates: Partial<EditorBackgroundSettings>) =>
    set((state) => {
      const merged: EditorBackgroundSettings = {
        ...state.backgroundSettings,
        ...updates,
      };

      return {
        backgroundSettings: normalizeBackgroundSettings(merged),
      };
    }),
  resetBackgroundSettings: () =>
    set({ backgroundSettings: defaultBackgroundSettings }),
}));
