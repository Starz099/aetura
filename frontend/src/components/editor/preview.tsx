import { useEffect, useRef, useState } from "react";

import { Button, Card, CardContent } from "@/components/ui";
import { useEditorStore } from "@/store/useEditorStore";
import { getBackgroundPreset } from "@/components/editor/tools/background/presets";

interface EditorPreviewProps {
  previewUrl: string | null;
  autoPlay?: boolean;
  showMuteToggle?: boolean;
  thumbnailMode?: boolean;
}

export function EditorPreview({
  previewUrl,
  autoPlay = false,
  showMuteToggle = false,
  thumbnailMode = false,
}: EditorPreviewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastTimelinePushMsRef = useRef(0);
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
  const backgroundSettings = useEditorStore(
    (state) => state.backgroundSettings,
  );
  const zoomScale = activeZoomEffect?.multiplier ?? 1;
  const backgroundPreset = getBackgroundPreset(backgroundSettings.presetId);
  const previewPadding = backgroundSettings.enabled
    ? Math.min(Math.max(backgroundSettings.padding, 0), 64)
    : 0;
  const backgroundImageUrl =
    backgroundSettings.enabled && backgroundPreset
      ? `url(${backgroundPreset.imageUrl})`
      : undefined;

  useEffect(() => {
    if (autoPlay || thumbnailMode) {
      return;
    }

    const video = videoRef.current;

    if (!video) {
      return;
    }

    const seekThreshold = isPlaying ? 0.25 : 0.05;

    if (Math.abs(video.currentTime - currentTime) > seekThreshold) {
      video.currentTime = currentTime;
    }
  }, [autoPlay, thumbnailMode, isPlaying, currentTime]);

  useEffect(() => {
    if (thumbnailMode) {
      return;
    }

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
  }, [autoPlay, isPlaying, setIsPlaying, thumbnailMode]);

  useEffect(() => {
    if (!autoPlay || thumbnailMode) {
      return;
    }

    const video = videoRef.current;

    if (!video) {
      return;
    }

    // Ensure export preview always starts playing when opened.
    video.currentTime = 0;
    void video.play().catch(() => {
      // Ignore autoplay interruptions; user can still unmute/play manually.
    });
  }, [autoPlay, previewUrl, thumbnailMode]);

  useEffect(() => {
    if (!thumbnailMode) {
      return;
    }

    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.pause();
    video.currentTime = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  }, [thumbnailMode, previewUrl, setCurrentTime, setIsPlaying]);

  return (
    <Card className="min-h-0 flex-1">
      <CardContent className="flex h-full min-h-0 items-center justify-center p-2">
        <div className="relative h-full w-full overflow-hidden rounded-md border-2 border-border/80 bg-muted/45 shadow-[0_3px_0_var(--shadow-soft)]">
          {previewUrl ? (
            <>
              {activeZoomEffect ? (
                <div className="absolute left-3 top-3 z-10 rounded-full border border-border/70 bg-background/90 px-2 py-1 text-[10px] font-medium shadow-[0_2px_0_var(--shadow-soft)]">
                  Zoom x{activeZoomEffect.multiplier.toFixed(2)}
                </div>
              ) : null}
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: backgroundImageUrl,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    top: `${previewPadding}px`,
                    right: `${previewPadding}px`,
                    bottom: `${previewPadding}px`,
                    left: `${previewPadding}px`,
                  }}
                >
                  <div
                    className="flex h-full w-full items-center justify-center origin-center transition-transform duration-150 ease-out"
                    style={{ transform: `scale(${zoomScale})` }}
                  >
                    <video
                      ref={videoRef}
                      src={previewUrl}
                      autoPlay={autoPlay}
                      playsInline
                      muted={isMuted}
                      className="h-full w-full rounded-md bg-transparent object-cover object-center"
                      onLoadedMetadata={(event) => {
                        setDuration(event.currentTarget.duration);
                        if (thumbnailMode) {
                          event.currentTarget.currentTime = 0;
                        }
                      }}
                      onTimeUpdate={(event) => {
                        const nextTime = event.currentTarget.currentTime;
                        const now = performance.now();

                        // Avoid flooding global state updates while keeping timeline smooth.
                        if (now - lastTimelinePushMsRef.current < 75) {
                          return;
                        }

                        if (Math.abs(nextTime - currentTime) > 0.01) {
                          lastTimelinePushMsRef.current = now;
                          setCurrentTime(nextTime);
                        }
                      }}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                    />
                  </div>
                </div>
              </div>
              {showMuteToggle && !thumbnailMode ? (
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
