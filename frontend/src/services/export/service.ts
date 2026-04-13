/**
 * Export service - handles video export logic.
 */

import { invoke } from "@tauri-apps/api/core";
import type { ExportRequest as EditorExportRequest } from "@/store/useEditorStore";

export type ExportStatus = "idle" | "running" | "success" | "error";

export interface ExportResult {
  status: ExportStatus;
  message: string;
  outputPath?: string;
}

export interface ExportRequest {
  source: string;
  duration: number;
  effects: EditorExportRequest["effects"];
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
        },
        defaultOutputDirectory: request.outputDirectory?.trim() || null,
      });

      return {
        status: "success",
        message: `Export completed: ${result.outputPath}`,
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

  private validateRequest(request: ExportRequest): void {
    if (!request.source) {
      throw new Error("Source is required");
    }

    if (request.duration <= 0) {
      throw new Error("Duration must be greater than 0");
    }

    if (!Array.isArray(request.effects)) {
      throw new Error("Effects must be an array");
    }
  }
}

// Exported singleton instance
export const exportService = new ExportService();
