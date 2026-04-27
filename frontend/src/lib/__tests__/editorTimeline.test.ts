import { describe, expect, it } from "vitest";

import {
  buildSingleClipTimeline,
  findClipAtSourceTime,
  findClipAtTimelineTime,
  getTimelineDuration,
  mapSourceTimeToTimelineTime,
  mapTimelineTimeToSourceTime,
  rebuildTimeline,
} from "../editorTimeline";

describe("editor timeline helpers", () => {
  it("builds a single-clip timeline from source duration", () => {
    const clips = buildSingleClipTimeline("file:///video.mp4", 12);

    expect(clips).toHaveLength(1);
    expect(clips[0]).toMatchObject({
      sourceUrl: "file:///video.mp4",
      sourceStart: 0,
      sourceEnd: 12,
      timelineStart: 0,
    });
    expect(getTimelineDuration(clips)).toBe(12);
  });

  it("rebuilds clip starts after a duration change", () => {
    const clips = rebuildTimeline([
      {
        id: "clip-1",
        sourceUrl: "file:///video.mp4",
        sourceStart: 0,
        sourceEnd: 4,
        timelineStart: 0,
      },
      {
        id: "clip-2",
        sourceUrl: "file:///video.mp4",
        sourceStart: 7,
        sourceEnd: 12,
        timelineStart: 0,
      },
    ]);

    expect(clips[0].timelineStart).toBe(0);
    expect(clips[1].timelineStart).toBe(4);
    expect(getTimelineDuration(clips)).toBe(9);
  });

  it("maps between timeline time and source time across clip segments", () => {
    const clips = rebuildTimeline([
      {
        id: "clip-1",
        sourceUrl: "file:///video.mp4",
        sourceStart: 0,
        sourceEnd: 4,
        timelineStart: 0,
      },
      {
        id: "clip-2",
        sourceUrl: "file:///video.mp4",
        sourceStart: 7,
        sourceEnd: 12,
        timelineStart: 0,
      },
    ]);

    expect(mapTimelineTimeToSourceTime(clips, 2)).toBe(2);
    expect(mapTimelineTimeToSourceTime(clips, 5)).toBe(8);
    expect(mapSourceTimeToTimelineTime(clips, 8)).toBe(5);
    expect(mapSourceTimeToTimelineTime(clips, 5)).toBe(4);
  });

  it("finds the active clip for timeline and source time", () => {
    const clips = rebuildTimeline([
      {
        id: "clip-1",
        sourceUrl: "file:///video.mp4",
        sourceStart: 0,
        sourceEnd: 4,
        timelineStart: 0,
      },
      {
        id: "clip-2",
        sourceUrl: "file:///video.mp4",
        sourceStart: 7,
        sourceEnd: 12,
        timelineStart: 0,
      },
    ]);

    expect(findClipAtTimelineTime(clips, 3)?.clip.id).toBe("clip-1");
    expect(findClipAtSourceTime(clips, 9)?.clip.id).toBe("clip-2");
  });
});
