import { create } from "zustand";

export type EditorEffectType = "zoom";

export interface EditorEffect {
  id: string;
  type: EditorEffectType;
  startTime: number;
  length: number;
  multiplier: number;
}

const DEFAULT_ZOOM_LENGTH = 3;
const DEFAULT_ZOOM_MULTIPLIER = 1.25;

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
}

const clampTime = (time: number, duration: number) => {
  const safeDuration = Number.isFinite(duration) ? Math.max(duration, 0) : 0;

  if (!Number.isFinite(time)) {
    return 0;
  }

  return Math.min(Math.max(time, 0), safeDuration);
};

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

export const useEditorStore = create<EditorState>((set) => ({
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  effects: [],
  selectedEffectId: null,

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
}));
