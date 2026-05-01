import type { StateCreator } from "zustand";
import {
  MIN_CLIP_DURATION,
} from "@/config/constants";
import {
  buildSingleClipTimeline,
  findClipAtTimelineTime,
  getSourceDuration,
  getTimelineDuration,
  rebuildTimeline,
} from "@/lib/editorTimeline";
import type { EditorClip } from "@/types/editor";
import type { EffectSlice, TimelineSlice } from "@/types/store";

const clampTime = (time: number, duration: number) => {
  const safeDuration = Number.isFinite(duration) ? Math.max(duration, 0) : 0;
  if (!Number.isFinite(time)) return 0;
  return Math.min(Math.max(time, 0), safeDuration);
};

const clampNonNegative = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(value, 0);
};

export const createTimelineSlice: StateCreator<
  TimelineSlice & EffectSlice,
  [],
  [],
  TimelineSlice
> = (set, get) => ({
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  sourceDuration: 0,
  sourceUrl: null,
  clips: [],
  selectedClipId: null,

  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) =>
    set((state) => ({ currentTime: clampTime(time, state.duration) })),
  setDuration: (duration) =>
    set((state) => {
      const safeDuration = clampNonNegative(duration);
      if (state.clips.length === 0 && state.sourceUrl) {
        return {
          sourceUrl: state.sourceUrl,
          sourceDuration: safeDuration,
          duration: safeDuration,
          currentTime: 0,
          clips: buildSingleClipTimeline(state.sourceUrl, safeDuration),
          effects: state.effects.map((effect) =>
            get().clampEffect(effect, safeDuration),
          ),
          selectedEffectId: null,
          selectedClipId: null,
        };
      }
      return { sourceDuration: safeDuration };
    }),
  initializeTimeline: (sourceUrl, duration) => {
    const safeDuration = clampNonNegative(duration);
    set({
      isPlaying: false,
      sourceUrl,
      sourceDuration: safeDuration,
      duration: safeDuration,
      currentTime: 0,
      clips: buildSingleClipTimeline(sourceUrl, safeDuration),
      effects: [],
      selectedEffectId: null,
      selectedClipId: null,
    });
  },
  seekTo: (time) =>
    set((state) => ({ currentTime: clampTime(time, state.duration) })),
  jumpBy: (delta) =>
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
  selectClip: (clipId) => set({ selectedClipId: clipId }),
  cutSelectedClipAtCurrentTime: () => {
    let cutPerformed = false;
    set((state) => {
      const selectedClip =
        state.selectedClipId !== null
          ? state.clips.find((c) => c.id === state.selectedClipId) ?? null
          : null;
      const activeClip = findClipAtTimelineTime(state.clips, state.currentTime);
      const targetClip = selectedClip ?? activeClip?.clip ?? null;

      if (!targetClip) return state;

      const clipLocation = findClipAtTimelineTime(state.clips, state.currentTime);
      if (!clipLocation || clipLocation.clip.id !== targetClip.id) return state;

      const clip = clipLocation.clip;
      const clipDuration = clip.sourceEnd - clip.sourceStart;
      const localTime = clipLocation.localTime;

      if (
        localTime < MIN_CLIP_DURATION ||
        localTime > clipDuration - MIN_CLIP_DURATION
      ) {
        return state;
      }

      const leftClip: EditorClip = {
        ...clip,
        sourceEnd: clip.sourceStart + localTime,
      };
      const rightClip: EditorClip = {
        ...clip,
        id: `clip-${Math.random().toString(36).slice(2, 10)}`,
        sourceStart: clip.sourceStart + localTime,
      };

      const updatedClips = rebuildTimeline([
        ...state.clips.slice(0, clipLocation.index),
        leftClip,
        rightClip,
        ...state.clips.slice(clipLocation.index + 1),
      ]);

      const nextDuration = getTimelineDuration(updatedClips);
      cutPerformed = true;

      return {
        clips: updatedClips,
        duration: nextDuration,
        sourceDuration: Math.max(
          state.sourceDuration,
          getSourceDuration(updatedClips),
        ),
        currentTime: state.currentTime,
        selectedClipId: rightClip.id,
        effects: state.effects.map((e) => get().clampEffect(e, nextDuration)),
      };
    });
    return cutPerformed;
  },
  trimClipStart: (clipId, nextSourceStart) =>
    set((state) => {
      const clipIndex = state.clips.findIndex((c) => c.id === clipId);
      if (clipIndex < 0) return state;

      const clip = state.clips[clipIndex];
      const previousClip = state.clips[clipIndex - 1] ?? null;
      const minSourceStart = previousClip?.sourceEnd ?? 0;
      const maxSourceStart = clip.sourceEnd - MIN_CLIP_DURATION;
      const safeSourceStart = Math.min(
        Math.max(nextSourceStart, minSourceStart),
        maxSourceStart,
      );

      if (safeSourceStart === clip.sourceStart) return state;

      const updatedClips = rebuildTimeline(
        state.clips.map((c) =>
          c.id === clipId ? { ...c, sourceStart: safeSourceStart } : c,
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
        effects: state.effects.map((e) => get().clampEffect(e, nextDuration)),
        currentTime: clampTime(state.currentTime, nextDuration),
      };
    }),
  trimClipEnd: (clipId, nextSourceEnd) =>
    set((state) => {
      const clipIndex = state.clips.findIndex((c) => c.id === clipId);
      if (clipIndex < 0) return state;

      const clip = state.clips[clipIndex];
      const nextClip = state.clips[clipIndex + 1] ?? null;
      const minSourceEnd = clip.sourceStart + MIN_CLIP_DURATION;
      const maxSourceEnd = nextClip?.sourceStart ?? state.sourceDuration;
      const safeSourceEnd = Math.max(
        Math.min(nextSourceEnd, maxSourceEnd),
        minSourceEnd,
      );

      if (safeSourceEnd === clip.sourceEnd) return state;

      const updatedClips = rebuildTimeline(
        state.clips.map((c) =>
          c.id === clipId ? { ...c, sourceEnd: safeSourceEnd } : c,
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
        effects: state.effects.map((e) => get().clampEffect(e, nextDuration)),
        currentTime: clampTime(state.currentTime, nextDuration),
      };
    }),
});
