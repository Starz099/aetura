/**
 * Hook for export functionality.
 */

import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useState, useCallback, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import type { ExportStatus, ExportStatusEvent } from "./service";
import { exportService } from "./service";
import type { ExportRequest as EditorExportRequest } from "@/store/useEditorStore";

export interface ExportState {
  status: ExportStatus;
  message: string;
  progressPercent: number;
  stage?: ExportStatusEvent["kind"];
  outputPath?: string;
}

const EXPORT_STATUS_EVENT = "export-status";

async function waitForNextPaint() {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

/**
 * Hook managing export state and operations.
 */
export function useExport() {
  const [state, setState] = useState<ExportState>({
    status: "idle",
    message: "",
    progressPercent: 0,
  });
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    let unlisten: UnlistenFn | undefined;
    listen<ExportStatusEvent>(EXPORT_STATUS_EVENT, (event) => {
      if (!isMountedRef.current) {
        return;
      }

      const payload = event.payload;
      if (!payload) {
        return;
      }

      if (payload.kind === "started") {
        setState((prev) => ({
          ...prev,
          status: "running",
          stage: "started",
          progressPercent: payload.progressPercent ?? 0,
          message: payload.message ?? "Preparing export...",
        }));
        return;
      }

      if (payload.kind === "progress") {
        setState((prev) => ({
          ...prev,
          status: "running",
          stage: "progress",
          progressPercent: payload.progressPercent ?? prev.progressPercent,
        }));
        return;
      }

      if (payload.kind === "completed") {
        setState((prev) => ({
          ...prev,
          status: "success",
          stage: "completed",
          progressPercent: 100,
          message: payload.message ?? "Export completed",
          outputPath: payload.outputPath,
        }));
        return;
      }

      if (payload.kind === "cancelled") {
        setState((prev) => ({
          ...prev,
          status: "cancelled",
          stage: "cancelled",
          message: payload.message ?? "Export cancelled",
        }));
        return;
      }

      if (payload.kind === "failed") {
        setState((prev) => ({
          ...prev,
          status: "error",
          stage: "failed",
          message: payload.message ?? "Export failed",
        }));
      }
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {
        // Keep local-only export behavior if listener registration fails.
      });

    return () => {
      isMountedRef.current = false;
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const export_async = useCallback(
    async (request: EditorExportRequest, outputDirectory?: string | null) => {
      flushSync(() => {
        setState({
          status: "running",
          message: "Rendering export...",
          progressPercent: 0,
          stage: "started",
        });
      });

      // Give the UI one frame to paint before invoking Tauri command.
      await waitForNextPaint();

      try {
        const result = await exportService.export({
          segments: request.segments,
          duration: request.duration,
          effects: request.effects,
          background: request.background,
          format: request.format,
          resolution: request.resolution,
          fps: request.fps,
          optimizeFileSize: request.optimizeFileSize,
          outputDirectory,
        });

        setState((prev) => ({
          ...prev,
          ...result,
          progressPercent: result.progressPercent ?? prev.progressPercent,
        }));
        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Export failed";
        const newState: ExportState = {
          status: "error",
          message,
          progressPercent: 0,
          stage: "failed",
        };
        setState(newState);
        return newState;
      }
    },
    [],
  );

  const cancel = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      message: "Cancelling export...",
    }));

    try {
      await exportService.cancel();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Cancel request failed";
      setState((prev) => ({
        ...prev,
        status: "error",
        stage: "failed",
        message,
      }));
    }
  }, []);

  const reset = useCallback(() => {
    setState({ status: "idle", message: "", progressPercent: 0 });
  }, []);

  const isExporting = state.status === "running";
  const hasError = state.status === "error";
  const isSuccess = state.status === "success";
  const isCancelled = state.status === "cancelled";

  return {
    // State
    status: state.status,
    message: state.message,
    progressPercent: state.progressPercent,
    stage: state.stage,
    outputPath: state.outputPath,
    isExporting,
    hasError,
    isSuccess,
    isCancelled,
    // Actions
    export: export_async,
    cancel,
    reset,
  };
}
