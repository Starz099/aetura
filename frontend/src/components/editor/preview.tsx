import { useEffect, useRef, useState } from "react";

import { Button, Card, CardContent } from "@/components/ui";
import {
  findClipAtSourceTime,
  findNextClipAfterSourceTime,
  mapTimelineTimeToSourceTime,
} from "@/lib/editorTimeline";
import { getBackgroundPreset } from "@/components/editor/tools/background/presets";
import { useEditorStore, DEFAULT_ZOOM_ANCHOR } from "@/store/useEditorStore";
import {
  MAX_BACKGROUND_PADDING,
  MAX_BACKGROUND_ROUNDEDNESS,
  MIN_BACKGROUND_PADDING,
  MIN_BACKGROUND_ROUNDEDNESS,
  TIMELINE_TIME_UPDATE_THROTTLE_MS,
} from "@/config/constants";
import type { EditorPreviewProps } from "@/types/ui";

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
  const clips = useEditorStore((state) => state.clips);
  const activeZoomEffect = useEditorStore(
    (state) =>
      state.effects.find(
        (effect) =>
          effect.type === "zoom" &&
          currentTime >= effect.startTime &&
          currentTime <= effect.startTime + effect.length,
      ) ?? null,
  );
  const initializeTimeline = useEditorStore(
    (state) => state.initializeTimeline,
  );
  const setCurrentTime = useEditorStore((state) => state.setCurrentTime);
  const setIsPlaying = useEditorStore((state) => state.setIsPlaying);
  const backgroundSettings = useEditorStore(
    (state) => state.backgroundSettings,
  );
  const zoomScale = activeZoomEffect?.multiplier ?? 1;
  const zoomAnchor = activeZoomEffect?.anchor ?? DEFAULT_ZOOM_ANCHOR;
  const backgroundPreset = getBackgroundPreset(backgroundSettings.presetId);
  const previewPadding = backgroundSettings.enabled
    ? Math.min(
        Math.max(backgroundSettings.padding, MIN_BACKGROUND_PADDING),
        MAX_BACKGROUND_PADDING,
      )
    : 0;
  const previewBorderRadius = backgroundSettings.enabled
    ? Math.min(
        Math.max(backgroundSettings.roundedness, MIN_BACKGROUND_ROUNDEDNESS),
        MAX_BACKGROUND_ROUNDEDNESS,
      )
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
    const mappedSourceTime = mapTimelineTimeToSourceTime(clips, currentTime);

    if (Math.abs(video.currentTime - mappedSourceTime) > seekThreshold) {
      video.currentTime = mappedSourceTime;
    }
  }, [autoPlay, clips, currentTime, isPlaying, thumbnailMode]);

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
        <div className="relative h-full w-full overflow-hidden border-2 border-border/80 bg-muted/45 shadow-[0_3px_0_var(--shadow-soft)]">
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
                  className="absolute inset-0 overflow-hidden"
                  style={{
                    top: `${previewPadding}px`,
                    right: `${previewPadding}px`,
                    bottom: `${previewPadding}px`,
                    left: `${previewPadding}px`,
                  }}
                >
                  <div className="flex h-full w-full items-center justify-center">
                    <video
                      ref={videoRef}
                      src={previewUrl}
                      autoPlay={autoPlay}
                      playsInline
                      muted={isMuted}
                      className="h-full w-full bg-transparent object-cover object-center"
                      style={{
                        borderRadius: `${previewBorderRadius}px`,
                        transform: `scale(${zoomScale})`,
                        transformOrigin: `${zoomAnchor.x * 100}% ${zoomAnchor.y * 100}%`,
                        transition: "transform 150ms ease-out",
                      }}
                      onLoadedMetadata={(event) => {
                        // Keep the thumbnail/export preview read-only so it does not
                        // reset the editor timeline back to a single clip.
                        if (!thumbnailMode) {
                          initializeTimeline(
                            previewUrl ?? event.currentTarget.currentSrc,
                            event.currentTarget.duration,
                          );
                        }

                        if (thumbnailMode) {
                          event.currentTarget.currentTime = 0;
                        }
                      }}
                      onTimeUpdate={(event) => {
                        const video = event.currentTarget;
                        const now = performance.now();

                        if (
                          now - lastTimelinePushMsRef.current <
                          TIMELINE_TIME_UPDATE_THROTTLE_MS
                        ) {
                          return;
                        }

                        const timelineMatch = findClipAtSourceTime(
                          clips,
                          video.currentTime,
                        );

                        if (timelineMatch) {
                          const nextTime =
                            timelineMatch.clip.timelineStart +
                            timelineMatch.localTime;

                          if (Math.abs(nextTime - currentTime) > 0.01) {
                            lastTimelinePushMsRef.current = now;
                            setCurrentTime(nextTime);
                          }

                          return;
                        }

                        const nextClip = findNextClipAfterSourceTime(
                          clips,
                          video.currentTime,
                        );

                        if (nextClip) {
                          lastTimelinePushMsRef.current = now;

                          if (typeof video.fastSeek === "function") {
                            video.fastSeek(nextClip.clip.sourceStart);
                          } else {
                            video.currentTime = nextClip.clip.sourceStart;
                          }

                          setCurrentTime(nextClip.clip.timelineStart);
                          return;
                        }

                        if (clips.length > 0) {
                          const lastClip = clips[clips.length - 1];

                          if (video.currentTime >= lastClip.sourceEnd) {
                            lastTimelinePushMsRef.current = now;
                            video.pause();
                            setCurrentTime(
                              lastClip.timelineStart +
                                (lastClip.sourceEnd - lastClip.sourceStart),
                            );
                            setIsPlaying(false);
                          }
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
