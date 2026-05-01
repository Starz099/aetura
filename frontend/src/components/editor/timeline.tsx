import {
  FastForwardIcon,
  PauseIcon,
  PlayIcon,
  RewindIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { Button, Card, CardContent } from "@/components/ui";
import { getToolStrategy } from "@/config/tools";
import {
  getClipDuration,
  MIN_CLIP_DURATION,
} from "@/lib/editorTimeline";
import { useEditorStore } from "@/store/useEditorStore";
import {
  MIN_EFFECT_LENGTH,
  TIMELINE_DRAG_THRESHOLD_PX,
} from "@/config/constants";

type EffectDragMode = "move" | "start" | "end";
type ClipDragMode = "start" | "end";

type DragState =
  | {
      target: "effect";
      effectId: string;
      mode: EffectDragMode;
      startX: number;
      initialStartTime: number;
      initialLength: number;
    }
  | {
      target: "clip";
      clipId: string;
      mode: ClipDragMode;
      startX: number;
      initialSourceStart: number;
      initialSourceEnd: number;
    };

const MIN_VISIBLE_BLOCK_PERCENT = 4;

const formatTime = (time: number) => {
  if (!Number.isFinite(time) || time < 0) {
    return "0:00";
  }

  const totalSeconds = Math.floor(time);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export function EditorTimeline() {
  const currentTime = useEditorStore((state) => state.currentTime);
  const duration = useEditorStore((state) => state.duration);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const clips = useEditorStore((state) => state.clips);
  const effects = useEditorStore((state) => state.effects);
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const selectedEffectId = useEditorStore((state) => state.selectedEffectId);
  const seekTo = useEditorStore((state) => state.seekTo);
  const jumpBy = useEditorStore((state) => state.jumpBy);
  const togglePlay = useEditorStore((state) => state.togglePlay);
  const selectClip = useEditorStore((state) => state.selectClip);
  const selectEffect = useEditorStore((state) => state.selectEffect);
  const trimClipStart = useEditorStore((state) => state.trimClipStart);
  const trimClipEnd = useEditorStore((state) => state.trimClipEnd);
  const updateEffect = useEditorStore((state) => state.updateEffect);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragMovedRef = useRef(false);

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const onPointerMove = (event: PointerEvent) => {
      const trackWidth = timelineRef.current?.clientWidth ?? 0;

      if (!duration || trackWidth <= 0) {
        return;
      }

      const deltaX = event.clientX - dragState.startX;

      if (Math.abs(deltaX) > TIMELINE_DRAG_THRESHOLD_PX) {
        dragMovedRef.current = true;
      }

      const deltaTime = (deltaX / trackWidth) * duration;

      if (dragState.target === "effect") {
        if (dragState.mode === "move") {
          const nextStart = Math.min(
            Math.max(dragState.initialStartTime + deltaTime, 0),
            Math.max(duration - dragState.initialLength, 0),
          );

          updateEffect(dragState.effectId, { startTime: nextStart });
          return;
        }

        if (dragState.mode === "start") {
          const originalEnd =
            dragState.initialStartTime + dragState.initialLength;
          const nextStart = Math.min(
            Math.max(dragState.initialStartTime + deltaTime, 0),
            Math.max(originalEnd - MIN_EFFECT_LENGTH, 0),
          );

          updateEffect(dragState.effectId, {
            startTime: nextStart,
            length: originalEnd - nextStart,
          });
          return;
        }

        const nextLength = Math.min(
          Math.max(dragState.initialLength + deltaTime, MIN_EFFECT_LENGTH),
          Math.max(duration - dragState.initialStartTime, MIN_EFFECT_LENGTH),
        );

        updateEffect(dragState.effectId, { length: nextLength });
        return;
      }

      if (dragState.mode === "start") {
        trimClipStart(
          dragState.clipId,
          dragState.initialSourceStart + deltaTime,
        );
        return;
      }

      trimClipEnd(dragState.clipId, dragState.initialSourceEnd + deltaTime);
    };

    const onPointerUp = () => {
      setDragState(null);

      window.setTimeout(() => {
        dragMovedRef.current = false;
      }, 0);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [dragState, duration, trimClipEnd, trimClipStart, updateEffect]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const scrubValue = duration > 0 ? Math.min(currentTime, duration) : 0;

  return (
    <Card size="sm" className="border-border/90 bg-muted/35">
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-9 w-9 shrink-0"
            onClick={() => jumpBy(-5)}
            disabled={duration <= 0}
            aria-label="Seek backward 5 seconds"
          >
            <RewindIcon size={16} />
          </Button>

          <Button
            type="button"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={togglePlay}
            disabled={duration <= 0}
            aria-label={isPlaying ? "Pause playback" : "Play playback"}
          >
            {isPlaying ? (
              <PauseIcon size={16} />
            ) : (
              <PlayIcon size={16} weight="fill" />
            )}
          </Button>

          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-9 w-9 shrink-0"
            onClick={() => jumpBy(5)}
            disabled={duration <= 0}
            aria-label="Seek forward 5 seconds"
          >
            <FastForwardIcon size={16} />
          </Button>

          <div className="ml-auto text-right text-[11px] font-medium tracking-wide text-muted-foreground">
            <div>
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
            <div>
              {duration > 0 ? `${Math.round(progress)}%` : "Waiting for media"}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <input
            type="range"
            min={0}
            max={Math.max(duration, 0)}
            step="0.01"
            value={scrubValue}
            onChange={(event) => seekTo(Number(event.target.value))}
            disabled={duration <= 0}
            aria-label="Timeline scrubber"
            className="timeline-scrubber h-2 w-full cursor-pointer appearance-none rounded-full bg-border/70 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${progress}%, hsl(var(--border)) ${progress}%, hsl(var(--border)) 100%)`,
            }}
          />

          <div
            ref={timelineRef}
            className="relative space-y-3 overflow-hidden rounded-md border border-border/70 bg-background/70 p-2 shadow-[0_2px_0_var(--shadow-soft)]"
          >
            <div
              className="pointer-events-none absolute inset-y-0 left-0 bg-primary/10 transition-[width] duration-150"
              style={{ width: `${progress}%` }}
            />
            <div
              className="pointer-events-none absolute inset-y-0 left-0 w-px bg-primary shadow-[0_0_10px_hsl(var(--primary)/45%)]"
              style={{ left: `${progress}%` }}
            />

            <section className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                <span>Clips</span>
                <span>
                  {clips.length > 0
                    ? `${clips.length} segment${clips.length === 1 ? "" : "s"}`
                    : "No clips"}
                </span>
              </div>

              <div className="relative h-14 overflow-hidden rounded-md border border-border/60 bg-muted/25">
                {clips.length > 0 ? (
                  clips.map((clip, index) => {
                    const clipDuration = getClipDuration(clip);
                    const left =
                      duration > 0 ? (clip.timelineStart / duration) * 100 : 0;
                    const width =
                      duration > 0 ? (clipDuration / duration) * 100 : 0;
                    const isSelected = clip.id === selectedClipId;
                    const clampedLeft = Math.min(Math.max(left, 0), 100);
                    const remainingWidth = Math.max(100 - clampedLeft, 0);
                    const minVisualWidth = Math.min(
                      MIN_VISIBLE_BLOCK_PERCENT,
                      remainingWidth,
                    );
                    const visualWidth = Math.min(
                      Math.max(width, minVisualWidth),
                      remainingWidth,
                    );
                    const canTrimStart = clipDuration > MIN_CLIP_DURATION;

                    return (
                      <button
                        key={clip.id}
                        type="button"
                        onClick={() => {
                          if (!dragMovedRef.current) {
                            selectClip(clip.id);
                          }
                        }}
                        className={`absolute top-2 flex h-9 items-center rounded-md border px-2 text-left text-[10px] font-medium transition ${
                          isSelected
                            ? "border-primary bg-primary/20 text-foreground shadow-[0_0_0_1px_hsl(var(--primary))]"
                            : "border-border bg-card/80 text-muted-foreground hover:border-primary/70 hover:bg-primary/10"
                        }`}
                        style={{
                          left: `${clampedLeft}%`,
                          width: `${visualWidth}%`,
                          zIndex: 5,
                        }}
                      >
                        {isSelected ? (
                          <>
                            <span
                              role="presentation"
                              className={`absolute inset-y-0 left-0 w-1.5 rounded-l-md border-r border-primary/80 bg-primary/35 ${
                                canTrimStart
                                  ? "cursor-col-resize"
                                  : "cursor-not-allowed"
                              }`}
                              onPointerDown={(event) => {
                                if (!canTrimStart) {
                                  return;
                                }

                                event.preventDefault();
                                event.stopPropagation();
                                setDragState({
                                  target: "clip",
                                  clipId: clip.id,
                                  mode: "start",
                                  startX: event.clientX,
                                  initialSourceStart: clip.sourceStart,
                                  initialSourceEnd: clip.sourceEnd,
                                });
                              }}
                            />
                            <span
                              role="presentation"
                              className="absolute inset-y-0 right-0 w-1.5 cursor-col-resize rounded-r-md border-l border-primary/80 bg-primary/35"
                              onPointerDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setDragState({
                                  target: "clip",
                                  clipId: clip.id,
                                  mode: "end",
                                  startX: event.clientX,
                                  initialSourceStart: clip.sourceStart,
                                  initialSourceEnd: clip.sourceEnd,
                                });
                              }}
                            />
                          </>
                        ) : null}
                        <div className="flex w-full items-center justify-between gap-2 truncate">
                          <span className="truncate">Clip {index + 1}</span>
                          <span className="shrink-0 text-[9px] uppercase tracking-[0.18em] text-inherit/70">
                            {formatTime(clipDuration)}
                          </span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
                    Load a recording to create clip segments.
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                <span>Effects</span>
                <span>{selectedEffectId ? "Editing effect" : "Zoom lane"}</span>
              </div>

              <div className="relative h-12 overflow-hidden rounded-md border border-border/60 bg-muted/25">
                {effects.length > 0 ? (
                  effects.map((effect) => {
                    const left =
                      duration > 0 ? (effect.startTime / duration) * 100 : 0;
                    const width =
                      duration > 0 ? (effect.length / duration) * 100 : 0;
                    const isSelected = effect.id === selectedEffectId;
                    const clampedLeft = Math.min(Math.max(left, 0), 100);
                    const remainingWidth = Math.max(100 - clampedLeft, 0);
                    const minVisualWidth = Math.min(
                      MIN_VISIBLE_BLOCK_PERCENT,
                      remainingWidth,
                    );
                    const visualWidth = Math.min(
                      Math.max(width, minVisualWidth),
                      remainingWidth,
                    );

                    return (
                      <button
                        key={effect.id}
                        type="button"
                        onClick={() => {
                          if (!dragMovedRef.current) {
                            selectEffect(effect.id);
                          }
                        }}
                        onPointerDown={(event) => {
                          if (!duration) {
                            return;
                          }

                          event.preventDefault();
                          selectEffect(effect.id);
                          setDragState({
                            target: "effect",
                            effectId: effect.id,
                            mode: "move",
                            startX: event.clientX,
                            initialStartTime: effect.startTime,
                            initialLength: effect.length,
                          });
                        }}
                        className={`absolute top-2 flex h-8 items-center rounded-md border px-2 text-left text-[10px] font-medium transition ${
                          isSelected
                            ? "border-primary bg-primary/20 text-foreground shadow-[0_0_0_1px_hsl(var(--primary))]"
                            : "border-border bg-muted/65 text-muted-foreground hover:border-primary/70 hover:bg-primary/10"
                        }`}
                        style={{
                          left: `${clampedLeft}%`,
                          width: `${visualWidth}%`,
                          zIndex: 5,
                        }}
                      >
                        {isSelected ? (
                          <>
                            <span
                              role="presentation"
                              className="absolute inset-y-0 left-0 w-1.5 cursor-col-resize rounded-l-md border-r border-primary/80 bg-primary/35"
                              onPointerDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setDragState({
                                  target: "effect",
                                  effectId: effect.id,
                                  mode: "start",
                                  startX: event.clientX,
                                  initialStartTime: effect.startTime,
                                  initialLength: effect.length,
                                });
                              }}
                            />
                            <span
                              role="presentation"
                              className="absolute inset-y-0 right-0 w-1.5 cursor-col-resize rounded-r-md border-l border-primary/80 bg-primary/35"
                              onPointerDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setDragState({
                                  target: "effect",
                                  effectId: effect.id,
                                  mode: "end",
                                  startX: event.clientX,
                                  initialStartTime: effect.startTime,
                                  initialLength: effect.length,
                                });
                              }}
                            />
                          </>
                        ) : null}
                        <span className="truncate">
                          Zoom x{effect.multiplier.toFixed(2)}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
                    Add Zoom from the sidebar to place an effect here.
                  </div>
                )}
              </div>
            </section>

            {(() => {
              if (!selectedEffectId) return null;
              const effect = effects.find((e) => e.id === selectedEffectId);
              if (!effect) return null;
              const strategy = getToolStrategy(effect.type);
              return strategy ? strategy.renderPanel() : null;
            })()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default EditorTimeline;
