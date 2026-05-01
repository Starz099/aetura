import type { StateCreator } from "zustand";
import {
  DEFAULT_BACKGROUND_PADDING,
  DEFAULT_BACKGROUND_PRESET_ID,
  DEFAULT_BACKGROUND_ROUNDEDNESS,
  DEFAULT_ZOOM_ANCHOR,
  DEFAULT_ZOOM_LENGTH,
  DEFAULT_ZOOM_MULTIPLIER,
  MAX_BACKGROUND_PADDING,
  MAX_BACKGROUND_ROUNDEDNESS,
  MIN_EFFECT_LENGTH,
} from "@/config/constants";
import type {
  EditorBackgroundSettings,
  EditorEffect,
  EditorEffectType,
  ZoomAnchor,
} from "@/types/editor";
import type { EffectSlice, TimelineSlice } from "@/types/store";

const defaultBackgroundSettings: EditorBackgroundSettings = {
  enabled: false,
  presetId: DEFAULT_BACKGROUND_PRESET_ID,
  padding: DEFAULT_BACKGROUND_PADDING,
  roundedness: DEFAULT_BACKGROUND_ROUNDEDNESS,
};

const clampTime = (time: number, duration: number) => {
  const safeDuration = Number.isFinite(duration) ? Math.max(duration, 0) : 0;
  if (!Number.isFinite(time)) return 0;
  return Math.min(Math.max(time, 0), safeDuration);
};

const clampAnchorValue = (value: number) => {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(Math.max(value, 0), 1);
};

const normalizeZoomAnchor = (
  anchor?: Partial<ZoomAnchor> | null,
): ZoomAnchor => ({
  x: clampAnchorValue(anchor?.x ?? DEFAULT_ZOOM_ANCHOR.x),
  y: clampAnchorValue(anchor?.y ?? DEFAULT_ZOOM_ANCHOR.y),
});

const clampPaddingValue = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), MAX_BACKGROUND_PADDING);
};

const clampRoundednessValue = (value: number) => {
  if (!Number.isFinite(value)) return 0;
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

export const createEffectSlice: StateCreator<
  TimelineSlice & EffectSlice,
  [],
  [],
  EffectSlice
> = (set, get) => ({
  effects: [],
  selectedEffectId: null,
  backgroundSettings: defaultBackgroundSettings,

  clampEffect: (effect, duration) => {
    const safeDuration = Number.isFinite(duration) ? Math.max(duration, 0) : 0;
    let startTime = clampTime(effect.startTime, safeDuration);
    const requestedLength = Number.isFinite(effect.length)
      ? Math.max(effect.length, MIN_EFFECT_LENGTH)
      : MIN_EFFECT_LENGTH;
    const length =
      safeDuration > 0 ? Math.min(requestedLength, safeDuration) : requestedLength;

    if (safeDuration > 0 && startTime + length > safeDuration) {
      startTime = Math.max(safeDuration - length, 0);
    }

    return {
      ...effect,
      id: effect.id || `effect-${Math.random().toString(36).slice(2, 10)}`,
      type: effect.type as EditorEffectType,
      startTime,
      length:
        safeDuration > 0
          ? Math.min(length, Math.max(safeDuration - startTime, MIN_EFFECT_LENGTH))
          : length,
      anchor: normalizeZoomAnchor(effect.anchor),
    } as EditorEffect;
  },

  addZoomEffect: () => {
    let createdEffectId = "";
    set((state) => {
      const startTime = state.currentTime;
      const duration = state.duration;
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

      const effect = get().clampEffect(
        {
          id: `effect-${Math.random().toString(36).slice(2, 10)}`,
          type: "zoom",
          startTime: normalizedStart,
          length: defaultLength,
          multiplier: DEFAULT_ZOOM_MULTIPLIER,
          anchor: DEFAULT_ZOOM_ANCHOR,
        },
        safeDuration,
      );
      createdEffectId = effect.id;

      return {
        effects: [...state.effects, effect],
        selectedEffectId: null,
      };
    });
    return createdEffectId;
  },

  updateEffect: (effectId, updates) =>
    set((state) => ({
      effects: state.effects.map((effect) => {
        if (effect.id !== effectId) return effect;
        return get().clampEffect({ ...effect, ...updates }, state.duration);
      }),
    })),

  removeEffect: (effectId) =>
    set((state) => ({
      effects: state.effects.filter((effect) => effect.id !== effectId),
      selectedEffectId:
        state.selectedEffectId === effectId ? null : state.selectedEffectId,
    })),

  selectEffect: (effectId) => set({ selectedEffectId: effectId }),

  updateBackgroundSettings: (updates) =>
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
});
