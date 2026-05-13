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
  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === "string") {
      return error;
    }

    try {
      return JSON.stringify(error, null, 2);
    } catch {
      return String(error);
    }
  }

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
      const details = this.formatError(error);
      const message = "Export failed";

      console.error("Export failed:", details);
      return {
        status: "error",
        message,
        details,
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
