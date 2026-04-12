import { FastForward, Pause, Play, Rewind } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { Button, Card, CardContent } from "@/components/ui";
import { useEditorStore } from "@/store/useEditorStore";
import { ZoomToolPanel } from "@/components/editor/tools";

type DragMode = "move" | "start" | "end";

type DragState = {
  effectId: string;
  mode: DragMode;
  startX: number;
  initialStartTime: number;
  initialLength: number;
};

const MIN_EFFECT_LENGTH = 0.1;

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
  const effects = useEditorStore((state) => state.effects);
  const selectedEffectId = useEditorStore((state) => state.selectedEffectId);
  const seekTo = useEditorStore((state) => state.seekTo);
  const jumpBy = useEditorStore((state) => state.jumpBy);
  const togglePlay = useEditorStore((state) => state.togglePlay);
  const selectEffect = useEditorStore((state) => state.selectEffect);
  const updateEffect = useEditorStore((state) => state.updateEffect);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragMovedRef = useRef(false);

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const onPointerMove = (event: PointerEvent) => {
      const trackWidth = trackRef.current?.clientWidth ?? 0;

      if (!duration || trackWidth <= 0) {
        return;
      }

      const deltaX = event.clientX - dragState.startX;

      if (Math.abs(deltaX) > 2) {
        dragMovedRef.current = true;
      }

      const deltaTime = (deltaX / trackWidth) * duration;

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
  }, [dragState, duration, updateEffect]);

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
            <Rewind size={16} />
          </Button>

          <Button
            type="button"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={togglePlay}
            disabled={duration <= 0}
            aria-label={isPlaying ? "Pause playback" : "Play playback"}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} weight="fill" />}
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
            <FastForward size={16} />
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

          <div className="relative h-12 overflow-hidden rounded-md border border-border/70 bg-background/70 shadow-[0_2px_0_var(--shadow-soft)]">
            <div ref={trackRef} className="absolute inset-0" />
            {effects.length > 0 ? (
              effects.map((effect) => {
                const left =
                  duration > 0 ? (effect.startTime / duration) * 100 : 0;
                const width =
                  duration > 0 ? (effect.length / duration) * 100 : 0;
                const isSelected = effect.id === selectedEffectId;
                const clampedLeft = Math.min(Math.max(left, 0), 100);
                const minVisualWidth = Math.min(
                  4,
                  Math.max(100 - clampedLeft, 0),
                );
                const visualWidth = Math.min(
                  Math.max(width, minVisualWidth),
                  Math.max(100 - clampedLeft, 0),
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

            <div
              className="pointer-events-none absolute inset-y-0 left-0 bg-primary/10 transition-[width] duration-150"
              style={{ width: `${progress}%` }}
            />
            <div
              className="pointer-events-none absolute inset-y-1 left-0 w-px bg-primary shadow-[0_0_10px_hsl(var(--primary)/45%)]"
              style={{ left: `${progress}%` }}
            />
          </div>

          {selectedEffectId ? <ZoomToolPanel key={selectedEffectId} /> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default EditorTimeline;
