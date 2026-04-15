import { Button, Input } from "@/components/ui";
import {
  type RecordingPreset,
  useSettingsStore,
} from "@/store/useSettingsStore";
import { useState } from "react";
import { Link } from "react-router-dom";
import { CaretLeftIcon } from "@phosphor-icons/react";
import { invoke } from "@tauri-apps/api/core";

const Settings = () => {
  const defaultExportDirectory = useSettingsStore(
    (state) => state.defaultExportDirectory,
  );
  const setDefaultExportDirectory = useSettingsStore(
    (state) => state.setDefaultExportDirectory,
  );
  const grokApiKeys = useSettingsStore((state) => state.grokApiKeys);
  const addGrokApiKey = useSettingsStore((state) => state.addGrokApiKey);
  const removeGrokApiKey = useSettingsStore((state) => state.removeGrokApiKey);
  const recordingSettings = useSettingsStore(
    (state) => state.recordingSettings,
  );
  const updateRecordingSettings = useSettingsStore(
    (state) => state.updateRecordingSettings,
  );
  const resetRecordingSettings = useSettingsStore(
    (state) => state.resetRecordingSettings,
  );
  const [grokKeyInput, setGrokKeyInput] = useState("");
  const [exportPathMessage, setExportPathMessage] = useState("");

  const clampNumber = (value: string, min: number, max: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return min;
    }

    return Math.min(max, Math.max(min, Math.round(parsed)));
  };

  const handleAddGrokKey = () => {
    addGrokApiKey(grokKeyInput);
    setGrokKeyInput("");
  };

  const handleBrowseExportDirectory = async () => {
    setExportPathMessage("");

    try {
      const selectedPath = await invoke<string | null>("select_directory", {
        initialDirectory: defaultExportDirectory.trim() || null,
      });

      if (selectedPath) {
        setDefaultExportDirectory(selectedPath);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to open folder picker.";
      setExportPathMessage(message);
    }
  };

  return (
    <div className="w-full">
      <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Link to="/">
              <CaretLeftIcon size={16} weight="bold" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>

        {/* Settings Sections */}
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 font-semibold">Export</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Set the default folder where the export save dialog starts.
            </p>
            <Input
              value={defaultExportDirectory}
              onChange={(event) =>
                setDefaultExportDirectory(event.target.value)
              }
              placeholder="/home/starz/Videos/exports"
            />
            <div className="mt-3 flex gap-2">
              <Button type="button" onClick={handleBrowseExportDirectory}>
                Select Folder
              </Button>
            </div>
            {exportPathMessage ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {exportPathMessage}
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 font-semibold">AI Keys</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Add one or more Grok API keys. Multi-provider support can be added
              later.
            </p>

            <div className="mb-3 flex gap-2">
              <Input
                value={grokKeyInput}
                onChange={(event) => setGrokKeyInput(event.target.value)}
                placeholder="xai-..."
              />
              <Button
                type="button"
                onClick={handleAddGrokKey}
                disabled={!grokKeyInput.trim()}
              >
                Add
              </Button>
            </div>

            <div className="space-y-2">
              {grokApiKeys.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No Grok API keys added yet.
                </p>
              ) : (
                grokApiKeys.map((key) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-md border border-border bg-muted/35 px-3 py-2"
                  >
                    <p className="truncate text-xs text-muted-foreground">
                      {key}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7"
                      onClick={() => removeGrokApiKey(key)}
                    >
                      Remove
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Recording Quality</h2>
                <p className="text-sm text-muted-foreground">
                  Configure capture and encoding variables used for demo
                  recording.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={resetRecordingSettings}
              >
                Reset Defaults
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Capture FPS</span>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={recordingSettings.captureFps}
                  onChange={(event) =>
                    updateRecordingSettings({
                      captureFps: Number(event.target.value) as 15 | 30 | 60,
                    })
                  }
                >
                  <option value={15}>15</option>
                  <option value={30}>30</option>
                  <option value={60}>60</option>
                </select>
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">
                  Viewport Width (640-3840)
                </span>
                <Input
                  type="number"
                  min={640}
                  max={3840}
                  value={recordingSettings.viewportWidth}
                  onChange={(event) =>
                    updateRecordingSettings({
                      viewportWidth: clampNumber(event.target.value, 640, 3840),
                    })
                  }
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">
                  Viewport Height (360-2160)
                </span>
                <Input
                  type="number"
                  min={360}
                  max={2160}
                  value={recordingSettings.viewportHeight}
                  onChange={(event) =>
                    updateRecordingSettings({
                      viewportHeight: clampNumber(
                        event.target.value,
                        360,
                        2160,
                      ),
                    })
                  }
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Output Preset</span>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={recordingSettings.outputPreset}
                  onChange={(event) =>
                    updateRecordingSettings({
                      outputPreset: event.target.value as RecordingPreset,
                    })
                  }
                >
                  <option value="ultrafast">ultrafast</option>
                  <option value="superfast">superfast</option>
                  <option value="veryfast">veryfast</option>
                  <option value="faster">faster</option>
                  <option value="fast">fast</option>
                  <option value="medium">medium</option>
                  <option value="slow">slow</option>
                  <option value="slower">slower</option>
                  <option value="veryslow">veryslow</option>
                </select>
              </label>
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Slower presets improve compression but take longer to encode.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
