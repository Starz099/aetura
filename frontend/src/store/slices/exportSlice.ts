import type { StateCreator } from "zustand";
import type { EditorBackgroundSettings, EditorClip, EditorEffect } from "@/types/editor";
import type { ExportRequest, ExportSettings } from "@/types/export";
import type { ExportSlice, EditorState } from "@/types/store";
import { MIN_EFFECT_LENGTH } from "@/config/constants";

const defaultExportSettings: ExportSettings = {
  destination: "file",
  format: "mp4",
  resolution: "1080p",
  fps: 60,
  optimizeFileSize: false,
};

const clampTime = (time: number, duration: number) => {
  const safeDuration = Number.isFinite(duration) ? Math.max(duration, 0) : 0;
  if (!Number.isFinite(time)) return 0;
  return Math.min(Math.max(time, 0), safeDuration);
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

  const normalizedEffects = effects
    .map((effect) => {
      // Inline clamp logic for export to avoid circular deps if possible
      let startTime = clampTime(effect.startTime, safeDuration);
      const requestedLength = Math.max(effect.length, MIN_EFFECT_LENGTH);
      const length = safeDuration > 0 ? Math.min(requestedLength, safeDuration) : requestedLength;
      
      if (safeDuration > 0 && startTime + length > safeDuration) {
        startTime = Math.max(safeDuration - length, 0);
      }

      return {
        type: effect.type,
        startTime,
        length: safeDuration > 0 ? Math.min(length, Math.max(safeDuration - startTime, MIN_EFFECT_LENGTH)) : length,
        multiplier: effect.multiplier,
        anchor: effect.anchor,
      };
    })
    .sort((a, b) => a.startTime - b.startTime);

  const segments = clips.map((clip) => ({
    sourceUrl: clip.sourceUrl,
    inPoint: clip.sourceStart,
    outPoint: clip.sourceEnd,
    startOnTimeline: clip.timelineStart,
  }));

  return {
    segments,
    duration: safeDuration,
    effects: normalizedEffects,
    background: { ...background },
    destination: resolvedSettings.destination,
    format: resolvedSettings.format,
    resolution: resolvedSettings.resolution,
    fps: resolvedSettings.fps,
    optimizeFileSize: resolvedSettings.optimizeFileSize,
  };
};

export const createExportSlice: StateCreator<
  EditorState,
  [],
  [],
  ExportSlice
> = () => ({
  buildExportRequest,
});
