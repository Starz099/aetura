import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
  Textarea,
} from "@/components/ui";
import { Button } from "@/components/ui";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  buildExportRequest,
  useEditorStore,
} from "@/store/useEditorStore";
import type { ExportFormat, ExportResolution } from "@/types/export";
import { useSettingsStore } from "@/store/useSettingsStore";
import { EditorPreview } from "@/components/editor/preview";
import { EditorTimeline } from "@/components/editor/timeline";
import { BackgroundToolPanel } from "@/components/editor/tools";
import { useExport } from "@/services/export";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";

const editorTools = [
  { label: "Cut", action: "cut" },
  { label: "Zoom", action: "zoom" },
  { label: "Background", action: "background" },
] as const;
const selectedOptionClass =
  "!border-primary/60 !bg-primary/10 !text-primary shadow-[0_2px_0_var(--shadow-soft)]";

const EditorPage = () => {
  const { address } = useParams();
  const [searchParams] = useSearchParams();
  const recordingSrc = searchParams.get("src");
  const recordingUrl = useMemo(() => {
    if (recordingSrc) {
      return recordingSrc;
    }

    if (!address) {
      return null;
    }

    try {
      return decodeURIComponent(address);
    } catch {
      return address;
    }
  }, [address, recordingSrc]);
  const {
    status,
    isExporting,
    isSuccess,
    outputPath,
    message,
    progressPercent,
    export: handleExport,
    cancel: cancelExport,
  } = useExport();
  const [showExportSettings, setShowExportSettings] = useState(false);
  const [showBackgroundSettings, setShowBackgroundSettings] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("mp4");
  const [selectedResolution, setSelectedResolution] =
    useState<ExportResolution>("1080p");
  const [selectedFps, setSelectedFps] = useState<15 | 30 | 60>(60);
  const [copied, setCopied] = useState(false);

  const resetTimeline = useEditorStore((state) => state.resetTimeline);
  const addZoomEffect = useEditorStore((state) => state.addZoomEffect);
  const selectEffect = useEditorStore((state) => state.selectEffect);
  const effects = useEditorStore((state) => state.effects);
  const backgroundSettings = useEditorStore(
    (state) => state.backgroundSettings,
  );
  const duration = useEditorStore((state) => state.duration);
  const clips = useEditorStore((state) => state.clips);
  const sourceUrl = useEditorStore((state) => state.sourceUrl);
  const cutSelectedClipAtCurrentTime = useEditorStore(
    (state) => state.cutSelectedClipAtCurrentTime,
  );
  const defaultExportDirectory = useSettingsStore(
    (state) => state.defaultExportDirectory,
  );

  const previewUrl = useMemo(() => {
    if (!recordingUrl) {
      return null;
    }

    if (
      recordingUrl.startsWith("http://") ||
      recordingUrl.startsWith("https://")
    ) {
      try {
        const parsed = new URL(recordingUrl);
        parsed.pathname = parsed.pathname
          .split("/")
          .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
          .join("/");
        return parsed.toString();
      } catch {
        return recordingUrl;
      }
    }

    return `http://localhost:8000/recordings/${encodeURIComponent(
      recordingUrl.split(/[\\/]/).pop() || "",
    )}`;
  }, [recordingUrl]);

  const onExport = async () => {
    if (!previewUrl || !sourceUrl) {
      alert("No source video loaded.");
      return;
    }

    setCopied(false);

    // Log clip data for debugging
    console.group("EXPORT DEBUG");
    console.log("Source URL:", sourceUrl);
    console.log("Timeline Duration:", duration, "seconds");
    console.log(`Number of Clips: ${clips.length}`);

    if (clips.length === 0) {
      console.warn("WARNING: No clips in timeline! Export may fail.");
    }

    clips.forEach((clip, idx) => {
      const clipDuration = clip.sourceEnd - clip.sourceStart;
      console.log(
        `  Clip ${idx}: [${clip.sourceStart.toFixed(2)}s - ${clip.sourceEnd.toFixed(2)}s] (duration: ${clipDuration.toFixed(2)}s) @ timeline ${clip.timelineStart.toFixed(2)}s`,
      );
    });

    const exportRequest = buildExportRequest(
      sourceUrl,
      clips,
      duration,
      effects,
      backgroundSettings,
      {
        format: selectedFormat,
        resolution: selectedResolution,
        fps: selectedFps,
      },
    );

    console.log(`Export Request:`);
    console.log(` - Total Duration: ${exportRequest.duration}s`);
    console.log(` - Segments Count: ${exportRequest.segments.length}`);
    exportRequest.segments.forEach((seg, idx) => {
      const segDuration = seg.outPoint - seg.inPoint;
      console.log(
        `    Segment ${idx}: [${seg.inPoint.toFixed(2)}s - ${seg.outPoint.toFixed(2)}s] (duration: ${segDuration.toFixed(2)}s)`,
      );
    });
    console.groupEnd();

    // Intentionally do not await here to avoid losing immediate processing UI
    // in environments where invoke timing can resolve unexpectedly early.
    void handleExport(exportRequest, defaultExportDirectory.trim() || null);
  };

  const onOpenExportSettings = () => {
    if (!previewUrl) {
      alert("No source video loaded.");
      return;
    }

    setShowExportSettings(true);
  };

  const onOpenFolder = async () => {
    if (!outputPath) return;
    try {
      // Use the custom backend command which handles WSL path conversion
      await invoke("open_path_in_explorer", { path: outputPath });
    } catch (err) {
      console.error(
        "Failed to open file location via custom command, trying plugin:",
        err,
      );
      try {
        await revealItemInDir(outputPath);
      } catch (pluginErr) {
        console.error("Failed to open file location via plugin:", pluginErr);
      }
    }
  };

  const onCopyToClipboard = async () => {
    if (!outputPath) return;
    try {
      await invoke("copy_file_to_clipboard", { path: outputPath });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy video to clipboard:", err);
    }
  };

  const isActivelyProcessing = isExporting;

  const shouldShowProgress =
    isActivelyProcessing ||
    progressPercent > 0 ||
    status === "success" ||
    status === "cancelled";

  const progressLabel = isActivelyProcessing
    ? "Export progress"
    : status === "success"
      ? "Export complete"
      : status === "cancelled"
        ? "Export cancelled"
        : "Export progress";

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Aetura Editor";

    return () => {
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    resetTimeline();
  }, [previewUrl, resetTimeline]);

  useEffect(() => {
    if (!showExportSettings && !showBackgroundSettings) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showExportSettings, showBackgroundSettings]);

  if (showExportSettings) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Export Demo
            </h1>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_420px]">
          <section className="flex h-full min-h-0 overflow-hidden">
            <EditorPreview
              key={previewUrl ?? "export-preview"}
              previewUrl={previewUrl}
              thumbnailMode
            />
          </section>

          <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border-2 border-border bg-card shadow-[0_4px_0_var(--shadow-strong)]">
            <CardHeader className="border-b py-3">
              <CardTitle>Export Settings</CardTitle>
              <CardDescription>
                Placeholder controls inspired by CapCut-style export flow.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4">
              <section className="space-y-2">
                <p className="text-sm font-medium">Destination</p>
                <div
                  className={`h-12 rounded-md border-2 ${selectedOptionClass} flex items-center justify-center bg-card px-4 text-sm font-semibold`}
                >
                  File
                </div>
                <p className="text-[11px] text-muted-foreground">
                  File export is enabled. Other destinations will be added
                  later.
                </p>
              </section>

              <section className="space-y-2">
                <p className="text-sm font-medium">Format</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className={`h-11 ${
                      selectedFormat === "mp4" ? selectedOptionClass : ""
                    }`}
                    onClick={() => setSelectedFormat("mp4")}
                    disabled={isActivelyProcessing}
                  >
                    MP4
                  </Button>
                  <Button
                    variant="outline"
                    className={`h-11 ${
                      selectedFormat === "gif" ? selectedOptionClass : ""
                    }`}
                    onClick={() => setSelectedFormat("gif")}
                    disabled={isActivelyProcessing}
                  >
                    GIF
                  </Button>
                </div>
              </section>

              <section className="space-y-2">
                <p className="text-sm font-medium">Resolution</p>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    className={`h-11 ${
                      selectedResolution === "720p" ? selectedOptionClass : ""
                    }`}
                    onClick={() => setSelectedResolution("720p")}
                    disabled={isActivelyProcessing}
                  >
                    720p
                  </Button>
                  <Button
                    variant="outline"
                    className={`h-11 ${
                      selectedResolution === "1080p" ? selectedOptionClass : ""
                    }`}
                    onClick={() => setSelectedResolution("1080p")}
                    disabled={isActivelyProcessing}
                  >
                    1080p
                  </Button>
                  <Button
                    variant="outline"
                    className={`h-11 ${
                      selectedResolution === "4k" ? selectedOptionClass : ""
                    }`}
                    onClick={() => setSelectedResolution("4k")}
                    disabled={isActivelyProcessing}
                  >
                    4K
                  </Button>
                </div>
              </section>

              <section className="space-y-2">
                <p className="text-sm font-medium">Frame Rate</p>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    className={`h-11 ${selectedFps === 15 ? selectedOptionClass : ""}`}
                    onClick={() => setSelectedFps(15)}
                    disabled={isActivelyProcessing}
                  >
                    15
                  </Button>
                  <Button
                    variant="outline"
                    className={`h-11 ${selectedFps === 30 ? selectedOptionClass : ""}`}
                    onClick={() => setSelectedFps(30)}
                    disabled={isActivelyProcessing}
                  >
                    30
                  </Button>
                  <Button
                    variant="outline"
                    className={`h-11 ${selectedFps === 60 ? selectedOptionClass : ""}`}
                    onClick={() => setSelectedFps(60)}
                    disabled={isActivelyProcessing}
                  >
                    60
                  </Button>
                </div>
              </section>

              <div className="rounded-md border border-border bg-muted/25 p-3 text-xs text-muted-foreground">
                {message
                  ? message
                  : isActivelyProcessing
                    ? "Rendering export..."
                    : `Selected: FILE • ${selectedFormat.toUpperCase()} • ${selectedResolution.toUpperCase()} • ${selectedFps} FPS.`}
              </div>
            </CardContent>

            <div className="space-y-2 border-t p-3">
              {shouldShowProgress ? (
                <section className="space-y-2 pb-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{progressLabel}</span>
                    <span>{Math.round(progressPercent)}%</span>
                  </div>
                  <div
                    className="h-2 w-full overflow-hidden rounded-full border border-border/60 bg-muted/40"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progressPercent)}
                    aria-label="Export progress"
                  >
                    <div
                      className="h-full bg-primary transition-[width] duration-150 ease-linear"
                      style={{
                        width: `${Math.max(0, Math.min(100, progressPercent))}%`,
                      }}
                    />
                  </div>
                </section>
              ) : null}

              <Button
                className="w-full"
                size="lg"
                onClick={onExport}
                disabled={isActivelyProcessing}
              >
                {isActivelyProcessing ? "Exporting..." : "Export to File"}
              </Button>

              {isSuccess && outputPath ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={onOpenFolder}
                  >
                    open file location
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={onCopyToClipboard}
                  >
                    {copied ? "copied!" : "copy to clipboard"}
                  </Button>
                </div>
              ) : null}

              {isActivelyProcessing ? (
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={cancelExport}
                >
                  Cancel Export
                </Button>
              ) : null}
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setShowExportSettings(false)}
                disabled={isActivelyProcessing}
              >
                Back to Editor
              </Button>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-auto p-3 sm:p-4">
      <CardContent className="flex min-h-0 flex-1 p-0">
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[280px_minmax(0,1fr)_76px]">
          <section className="flex min-h-0 flex-col gap-3">
            <Card size="sm" className="h-auto relative">
              <CardHeader className="pb-1">
                <CardTitle>Project Info</CardTitle>
                <CardDescription>Session details and source.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full" variant="secondary">
                  Import Assets
                </Button>
                <div className="rounded-md border border-dashed border-border bg-muted/45 p-2 text-[11px] text-muted-foreground shadow-[0_2px_0_var(--shadow-soft)]">
                  {recordingUrl ? (
                    <p className="line-clamp-2 break-all">{recordingUrl}</p>
                  ) : (
                    <p>No source loaded. Select a recording to begin.</p>
                  )}
                </div>
              </CardContent>
              <div className="absolute inset-0 z-10 bg-background/40 backdrop-blur-sm rounded-lg flex items-center justify-center">
                <span className="text-sm font-medium text-muted-foreground">
                  Coming Soon
                </span>
              </div>
            </Card>

            <Card className="min-h-0 flex-1 relative">
              <CardHeader className="pb-1">
                <CardTitle>AI Chat</CardTitle>
                <CardDescription>
                  Assistant controls for editing.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex h-full min-h-0 flex-col gap-2">
                <div className="min-h-16 flex-1 rounded-md border border-border/80 bg-muted/35 p-2 text-xs text-muted-foreground shadow-[0_2px_0_var(--shadow-soft)]">
                  Ask for cuts, transitions, overlays, and timeline tweaks.
                </div>
                <Textarea
                  placeholder="Type a prompt..."
                  className="min-h-20 resize-none"
                />
                <Button className="self-end">Send</Button>
              </CardContent>
              <div className="absolute inset-0 z-10 bg-background/40 backdrop-blur-sm rounded-lg flex items-center justify-center">
                <span className="text-sm font-medium text-muted-foreground">
                  Coming Soon
                </span>
              </div>
            </Card>
          </section>

          <section className="flex min-h-0 flex-col gap-3">
            <EditorPreview previewUrl={previewUrl} />

            <EditorTimeline />
          </section>

          <aside className="flex min-h-0 flex-col gap-2 overflow-y-auto rounded-lg border-2 border-border bg-card p-2 shadow-[0_4px_0_var(--shadow-strong)]">
            <Button
              size="icon"
              className="h-12 w-12 self-center"
              aria-label="Export video"
              onClick={onOpenExportSettings}
              disabled={isExporting}
            >
              {isExporting ? "Busy" : "Export"}
            </Button>

            {message ? (
              <p className="text-[10px] leading-tight text-muted-foreground">
                {message}
              </p>
            ) : null}

            <Separator className="my-0.5" />

            <div className="grid gap-2">
              {editorTools.map((tool) => (
                <Button
                  key={tool.label}
                  variant="outline"
                  className="h-10 w-12 px-0 text-[10px]"
                  title={tool.label}
                  onClick={() => {
                    if (tool.action === "cut") {
                      cutSelectedClipAtCurrentTime();
                      return;
                    }

                    if (tool.action === "zoom") {
                      addZoomEffect();
                      return;
                    }

                    if (tool.action === "background") {
                      setShowBackgroundSettings(true);
                    }
                  }}
                >
                  {tool.label}
                </Button>
              ))}
            </div>
          </aside>
        </div>
      </CardContent>

      {showBackgroundSettings ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl">
            <BackgroundToolPanel />
            <Button
              type="button"
              variant="ghost"
              className="mt-2 w-full"
              onClick={() => {
                setShowBackgroundSettings(false);
                selectEffect(null);
              }}
            >
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default EditorPage;
