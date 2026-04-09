import { Link, useParams } from "react-router-dom";

const EditorPage = () => {
  const { address } = useParams();
  const recordingUrl = address ? decodeURIComponent(address) : null;

  if (!recordingUrl) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold">Editor</h1>
        <div className="rounded-lg border border-dashed border-border bg-card/70 p-6">
          <p className="text-base font-medium">
            We will work on this feature to import a recording later.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            No recording URL was passed to the editor yet, so there is nothing
            to load.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Go back to{" "}
            <Link to="/recordings" className="underline">
              Recordings
            </Link>{" "}
            or open the editor from a saved video.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold">Editor</h1>
      <div className="rounded-lg border bg-card p-6">
        <p className="text-sm text-muted-foreground">Loaded recording</p>
        <p className="mt-2 break-all text-sm">{recordingUrl}</p>
      </div>
    </div>
  );
};

export default EditorPage;
