/**
 * Hook for export functionality.
 */

import { useState, useCallback } from "react";
import type { ExportStatus } from "./service";
import { exportService } from "./service";
import type { ExportRequest as EditorExportRequest } from "@/store/useEditorStore";

export interface ExportState {
  status: ExportStatus;
  message: string;
  outputPath?: string;
}

/**
 * Hook managing export state and operations.
 */
export function useExport() {
  const [state, setState] = useState<ExportState>({
    status: "idle",
    message: "",
  });

  const export_async = useCallback(
    async (request: EditorExportRequest, outputDirectory?: string | null) => {
      setState({ status: "running", message: "Rendering export..." });

      try {
        const result = await exportService.export({
          source: request.source,
          duration: request.duration,
          effects: request.effects,
          format: request.format,
          resolution: request.resolution,
          fps: request.fps,
          optimizeFileSize: request.optimizeFileSize,
          outputDirectory,
        });

        setState(result);
        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Export failed";
        const newState: ExportState = {
          status: "error",
          message,
        };
        setState(newState);
        return newState;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setState({ status: "idle", message: "" });
  }, []);

  const isExporting = state.status === "running";
  const hasError = state.status === "error";
  const isSuccess = state.status === "success";

  return {
    // State
    status: state.status,
    message: state.message,
    outputPath: state.outputPath,
    isExporting,
    hasError,
    isSuccess,
    // Actions
    export: export_async,
    reset,
  };
}
