import {
  Badge,
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

const EditorPage = () => {
  const { address } = useParams();
  const recordingUrl = address ? decodeURIComponent(address) : null;
  const { isExporting, message, export: handleExport } = useExport();
  const [showExportSettings, setShowExportSettings] = useState(false);
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
          <Button
            variant="outline"
            onClick={() => setShowExportSettings(false)}
            disabled={isExporting}
          >
            Back to Editor
          </Button>
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
                Placeholder controls for destination, format, and quality.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4">
              <div className="space-y-2 rounded-md border border-dashed border-border bg-muted/35 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">Destination</span>
                  <Badge variant="secondary">File</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  This area will hold output location choices.
                </p>
              </div>

              <div className="space-y-2 rounded-md border border-dashed border-border bg-muted/35 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">Format</span>
                  <Badge variant="outline">MP4</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Format options will be added here later.
                </p>
              </div>

              <div className="space-y-2 rounded-md border border-dashed border-border bg-muted/35 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">Quality</span>
                  <Badge variant="secondary">Web</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Keep this screen focused on the preview and export flow for
                  now.
                </p>
              </div>

              <div className="rounded-md border border-border bg-muted/25 p-3 text-xs text-muted-foreground">
                {message
                  ? message
                  : "Confirm to start exporting the current edit."}
              </div>
            </CardContent>

            <div className="border-t p-3">
              <Button
                className="w-full"
                size="lg"
                onClick={onExport}
                disabled={isExporting}
              >
                {isExporting ? "Exporting..." : "Export to File"}
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
