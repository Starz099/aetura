import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

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

  setDefaultExportDirectory: (path: string) => void;
  setGrokApiKeys: (keys: string[]) => void;
  addGrokApiKey: (key: string) => void;
  removeGrokApiKey: (key: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      defaultExportDirectory: "",
      grokApiKeys: [],

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
    }),
    {
      name: "aetura-settings",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        defaultExportDirectory: state.defaultExportDirectory,
        grokApiKeys: state.grokApiKeys,
      }),
    },
  ),
);
