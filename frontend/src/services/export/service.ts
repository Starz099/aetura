/**
 * Export service - handles video export logic.
 */

import { invoke } from "@tauri-apps/api/core";
import type { EditorClip } from "@/types/editor";
import type { ExportRequest as BaseExportRequest, ExportSegment, ExportServiceResult } from "@/types/export";

export interface ExportRequest extends BaseExportRequest {
  outputDirectory?: string | null;
}


/**
 * Export service for handling video export operations.
 */
export class ExportService {
  /**
   * Build export segments from editor clips
   */
  static buildSegments(clips: EditorClip[], sourceUrl: string): ExportSegment[] {
    return clips.map((clip) => ({
      sourceUrl,
      inPoint: clip.sourceStart,
      outPoint: clip.sourceEnd,
      startOnTimeline: clip.timelineStart,
    }));
  }

  async export(request: ExportRequest): Promise<ExportServiceResult> {
    this.validateRequest(request);

    console.log("ExportService.export() called");
    console.log(`   Segments: ${request.segments.length}, Duration: ${request.duration}s`);
    request.segments.forEach((seg, idx) => {
      console.log(`   [${idx}] in=${seg.inPoint.toFixed(2)}, out=${seg.outPoint.toFixed(2)}`);
    });

    try {
      const result = await invoke<{ outputPath: string }>("start_export", {
        request: {
          segments: request.segments,
          duration: request.duration,
          effects: request.effects,
          background: request.background,
          format: request.format,
          resolution: request.resolution,
          fps: request.fps,
          optimizeFileSize: request.optimizeFileSize,
        },
        defaultOutputDirectory: request.outputDirectory?.trim() || null,
      });

      return {
        status: "success",
        message: `Export completed: ${result.outputPath}`,
        progressPercent: 100,
        outputPath: result.outputPath,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to export video";

      console.error("Export failed:", message);
      return {
        status: "error",
        message,
      };
    }
  }

  async cancel(): Promise<void> {
    await invoke("cancel_export");
  }

  private validateRequest(request: ExportRequest): void {
    if (!request.segments || request.segments.length === 0) {
      throw new Error("At least one segment is required");
    }

    for (const segment of request.segments) {
      if (!segment.sourceUrl) {
        throw new Error("Segment source URL is required");
      }

      if (segment.inPoint < 0 || segment.outPoint < 0) {
        throw new Error("Segment in/out points must be non-negative");
      }

      if (segment.inPoint >= segment.outPoint) {
        throw new Error("Segment in-point must be less than out-point");
      }
    }

    if (request.duration < 0) {
      throw new Error("Duration must be a non-negative number");
    }

    if (!Array.isArray(request.effects)) {
      throw new Error("Effects must be an array");
    }

    // Setting-level validation is handled by the Tauri backend.
  }
}

// Exported singleton instance
export const exportService = new ExportService();
