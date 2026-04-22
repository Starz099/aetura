export interface BackgroundPreset {
  id: string;
  label: string;
  imageUrl: string;
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  {
    id: "aurora-1",
    label: "Aurora",
    imageUrl: "/backgrounds/aurora-1.svg",
  },
  {
    id: "ocean-1",
    label: "Ocean",
    imageUrl: "/backgrounds/ocean-1.svg",
  },
  {
    id: "sunset-1",
    label: "Sunset",
    imageUrl: "/backgrounds/sunset-1.svg",
  },
  {
    id: "night-1",
    label: "Night",
    imageUrl: "/backgrounds/night-1.svg",
  },
];

export const getBackgroundPreset = (presetId: string) =>
  BACKGROUND_PRESETS.find((preset) => preset.id === presetId) ?? null;
