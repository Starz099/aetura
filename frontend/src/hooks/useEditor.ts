/**
 * Custom hook for editor functionality.
 * Abstracts store access and provides a clean API for components.
 */

import { useCallback, useMemo } from "react";
import { useEditorStore } from "@/store/useEditorStore";
import { formatTime } from "@/lib/time";

/**
 * Hook providing core editor state and actions.
 */
export function useEditor() {
  // State
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const currentTime = useEditorStore((state) => state.currentTime);
  const duration = useEditorStore((state) => state.duration);
  const selectedEffectId = useEditorStore((state) => state.selectedEffectId);
  const effects = useEditorStore((state) => state.effects);

  // Store actions
  const setIsPlaying = useEditorStore((state) => state.setIsPlaying);
  const setCurrentTime = useEditorStore((state) => state.setCurrentTime);
  const setDuration = useEditorStore((state) => state.setDuration);
  const seekTo = useEditorStore((state) => state.seekTo);
  const togglePlay = useEditorStore((state) => state.togglePlay);
  const selectEffect = useEditorStore((state) => state.selectEffect);
  const addZoomEffect = useEditorStore((state) => state.addZoomEffect);
  const updateEffect = useEditorStore((state) => state.updateEffect);
  const removeEffect = useEditorStore((state) => state.removeEffect);
  const resetTimeline = useEditorStore((state) => state.resetTimeline);

  // Convenience actions
  const play = useCallback(() => setIsPlaying(true), [setIsPlaying]);
  const pause = useCallback(() => setIsPlaying(false), [setIsPlaying]);
  const seek = useCallback((time: number) => seekTo(time), [seekTo]);

  // Computed values
  const progress = useMemo(() => {
    return duration > 0 ? (currentTime / duration) * 100 : 0;
  }, [currentTime, duration]);

  const isEditing = useMemo(() => {
    return selectedEffectId !== null;
  }, [selectedEffectId]);

  const selectedEffect = useMemo(() => {
    if (!selectedEffectId) return null;
    return effects.find((e) => e.id === selectedEffectId) || null;
  }, [selectedEffectId, effects]);

  // Wrapped actions
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
    // State
    isPlaying,
    currentTime,
    duration,
    progress,
    effects,
    selectedEffectId,
    selectedEffect,
    isEditing,
    // Core actions
    setIsPlaying,
    setCurrentTime,
    setDuration,
    seekTo,
    togglePlay,
    selectEffect,
    addZoomEffect,
    updateEffect,
    removeEffect,
    resetTimeline,
    // Convenience actions
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

  // Convenience actions
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
    return effects.find((e) => e.id === selectedEffectId) || null;
  }, [selectedEffectId, effects]);

  const hasEffects = useMemo(() => {
    return effects.length > 0;
  }, [effects]);

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
