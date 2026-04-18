/**
 * Export service - handles video export logic.
 */

import { invoke } from "@tauri-apps/api/core";
import type { ExportRequest as EditorExportRequest } from "@/store/useEditorStore";

export type ExportStatus =
  | "idle"
  | "running"
  | "success"
  | "error"
  | "cancelled";

export type ExportEventKind =
  | "started"
  | "progress"
  | "completed"
  | "failed"
  | "cancelled";

export interface ExportStatusEvent {
  kind: ExportEventKind;
  progressPercent?: number;
  message?: string;
  outputPath?: string;
}

export interface ExportResult {
  status: ExportStatus;
  message: string;
  progressPercent?: number;
  outputPath?: string;
}

export interface ExportRequest {
  source: string;
  duration: number;
  effects: EditorExportRequest["effects"];
  format: EditorExportRequest["format"];
  resolution: EditorExportRequest["resolution"];
  fps: EditorExportRequest["fps"];
  optimizeFileSize: EditorExportRequest["optimizeFileSize"];
  outputDirectory?: string | null;
}

/**
 * Export service for handling video export operations.
 */
export class ExportService {
  async export(request: ExportRequest): Promise<ExportResult> {
    this.validateRequest(request);

    try {
      const result = await invoke<{ outputPath: string }>("start_export", {
        request: {
          source: request.source,
          duration: request.duration,
          effects: request.effects,
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
    if (!request.source) {
      throw new Error("Source is required");
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
