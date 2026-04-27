import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Separator,
} from "@/components/ui";
import { useEditorStore } from "@/store/useEditorStore";
import { BACKGROUND_PRESETS } from "./presets";

import {
  MIN_BACKGROUND_PADDING,
  MIN_BACKGROUND_ROUNDEDNESS,
  MAX_BACKGROUND_PADDING,
  MAX_BACKGROUND_ROUNDEDNESS,
} from "@/store/useEditorStore";

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export function BackgroundToolPanel() {
  const backgroundSettings = useEditorStore(
    (state) => state.backgroundSettings,
  );
  const updateBackgroundSettings = useEditorStore(
    (state) => state.updateBackgroundSettings,
  );
  const resetBackgroundSettings = useEditorStore(
    (state) => state.resetBackgroundSettings,
  );

  return (
    <Card className="border-border/90 bg-card/90">
      <CardHeader className="pb-2">
        <CardTitle>Background Tool</CardTitle>
        <CardDescription>
          Apply a global wallpaper and equal padding on all sides.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label>Wallpaper preset</Label>
          <div className="grid grid-cols-2 gap-2">
            {BACKGROUND_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                variant={
                  backgroundSettings.presetId === preset.id
                    ? "secondary"
                    : "outline"
                }
                onClick={() => {
                  updateBackgroundSettings({
                    enabled: true,
                    presetId: preset.id,
                  });
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
        <Separator />

        <div className="flex w-full gap-4">
          <div className="space-y-2 flex-1">
            <Label htmlFor="background-padding-slider">
              Padding ({Math.round(backgroundSettings.padding)}px)
            </Label>
            <input
              id="background-padding-slider"
              type="range"
              min={MIN_BACKGROUND_PADDING}
              max={MAX_BACKGROUND_PADDING}
              step={1}
              value={clamp(
                backgroundSettings.padding,
                MIN_BACKGROUND_PADDING,
                MAX_BACKGROUND_PADDING,
              )}
              onChange={(event) => {
                updateBackgroundSettings({
                  enabled: true,
                  padding: clamp(
                    Number(event.target.value),
                    MIN_BACKGROUND_PADDING,
                    MAX_BACKGROUND_PADDING,
                  ),
                });
              }}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-border/70"
              aria-label="Background padding"
            />
          </div>

          <div className="space-y-2 flex-1">
            <Label htmlFor="background-roundedness-slider">
              Roundedness ({Math.round(backgroundSettings.roundedness)}px)
            </Label>
            <input
              id="background-roundedness-slider"
              type="range"
              min={MIN_BACKGROUND_ROUNDEDNESS}
              max={MAX_BACKGROUND_ROUNDEDNESS}
              step={1}
              value={clamp(
                backgroundSettings.roundedness,
                MIN_BACKGROUND_ROUNDEDNESS,
                MAX_BACKGROUND_ROUNDEDNESS,
              )}
              onChange={(event) => {
                updateBackgroundSettings({
                  enabled: true,
                  roundedness: clamp(
                    Number(event.target.value),
                    MIN_BACKGROUND_ROUNDEDNESS,
                    MAX_BACKGROUND_ROUNDEDNESS,
                  ),
                });
              }}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-border/70"
              aria-label="Background roundedness"
            />
          </div>
        </div>
        <Separator />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={backgroundSettings.enabled ? "secondary" : "outline"}
            className="flex-1"
            onClick={() => {
              updateBackgroundSettings({
                enabled: !backgroundSettings.enabled,
              });
            }}
          >
            {backgroundSettings.enabled ? "Enabled" : "Disabled"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => resetBackgroundSettings()}
          >
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default BackgroundToolPanel;
