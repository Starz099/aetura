import { useEffect, useRef } from "react";

import { Card, CardContent } from "@/components/ui";
import { useEditorStore } from "@/assets/store/useEditorStore";

interface EditorPreviewProps {
  previewUrl: string | null;
}

export function EditorPreview({ previewUrl }: EditorPreviewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const currentTime = useEditorStore((state) => state.currentTime);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const setCurrentTime = useEditorStore((state) => state.setCurrentTime);
  const setDuration = useEditorStore((state) => state.setDuration);
  const setIsPlaying = useEditorStore((state) => state.setIsPlaying);

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

    if (isPlaying && video.paused) {
      void video.play().catch(() => {
        setIsPlaying(false);
      });
      return;
    }

    if (!isPlaying && !video.paused) {
      video.pause();
    }
  }, [isPlaying, setIsPlaying]);

  return (
    <Card className="min-h-0 flex-1">
      <CardContent className="flex h-full min-h-0">
        <div className="flex h-full min-h-90 w-full items-center justify-center rounded-md border-2 border-border/80 bg-muted/45 shadow-[0_3px_0_var(--shadow-soft)]">
          {previewUrl ? (
            <video
              ref={videoRef}
              src={previewUrl}
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
