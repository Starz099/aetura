import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { Link } from "react-router-dom";
import { apiClient } from "@/services/api";

interface VideoRecord {
  filename: string;
  absolute_path: string;
  video_url: string;
  created_at: number;
}

export default function Recordings() {
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLibrary = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getLibrary();
      setVideos(data.videos);
    } catch (error) {
      console.error("Error fetching library:", error);
      alert("Failed to fetch library. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLibrary();

    const handleRefresh = () => {
      fetchLibrary();
    };

    window.addEventListener("aetura:refresh-recordings", handleRefresh);

    return () => {
      window.removeEventListener("aetura:refresh-recordings", handleRefresh);
    };
  }, []);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-6 overflow-auto px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Your Demos</h1>
          <p className="mt-1 text-muted-foreground">
            Locally stored recordings ready for editing.
          </p>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Loading recordings...
          </CardContent>
        </Card>
      ) : videos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No recordings found. Go map a script first.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => {
            return (
              <Card
                key={video.absolute_path}
                className="flex h-full flex-col overflow-hidden"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle
                      className="truncate text-base"
                      title={video.filename}
                    >
                      {video.filename}
                    </CardTitle>
                  </div>
                  <CardDescription>
                    {formatDate(video.created_at)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto pt-0">
                  <Link
                    to={`/editor/${encodeURIComponent(video.video_url)}`}
                    className="w-full text-sm font-medium underline"
                  >
                    Open in Editor
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
