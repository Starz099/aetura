import { create } from "zustand";

export type EditorEffectType = "zoom";

export interface EditorEffect {
  id: string;
  type: EditorEffectType;
  startTime: number;
  length: number;
  multiplier: number;
}

export interface ExportEffect {
  type: EditorEffectType;
  startTime: number;
  length: number;
  multiplier: number;
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
  source: string;
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

interface EditorState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  effects: EditorEffect[];
  selectedEffectId: string | null;
  backgroundSettings: EditorBackgroundSettings;

  setIsPlaying: (isPlaying: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
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

const clampEffect = (effect: EditorEffect, duration: number): EditorEffect => {
  const safeDuration = Number.isFinite(duration) ? Math.max(duration, 0) : 0;
  let startTime = clampTime(effect.startTime, safeDuration);
  const requestedLength = Number.isFinite(effect.length)
    ? Math.max(effect.length, 0.1)
    : 0.1;
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
        ? Math.min(length, Math.max(safeDuration - startTime, 0.1))
        : length,
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
    },
    safeDuration,
  );
};

export const buildExportRequest = (
  source: string,
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
    }));

  return {
    source,
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
  effects: [],
  selectedEffectId: null,
  backgroundSettings: defaultBackgroundSettings,

  setIsPlaying: (playing: boolean) => set({ isPlaying: playing }),
  setCurrentTime: (time: number) =>
    set((state) => ({ currentTime: clampTime(time, state.duration) })),
  setDuration: (duration: number) =>
    set((state) => {
      const safeDuration = Number.isFinite(duration)
        ? Math.max(duration, 0)
        : 0;

      return {
        duration: safeDuration,
        currentTime: clampTime(state.currentTime, safeDuration),
        effects: state.effects.map((effect) =>
          clampEffect(effect, safeDuration),
        ),
      };
    }),
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
      effects: [],
      selectedEffectId: null,
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
