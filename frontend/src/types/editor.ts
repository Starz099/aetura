export type EditorEffectType = "zoom";

export interface ZoomAnchor {
  x: number;
  y: number;
}

export interface EditorEffect {
  id: string;
  type: EditorEffectType;
  startTime: number;
  length: number;
  multiplier: number;
  anchor: ZoomAnchor;
}

export interface EditorClip {
  id: string;
  sourceUrl: string;
  sourceStart: number;
  sourceEnd: number;
  timelineStart: number;
}

export interface ClipLocation {
  clip: EditorClip;
  index: number;
  localTime: number;
}

export interface EditorBackgroundSettings {
  enabled: boolean;
  presetId: string;
  padding: number;
  roundedness: number;
}
