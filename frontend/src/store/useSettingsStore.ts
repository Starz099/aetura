import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { RecordingSettings } from "@/types/settings";

export const defaultRecordingSettings: RecordingSettings = {
  captureFps: 30,
  viewportWidth: 1920,
  viewportHeight: 1080,
  recordAudio: false,
  outputPreset: "medium",
};

const normalizeApiKeys = (keys: string[]) => {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const key of keys) {
    const trimmed = key.trim();

    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
};

interface SettingsState {
  defaultExportDirectory: string;
  grokApiKeys: string[];
  recordingSettings: RecordingSettings;

  setDefaultExportDirectory: (path: string) => void;
  setGrokApiKeys: (keys: string[]) => void;
  addGrokApiKey: (key: string) => void;
  removeGrokApiKey: (key: string) => void;
  updateRecordingSettings: (settings: Partial<RecordingSettings>) => void;
  resetRecordingSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      defaultExportDirectory: "",
      grokApiKeys: [],
      recordingSettings: defaultRecordingSettings,

      setDefaultExportDirectory: (path: string) =>
        set({ defaultExportDirectory: path.trim() }),
      setGrokApiKeys: (keys: string[]) =>
        set({ grokApiKeys: normalizeApiKeys(keys) }),
      addGrokApiKey: (key: string) =>
        set((state) => ({
          grokApiKeys: normalizeApiKeys([...state.grokApiKeys, key]),
        })),
      removeGrokApiKey: (key: string) =>
        set((state) => ({
          grokApiKeys: state.grokApiKeys.filter((stored) => stored !== key),
        })),
      updateRecordingSettings: (settings: Partial<RecordingSettings>) =>
        set((state) => ({
          recordingSettings: {
            ...state.recordingSettings,
            ...settings,
          },
        })),
      resetRecordingSettings: () =>
        set({ recordingSettings: defaultRecordingSettings }),
    }),
    {
      name: "aetura-settings",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        defaultExportDirectory: state.defaultExportDirectory,
        grokApiKeys: state.grokApiKeys,
        recordingSettings: state.recordingSettings,
      }),
    },
  ),
);
