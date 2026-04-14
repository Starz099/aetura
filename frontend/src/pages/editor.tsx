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
import { Link, useParams } from "react-router-dom";
import { buildExportRequest, useEditorStore } from "@/store/useEditorStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { EditorPreview } from "@/components/editor/preview";
import { EditorTimeline } from "@/components/editor/timeline";
import { useExport } from "@/services/export";

const effectTools = ["Zoom"];
const selectedOptionClass =
  "!border-primary/60 !bg-primary/10 !text-primary shadow-[0_2px_0_var(--shadow-soft)]";

type ExportFormat = "mp4" | "gif";
type ExportResolution = "720p" | "1080p" | "4k";
type ExportQuality = "potato" | "web" | "social" | "maximum";

const EditorPage = () => {
  const { address } = useParams();
  const recordingUrl = address ? decodeURIComponent(address) : null;
  const { isExporting, message, export: handleExport } = useExport();
  const [showExportSettings, setShowExportSettings] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("mp4");
  const [selectedResolution, setSelectedResolution] =
    useState<ExportResolution>("1080p");
  const [selectedFps, setSelectedFps] = useState<15 | 30 | 60>(60);
  const [selectedQuality, setSelectedQuality] = useState<ExportQuality>("web");
  const resetTimeline = useEditorStore((state) => state.resetTimeline);
  const addZoomEffect = useEditorStore((state) => state.addZoomEffect);
  const effects = useEditorStore((state) => state.effects);
  const duration = useEditorStore((state) => state.duration);
  const defaultExportDirectory = useSettingsStore(
    (state) => state.defaultExportDirectory,
  );

  const previewUrl = useMemo(
    () =>
      recordingUrl
        ? recordingUrl.startsWith("http://") ||
          recordingUrl.startsWith("https://")
          ? recordingUrl
          : `http://localhost:8000/recordings/${encodeURIComponent(
              recordingUrl.split(/[\\/]/).pop() || "",
            )}`
        : null,
    [recordingUrl],
  );

  const onExport = async () => {
    if (!previewUrl) {
      alert("No source video loaded.");
      return;
    }

    const request = buildExportRequest(previewUrl, duration, effects);
    await handleExport(request, defaultExportDirectory.trim() || null);
  };

  const onOpenExportSettings = () => {
    if (!previewUrl) {
      alert("No source video loaded.");
      return;
    }

    setShowExportSettings(true);
  };

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
    if (!showExportSettings) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showExportSettings]);

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
          <section className="min-h-0">
            <EditorPreview
              key={previewUrl ?? "export-preview"}
              previewUrl={previewUrl}
              autoPlay
              showMuteToggle
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
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    className={`h-12 ${selectedOptionClass}`}
                  >
                    File
                  </Button>
                  <Button variant="outline" className="h-12">
                    Clipboard
                  </Button>
                  <Button variant="outline" className="h-12">
                    Shareable Link
                  </Button>
                </div>
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
                  >
                    MP4
                  </Button>
                  <Button
                    variant="outline"
                    className={`h-11 ${
                      selectedFormat === "gif" ? selectedOptionClass : ""
                    }`}
                    onClick={() => setSelectedFormat("gif")}
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
                  >
                    720p
                  </Button>
                  <Button
                    variant="outline"
                    className={`h-11 ${
                      selectedResolution === "1080p" ? selectedOptionClass : ""
                    }`}
                    onClick={() => setSelectedResolution("1080p")}
                  >
                    1080p
                  </Button>
                  <Button
                    variant="outline"
                    className={`h-11 ${
                      selectedResolution === "4k" ? selectedOptionClass : ""
                    }`}
                    onClick={() => setSelectedResolution("4k")}
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
                  >
                    15
                  </Button>
                  <Button
                    variant="outline"
                    className={`h-11 ${selectedFps === 30 ? selectedOptionClass : ""}`}
                    onClick={() => setSelectedFps(30)}
                  >
                    30
                  </Button>
                  <Button
                    variant="outline"
                    className={`h-11 ${selectedFps === 60 ? selectedOptionClass : ""}`}
                    onClick={() => setSelectedFps(60)}
                  >
                    60
                  </Button>
                </div>
              </section>

              <section className="space-y-2">
                <p className="text-sm font-medium">Quality</p>
                <div className="grid grid-cols-4 gap-2">
                  <Button
                    variant="outline"
                    className={`h-11 px-1 ${
                      selectedQuality === "potato" ? selectedOptionClass : ""
                    }`}
                    onClick={() => setSelectedQuality("potato")}
                  >
                    Potato
                  </Button>
                  <Button
                    variant="outline"
                    className={`h-11 px-1 ${
                      selectedQuality === "web" ? selectedOptionClass : ""
                    }`}
                    onClick={() => setSelectedQuality("web")}
                  >
                    Web
                  </Button>
                  <Button
                    variant="outline"
                    className={`h-11 px-1 ${
                      selectedQuality === "social" ? selectedOptionClass : ""
                    }`}
                    onClick={() => setSelectedQuality("social")}
                  >
                    Social
                  </Button>
                  <Button
                    variant="outline"
                    className={`h-11 px-1 ${
                      selectedQuality === "maximum" ? selectedOptionClass : ""
                    }`}
                    onClick={() => setSelectedQuality("maximum")}
                  >
                    Maximum
                  </Button>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Smaller file</span>
                  <span>Larger file</span>
                </div>
              </section>

              <section className="space-y-2">
                <p className="text-sm font-medium">Advanced Options</p>
                <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                  Advanced export controls will be added in the next phase.
                </div>
              </section>

              <div className="rounded-md border border-border bg-muted/25 p-3 text-xs text-muted-foreground">
                {message
                  ? message
                  : `Selected: ${selectedFormat.toUpperCase()} • ${selectedResolution.toUpperCase()} • ${selectedFps} FPS • ${selectedQuality.toUpperCase()} (backend wiring in next phase).`}
              </div>
            </CardContent>

            <div className="space-y-2 border-t p-3">
              <Button
                className="w-full"
                size="lg"
                onClick={onExport}
                disabled={isExporting}
              >
                {isExporting ? "Exporting..." : "Export to File"}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setShowExportSettings(false)}
                disabled={isExporting}
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
              asChild
              variant="outline"
              className="h-8 w-12 px-0 text-[10px]"
            >
              <Link to="/">Home</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-8 w-12 px-0 text-[10px]"
            >
              <Link to="/recordings">Rec</Link>
            </Button>

            <Separator className="my-0.5" />

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
              {effectTools.map((tool) => (
                <Button
                  key={tool}
                  variant="outline"
                  className="h-10 w-12 px-0 text-[10px]"
                  title={tool}
                  onClick={() => {
                    if (tool === "Zoom") {
                      addZoomEffect();
                    }
                  }}
                  disabled={tool !== "Zoom"}
                >
                  {tool}
                </Button>
              ))}
            </div>
          </aside>
        </div>
      </CardContent>
    </div>
  );
};

export default EditorPage;
