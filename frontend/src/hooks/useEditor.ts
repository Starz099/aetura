/**
 * Custom hook for editor functionality.
 * Abstracts store access and provides a clean API for components.
 */

import { useCallback, useMemo } from "react";

import { formatTime } from "@/lib/time";
import { findClipAtTimelineTime } from "@/lib/editorTimeline";
import { useEditorStore } from "@/store/useEditorStore";

/**
 * Hook providing core editor state and actions.
 */
export function useEditor() {
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const currentTime = useEditorStore((state) => state.currentTime);
  const duration = useEditorStore((state) => state.duration);
  const sourceDuration = useEditorStore((state) => state.sourceDuration);
  const selectedEffectId = useEditorStore((state) => state.selectedEffectId);
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const effects = useEditorStore((state) => state.effects);
  const clips = useEditorStore((state) => state.clips);

  const setIsPlaying = useEditorStore((state) => state.setIsPlaying);
  const setCurrentTime = useEditorStore((state) => state.setCurrentTime);
  const setDuration = useEditorStore((state) => state.setDuration);
  const initializeTimeline = useEditorStore(
    (state) => state.initializeTimeline,
  );
  const seekTo = useEditorStore((state) => state.seekTo);
  const togglePlay = useEditorStore((state) => state.togglePlay);
  const selectEffect = useEditorStore((state) => state.selectEffect);
  const selectClip = useEditorStore((state) => state.selectClip);
  const addZoomEffect = useEditorStore((state) => state.addZoomEffect);
  const updateEffect = useEditorStore((state) => state.updateEffect);
  const removeEffect = useEditorStore((state) => state.removeEffect);
  const cutSelectedClipAtCurrentTime = useEditorStore(
    (state) => state.cutSelectedClipAtCurrentTime,
  );
  const trimClipStart = useEditorStore((state) => state.trimClipStart);
  const trimClipEnd = useEditorStore((state) => state.trimClipEnd);
  const resetTimeline = useEditorStore((state) => state.resetTimeline);

  const play = useCallback(() => setIsPlaying(true), [setIsPlaying]);
  const pause = useCallback(() => setIsPlaying(false), [setIsPlaying]);
  const seek = useCallback((time: number) => seekTo(time), [seekTo]);

  const progress = useMemo(() => {
    return duration > 0 ? (currentTime / duration) * 100 : 0;
  }, [currentTime, duration]);

  const isEditing = useMemo(() => {
    return selectedEffectId !== null || selectedClipId !== null;
  }, [selectedClipId, selectedEffectId]);

  const selectedEffect = useMemo(() => {
    if (!selectedEffectId) return null;
    return effects.find((effect) => effect.id === selectedEffectId) || null;
  }, [selectedEffectId, effects]);

  const selectedClip = useMemo(() => {
    if (!selectedClipId) return null;

    return clips.find((clip) => clip.id === selectedClipId) || null;
  }, [clips, selectedClipId]);

  const activeClip = useMemo(
    () => findClipAtTimelineTime(clips, currentTime)?.clip ?? null,
    [clips, currentTime],
  );

  const togglePlayPause = useCallback(() => {
    togglePlay();
  }, [togglePlay]);

  const seekToPercent = useCallback(
    (percent: number) => {
      const time = (percent / 100) * duration;
      seekTo(Math.max(0, Math.min(time, duration)));
    },
    [duration, seekTo],
  );

  return {
    isPlaying,
    currentTime,
    duration,
    sourceDuration,
    progress,
    effects,
    clips,
    selectedEffectId,
    selectedClipId,
    selectedEffect,
    selectedClip,
    activeClip,
    isEditing,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    initializeTimeline,
    seekTo,
    togglePlay,
    selectEffect,
    selectClip,
    addZoomEffect,
    updateEffect,
    removeEffect,
    cutSelectedClipAtCurrentTime,
    trimClipStart,
    trimClipEnd,
    resetTimeline,
    play,
    pause,
    seek,
    togglePlayPause,
    seekToPercent,
  };
}

/**
 * Hook for playback-specific operations.
 */
export function useEditorPlayback() {
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const currentTime = useEditorStore((state) => state.currentTime);
  const duration = useEditorStore((state) => state.duration);
  const setIsPlaying = useEditorStore((state) => state.setIsPlaying);
  const seekTo = useEditorStore((state) => state.seekTo);
  const togglePlay = useEditorStore((state) => state.togglePlay);

  const play = useCallback(() => setIsPlaying(true), [setIsPlaying]);
  const pause = useCallback(() => setIsPlaying(false), [setIsPlaying]);
  const seek = useCallback((time: number) => seekTo(time), [seekTo]);

  const togglePlayPause = useCallback(() => {
    togglePlay();
  }, [togglePlay]);

  const currentTimeFormatted = useMemo(
    () => formatTime(currentTime),
    [currentTime],
  );

  const durationFormatted = useMemo(() => formatTime(duration), [duration]);

  return {
    isPlaying,
    currentTime,
    duration,
    currentTimeFormatted,
    durationFormatted,
    play,
    pause,
    seek,
    togglePlayPause,
  };
}

/**
 * Hook for effects management.
 */
export function useEditorEffects() {
  const effects = useEditorStore((state) => state.effects);
  const selectedEffectId = useEditorStore((state) => state.selectedEffectId);
  const selectEffect = useEditorStore((state) => state.selectEffect);
  const addZoomEffect = useEditorStore((state) => state.addZoomEffect);
  const updateEffect = useEditorStore((state) => state.updateEffect);
  const removeEffect = useEditorStore((state) => state.removeEffect);

  const selectedEffect = useMemo(() => {
    if (!selectedEffectId) return null;
    return effects.find((effect) => effect.id === selectedEffectId) || null;
  }, [selectedEffectId, effects]);

  const hasEffects = useMemo(() => effects.length > 0, [effects]);

  return {
    effects,
    selectedEffect,
    selectedEffectId,
    hasEffects,
    selectEffect,
    addZoomEffect,
    updateEffect,
    removeEffect,
  };
}
