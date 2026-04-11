import { FastForward, Pause, Play, Rewind } from "@phosphor-icons/react";

import { Button, Card, CardContent } from "@/components/ui";
import { useEditorStore } from "@/assets/store/useEditorStore";

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
  const seekTo = useEditorStore((state) => state.seekTo);
  const jumpBy = useEditorStore((state) => state.jumpBy);
  const togglePlay = useEditorStore((state) => state.togglePlay);

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
            <div
              className="absolute inset-y-0 left-0 bg-primary/25 transition-[width] duration-150"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute inset-y-1 left-0 w-px bg-primary shadow-[0_0_10px_hsl(var(--primary)/45%)]"
              style={{ left: `${progress}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default EditorTimeline;
