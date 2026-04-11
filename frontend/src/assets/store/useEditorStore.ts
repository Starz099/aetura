import { create } from "zustand";

interface EditorState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;

  setIsPlaying: (isPlaying: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  seekTo: (time: number) => void;
  jumpBy: (delta: number) => void;
  togglePlay: () => void;
  resetTimeline: () => void;
}

const clampTime = (time: number, duration: number) => {
  const safeDuration = Number.isFinite(duration) ? Math.max(duration, 0) : 0;

  if (!Number.isFinite(time)) {
    return 0;
  }

  return Math.min(Math.max(time, 0), safeDuration);
};

export const useEditorStore = create<EditorState>((set) => ({
  isPlaying: false,
  currentTime: 0,
  duration: 0,

  setIsPlaying: (playing: boolean) => set({ isPlaying: playing }),
  setCurrentTime: (time: number) =>
    set((state) => ({ currentTime: clampTime(time, state.duration) })),
  setDuration: (duration: number) =>
    set((state) => ({
      duration: Number.isFinite(duration) ? Math.max(duration, 0) : 0,
      currentTime: clampTime(
        state.currentTime,
        Number.isFinite(duration) ? duration : 0,
      ),
    })),
  seekTo: (time: number) =>
    set((state) => ({ currentTime: clampTime(time, state.duration) })),
  jumpBy: (delta: number) =>
    set((state) => ({
      currentTime: clampTime(state.currentTime + delta, state.duration),
    })),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  resetTimeline: () => set({ isPlaying: false, currentTime: 0, duration: 0 }),
}));
