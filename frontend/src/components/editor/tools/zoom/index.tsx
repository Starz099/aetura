import { useEffect, useRef, useState } from "react";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Separator,
} from "@/components/ui";
import {
  DEFAULT_ZOOM_ANCHOR,
  MIN_EFFECT_LENGTH,
} from "@/config/constants";
import { clamp, toNumber } from "@/lib/numbers";
import { useEditorStore } from "@/store/useEditorStore";

export function ZoomToolPanel() {
  const duration = useEditorStore((state) => state.duration);
  const selectedEffectId = useEditorStore((state) => state.selectedEffectId);
  const effects = useEditorStore((state) => state.effects);
  const effect =
    effects.find(
      (item) => item.id === selectedEffectId && item.type === "zoom",
    ) ?? null;
  const updateEffect = useEditorStore((state) => state.updateEffect);
  const removeEffect = useEditorStore((state) => state.removeEffect);
  const selectEffect = useEditorStore((state) => state.selectEffect);

  const [draftStartTime, setDraftStartTime] = useState(
    () => effect?.startTime ?? 0,
  );
  const [draftLength, setDraftLength] = useState(
    () => effect?.length ?? MIN_EFFECT_LENGTH,
  );
  const [draftMultiplier, setDraftMultiplier] = useState(
    () => effect?.multiplier ?? 1,
  );
  const [draftAnchor, setDraftAnchor] = useState(
    () => effect?.anchor ?? DEFAULT_ZOOM_ANCHOR,
  );
  const focusAreaRef = useRef<HTMLDivElement | null>(null);
  const isDraggingAnchorRef = useRef(false);

  const updateDraftAnchorFromPoint = (clientX: number, clientY: number) => {
    const element = focusAreaRef.current;

    if (!element) {
      return;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    const nextX = clamp((clientX - rect.left) / rect.width, 0, 1);
    const nextY = clamp((clientY - rect.top) / rect.height, 0, 1);

    setDraftAnchor({ x: nextX, y: nextY });
  };

  // Sync draft state with store updates (e.g. from timeline dragging)
  useEffect(() => {
    if (effect) {
      (() => {
        setDraftStartTime(effect.startTime);
        setDraftLength(effect.length);
        setDraftMultiplier(effect.multiplier);
        setDraftAnchor(effect.anchor);
      })();
    }
  }, [effect?.startTime, effect?.length, effect?.multiplier, effect]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!isDraggingAnchorRef.current) {
        return;
      }

      updateDraftAnchorFromPoint(event.clientX, event.clientY);
    };

    const handlePointerUp = () => {
      isDraggingAnchorRef.current = false;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, []);

  if (!effect || !selectedEffectId) {
    return null;
  }

  const safeDuration = Number.isFinite(duration) ? Math.max(duration, 0) : 0;
  const maxStart = safeDuration > 0 ? safeDuration : Number.POSITIVE_INFINITY;
  const startTime = clamp(draftStartTime, 0, maxStart);
  const maxLength =
    safeDuration > 0
      ? Math.max(safeDuration - startTime, MIN_EFFECT_LENGTH)
      : Number.POSITIVE_INFINITY;
  const length = clamp(draftLength, MIN_EFFECT_LENGTH, maxLength);
  const multiplier = clamp(draftMultiplier, 1, 4);
  const anchor = {
    x: clamp(draftAnchor.x, 0, 1),
    y: clamp(draftAnchor.y, 0, 1),
  };

  return (
    <Card className="border-border/90 bg-card/90">
      <CardHeader className="pb-2">
        <CardTitle>Zoom Tool</CardTitle>
        <CardDescription>
          Controls for the selected timeline effect.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="grid gap-1.5">
            <Label htmlFor="zoom-start">Start time</Label>
            <Input
              id="zoom-start"
              type="number"
              min={0}
              max={duration || undefined}
              step="0.01"
              value={startTime}
              onChange={(event) => {
                setDraftStartTime(
                  clamp(toNumber(event.target.value), 0, maxStart),
                );
              }}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="zoom-length">Length</Label>
            <Input
              id="zoom-length"
              type="number"
              min={0.1}
              max={duration || undefined}
              step="0.01"
              value={length}
              onChange={(event) => {
                setDraftLength(
                  clamp(toNumber(event.target.value), MIN_EFFECT_LENGTH, maxLength),
                );
              }}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="zoom-multiplier">Zoom multiplier</Label>
            <Input
              id="zoom-multiplier"
              type="number"
              min={1}
              max={4}
              step="0.01"
              value={multiplier}
              onChange={(event) => {
                setDraftMultiplier(clamp(toNumber(event.target.value), 1, 4));
              }}
            />
          </div>

          <div className="grid gap-1.5">
            <div className="flex items-end justify-between gap-2">
              <Label>Focus point</Label>
              <span className="text-[11px] text-muted-foreground">
                Drag the dot to change where the zoom locks on.
              </span>
            </div>
            <div
              ref={focusAreaRef}
              className="relative aspect-square max-h-56 w-full overflow-hidden rounded-xl border-2 border-border/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] shadow-[0_3px_0_var(--shadow-soft)]"
              onPointerDown={(event) => {
                isDraggingAnchorRef.current = true;
                updateDraftAnchorFromPoint(event.clientX, event.clientY);
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerUp={() => {
                isDraggingAnchorRef.current = false;
              }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.10),transparent_55%)]" />
              <div className="absolute inset-0">
                <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border/40" />
                <div className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-border/40" />
              </div>
              <div
                className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow-[0_0_0_4px_rgba(255,255,255,0.14)]"
                style={{
                  left: `${anchor.x * 100}%`,
                  top: `${anchor.y * 100}%`,
                }}
              />
              <div className="absolute bottom-2 left-2 rounded-full border border-border/70 bg-background/80 px-2 py-1 text-[10px] font-medium text-foreground shadow-[0_2px_0_var(--shadow-soft)]">
                X {Math.round(anchor.x * 100)}% Y {Math.round(anchor.y * 100)}%
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={() => {
              updateEffect(effect.id, {
                startTime,
                length,
                multiplier,
                anchor,
              });
              selectEffect(null);
            }}
          >
            Save
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => {
              removeEffect(effect.id);
              selectEffect(null);
            }}
          >
            Remove
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default ZoomToolPanel;
