import { useEffect, useRef, useState } from "react";

import { Button, Card, CardContent } from "@/components/ui";
import { useEditorStore } from "@/store/useEditorStore";

interface EditorPreviewProps {
  previewUrl: string | null;
  autoPlay?: boolean;
  showMuteToggle?: boolean;
}

export function EditorPreview({
  previewUrl,
  autoPlay = false,
  showMuteToggle = false,
}: EditorPreviewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const currentTime = useEditorStore((state) => state.currentTime);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const activeZoomEffect = useEditorStore(
    (state) =>
      state.effects.find(
        (effect) =>
          effect.type === "zoom" &&
          currentTime >= effect.startTime &&
          currentTime <= effect.startTime + effect.length,
      ) ?? null,
  );
  const setCurrentTime = useEditorStore((state) => state.setCurrentTime);
  const setDuration = useEditorStore((state) => state.setDuration);
  const setIsPlaying = useEditorStore((state) => state.setIsPlaying);
  const zoomScale = activeZoomEffect?.multiplier ?? 1;

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (Math.abs(video.currentTime - currentTime) > 0.05) {
      video.currentTime = currentTime;
    }
  }, [currentTime]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const shouldPlay = autoPlay || isPlaying;

    if (shouldPlay && video.paused) {
      void video.play().catch(() => {
        setIsPlaying(false);
      });
      return;
    }

    if (!shouldPlay && !video.paused) {
      video.pause();
    }
  }, [autoPlay, isPlaying, setIsPlaying]);

  return (
    <Card className="min-h-0 flex-1">
      <CardContent className="flex h-full min-h-0">
        <div className="relative flex h-full min-h-90 w-full items-center justify-center overflow-hidden rounded-md border-2 border-border/80 bg-muted/45 shadow-[0_3px_0_var(--shadow-soft)]">
          {previewUrl ? (
            <>
              {activeZoomEffect ? (
                <div className="absolute left-3 top-3 z-10 rounded-full border border-border/70 bg-background/90 px-2 py-1 text-[10px] font-medium shadow-[0_2px_0_var(--shadow-soft)]">
                  Zoom x{activeZoomEffect.multiplier.toFixed(2)}
                </div>
              ) : null}
              <div
                className="origin-center transition-transform duration-150 ease-out"
                style={{ transform: `scale(${zoomScale})` }}
              >
                <video
                  ref={videoRef}
                  src={previewUrl}
                  muted={isMuted}
                  className="h-full w-full rounded-md bg-black object-contain"
                  onLoadedMetadata={(event) => {
                    setDuration(event.currentTarget.duration);
                  }}
                  onTimeUpdate={(event) => {
                    setCurrentTime(event.currentTarget.currentTime);
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
              </div>
              {showMuteToggle ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="absolute bottom-3 right-3 z-10 h-8 rounded-full px-3 text-[11px] shadow-[0_2px_0_var(--shadow-soft)]"
                  onClick={() => setIsMuted((current) => !current)}
                >
                  {isMuted ? "Unmute" : "Mute"}
                </Button>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Preview will appear after you load a recording.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default EditorPreview;
