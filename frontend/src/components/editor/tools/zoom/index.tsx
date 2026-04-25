import { useEffect, useState } from "react";

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
import { useEditorStore } from "@/store/useEditorStore";

const toNumber = (value: string) => {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const MIN_LENGTH = 0.1;

export function ZoomToolPanel() {
  const duration = useEditorStore((state) => state.duration);
  const selectedEffectId = useEditorStore((state) => state.selectedEffectId);
  const effect = useEditorStore(
    (state) =>
      state.effects.find(
        (item) => item.id === state.selectedEffectId && item.type === "zoom",
      ) ?? null,
  );
  const updateEffect = useEditorStore((state) => state.updateEffect);
  const removeEffect = useEditorStore((state) => state.removeEffect);
  const selectEffect = useEditorStore((state) => state.selectEffect);

  const [draftStartTime, setDraftStartTime] = useState(
    () => effect?.startTime ?? 0,
  );
  const [draftLength, setDraftLength] = useState(
    () => effect?.length ?? MIN_LENGTH,
  );
  const [draftMultiplier, setDraftMultiplier] = useState(
    () => effect?.multiplier ?? 1,
  );

  // Sync draft state with store updates (e.g. from timeline dragging)
  useEffect(() => {
    if (effect) {
      setDraftStartTime(effect.startTime);
      setDraftLength(effect.length);
      setDraftMultiplier(effect.multiplier);
    }
  }, [effect?.startTime, effect?.length, effect?.multiplier]);

  if (!effect || !selectedEffectId) {
    return null;
  }

  const safeDuration = Number.isFinite(duration) ? Math.max(duration, 0) : 0;
  const maxStart = safeDuration > 0 ? safeDuration : Number.POSITIVE_INFINITY;
  const startTime = clamp(draftStartTime, 0, maxStart);
  const maxLength =
    safeDuration > 0
      ? Math.max(safeDuration - startTime, MIN_LENGTH)
      : Number.POSITIVE_INFINITY;
  const length = clamp(draftLength, MIN_LENGTH, maxLength);
  const multiplier = clamp(draftMultiplier, 1, 4);

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
                  clamp(toNumber(event.target.value), MIN_LENGTH, maxLength),
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
