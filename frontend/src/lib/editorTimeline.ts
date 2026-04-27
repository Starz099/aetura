export const MIN_EFFECT_LENGTH = 0.1;
export const MIN_CLIP_DURATION = 0.1;
export const TIMELINE_DRAG_THRESHOLD_PX = 2;
export const TIMELINE_TIME_UPDATE_THROTTLE_MS = 75;

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

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const safeFinite = (value: number, fallback = 0) =>
  Number.isFinite(value) ? value : fallback;

export const getClipDuration = (clip: EditorClip) =>
  Math.max(clip.sourceEnd - clip.sourceStart, MIN_CLIP_DURATION);

export const getTimelineDuration = (clips: EditorClip[]) =>
  clips.reduce((total, clip) => total + getClipDuration(clip), 0);

export const getSourceDuration = (clips: EditorClip[]) =>
  clips.reduce((maxEnd, clip) => Math.max(maxEnd, clip.sourceEnd), 0);

export const buildSingleClipTimeline = (
  sourceUrl: string,
  duration: number,
): EditorClip[] => [
  {
    id: "clip-0",
    sourceUrl,
    sourceStart: 0,
    sourceEnd: Math.max(safeFinite(duration, 0), 0),
    timelineStart: 0,
  },
];

export const rebuildTimeline = (clips: EditorClip[]): EditorClip[] => {
  let nextTimelineStart = 0;

  return clips.map((clip) => {
    const nextClip: EditorClip = {
      ...clip,
      sourceStart: safeFinite(clip.sourceStart, 0),
      sourceEnd: safeFinite(clip.sourceEnd, 0),
      timelineStart: nextTimelineStart,
    };

    nextTimelineStart += getClipDuration(nextClip);
    return nextClip;
  });
};

export const findClipAtTimelineTime = (
  clips: EditorClip[],
  time: number,
): ClipLocation | null => {
  const safeTime = safeFinite(time, 0);

  for (let index = 0; index < clips.length; index += 1) {
    const clip = clips[index];
    const duration = getClipDuration(clip);
    const endTime = clip.timelineStart + duration;

    if (safeTime >= clip.timelineStart && safeTime <= endTime) {
      return {
        clip,
        index,
        localTime: clampNumber(safeTime - clip.timelineStart, 0, duration),
      };
    }
  }

  return null;
};

export const findClipAtSourceTime = (
  clips: EditorClip[],
  time: number,
): ClipLocation | null => {
  const safeTime = safeFinite(time, 0);

  for (let index = 0; index < clips.length; index += 1) {
    const clip = clips[index];
    const duration = getClipDuration(clip);
    const endTime = clip.sourceStart + duration;

    if (safeTime >= clip.sourceStart && safeTime <= endTime) {
      return {
        clip,
        index,
        localTime: clampNumber(safeTime - clip.sourceStart, 0, duration),
      };
    }
  }

  return null;
};

export const findNextClipAfterSourceTime = (
  clips: EditorClip[],
  time: number,
): ClipLocation | null => {
  const safeTime = safeFinite(time, 0);

  for (let index = 0; index < clips.length; index += 1) {
    const clip = clips[index];

    if (clip.sourceStart > safeTime) {
      return {
        clip,
        index,
        localTime: 0,
      };
    }
  }

  return null;
};

export const mapTimelineTimeToSourceTime = (
  clips: EditorClip[],
  time: number,
): number => {
  const location = findClipAtTimelineTime(clips, time);

  if (!location) {
    if (clips.length === 0) {
      return 0;
    }

    const firstClip = clips[0];
    const lastClip = clips[clips.length - 1];
    const safeTime = safeFinite(time, 0);

    if (safeTime <= firstClip.timelineStart) {
      return firstClip.sourceStart;
    }

    return lastClip.sourceEnd;
  }

  return location.clip.sourceStart + location.localTime;
};

export const mapSourceTimeToTimelineTime = (
  clips: EditorClip[],
  time: number,
): number => {
  const location = findClipAtSourceTime(clips, time);

  if (location) {
    return location.clip.timelineStart + location.localTime;
  }

  const nextLocation = findNextClipAfterSourceTime(clips, time);

  if (nextLocation) {
    return nextLocation.clip.timelineStart;
  }

  if (clips.length === 0) {
    return 0;
  }

  return getTimelineDuration(clips);
};
