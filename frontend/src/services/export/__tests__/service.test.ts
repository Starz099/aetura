import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { exportService } from "../service";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockedInvoke = vi.mocked(invoke);

describe("exportService", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
  });

  it("sends segments to the Tauri command", async () => {
    mockedInvoke.mockResolvedValue({ outputPath: "/tmp/output.mp4" });

    const result = await exportService.export({
      segments: [
        {
          sourceUrl: "/tmp/input.mp4",
          inPoint: 0,
          outPoint: 10,
          startOnTimeline: 0,
        },
      ],
      duration: 10,
      effects: [],
      background: {
        enabled: false,
        presetId: "aurora-1",
        padding: 32,
        roundedness: 16,
      },
      format: "mp4",
      resolution: "1080p",
      fps: 30,
      optimizeFileSize: false,
      outputDirectory: "/tmp",
    });

    expect(mockedInvoke).toHaveBeenCalledWith("start_export", {
      request: {
        segments: [
          {
            sourceUrl: "/tmp/input.mp4",
            inPoint: 0,
            outPoint: 10,
            startOnTimeline: 0,
          },
        ],
        duration: 10,
        effects: [],
        background: {
          enabled: false,
          presetId: "aurora-1",
          padding: 32,
          roundedness: 16,
        },
        format: "mp4",
        resolution: "1080p",
        fps: 30,
        optimizeFileSize: false,
      },
      defaultOutputDirectory: "/tmp",
    });
    expect(result).toEqual({
      status: "success",
      message: "Export completed: /tmp/output.mp4",
      progressPercent: 100,
      outputPath: "/tmp/output.mp4",
    });
  });

  it("rejects invalid export requests before invoking Tauri", async () => {
    await expect(
      exportService.export({
        segments: [],
        duration: 12,
        effects: [],
        background: {
          enabled: false,
          presetId: "aurora-1",
          padding: 32,
          roundedness: 16,
        },
        format: "mp4",
        resolution: "1080p",
        fps: 30,
        optimizeFileSize: false,
      }),
    ).rejects.toThrow("At least one segment is required");

    expect(mockedInvoke).not.toHaveBeenCalled();
  });

  it("returns an error result when the Tauri command fails", async () => {
    mockedInvoke.mockRejectedValue(new Error("ffmpeg failed"));

    const result = await exportService.export({
      segments: [
        {
          sourceUrl: "/tmp/input.mp4",
          inPoint: 0,
          outPoint: 10,
          startOnTimeline: 0,
        },
      ],
      duration: 10,
      effects: [],
      background: {
        enabled: false,
        presetId: "aurora-1",
        padding: 32,
        roundedness: 16,
      },
      format: "mp4",
      resolution: "1080p",
      fps: 30,
      optimizeFileSize: false,
    });

    expect(result).toEqual({
      status: "error",
      message: "ffmpeg failed",
    });
  });
});
