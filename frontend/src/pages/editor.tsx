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
import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";

const effectTools = ["Blur", "Zoom"];

const EditorPage = () => {
  const { address } = useParams();
  const recordingUrl = address ? decodeURIComponent(address) : null;

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Aetura Editor";

    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-auto p-3 sm:p-4">
      <CardContent className="flex min-h-0 flex-1 p-0">
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[280px_minmax(0,1fr)_76px]">
          <section className="flex min-h-0 flex-col gap-3">
            <Card size="sm" className="h-auto">
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
            </Card>

            <Card className="min-h-0 flex-1">
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
            </Card>
          </section>

          <section className="flex min-h-0 flex-col gap-3">
            <Card className="min-h-0 flex-1">
              <CardHeader className="pb-2">
                <CardTitle>Preview</CardTitle>
                <CardDescription>
                  Live output of your edited sequence.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex h-full min-h-0">
                <div className="flex h-full min-h-90 w-full items-center justify-center rounded-md border-2 border-border/80 bg-muted/45 shadow-[0_3px_0_var(--shadow-soft)]">
                  {recordingUrl ? (
                    <video
                      src={recordingUrl}
                      controls
                      className="h-full w-full rounded-md bg-black object-contain"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Preview will appear after you load a recording.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card size="sm">
              <CardHeader className="pb-1">
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-24 rounded-md border-2 border-border/80 bg-muted/35 p-2 shadow-[0_3px_0_var(--shadow-soft)]">
                  <div className="h-2 rounded-full bg-border" />
                  <div className="mt-3 flex gap-2">
                    <div className="h-8 w-1/3 rounded-sm bg-primary/25" />
                    <div className="h-8 w-1/4 rounded-sm bg-secondary" />
                    <div className="h-8 w-1/5 rounded-sm bg-accent" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <aside className="flex min-h-0 flex-col gap-2 overflow-y-auto rounded-lg border-2 border-border bg-card p-2 shadow-[0_4px_0_var(--shadow-strong)]">
            <Button
              asChild
              variant="outline"
              className="h-8 w-12 px-0 text-[10px]"
            >
              <Link to="/recordings">Rec</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-8 w-12 px-0 text-[10px]"
            >
              <Link to="/">Home</Link>
            </Button>

            <Separator className="my-0.5" />

            <Button
              size="icon"
              className="h-12 w-12 self-center"
              aria-label="Export video"
            >
              Export
            </Button>

            <Separator className="my-0.5" />

            <div className="grid gap-2">
              {effectTools.map((tool) => (
                <Button
                  key={tool}
                  variant="outline"
                  className="h-10 w-12 px-0 text-[10px]"
                  title={tool}
                >
                  {tool.slice(0, 3)}
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
