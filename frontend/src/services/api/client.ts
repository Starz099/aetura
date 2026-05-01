/**
 * Centralized API client for all backend communication.
 */

import type {
  DraftScriptRequest,
  ResumeScriptRequest,
  RecordVideoRequest,
  DemoScript,
  RecordResponse,
  LibraryResponse,
  APIErrorResponse,
} from "@/types/api";
import { APIError } from "@/types/api";

/**
 * API Client for communicating with the backend.
 * Provides centralized error handling, request validation, and retry logic.
 */
export class APIClient {
  private baseUrl: string;
  private timeout: number;
  private retryCount: number;

  private static readonly MAPPING_TIMEOUT_MS = 180000;
  private static readonly RECORDING_TIMEOUT_MS = 300000;

  constructor(
    baseUrl: string = "http://localhost:8000",
    timeout: number = 30000,
    retryCount: number = 3,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash
    this.timeout = timeout;
    this.retryCount = retryCount;
  }

  /**
   * Make an HTTP request with retry logic and error handling.
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
    options?: {
      timeoutMs?: number;
      retries?: number;
    },
  ): Promise<T> {
    let lastError: Error = new Error("Unknown error");
    const timeoutMs = options?.timeoutMs ?? this.timeout;
    const retries = options?.retries ?? this.retryCount;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData: APIErrorResponse = await response
            .json()
            .catch(() => ({ error: response.statusText }));

          throw new APIError(
            response.status,
            errorData.error_code || errorData.error || "UNKNOWN_ERROR",
            errorData.message || errorData.error || response.statusText,
          );
        }

        const data: T = await response.json();
        return data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on client errors (4xx) except 408 (timeout)
        if (error instanceof APIError && error.statusCode !== 408) {
          throw error;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < retries) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000),
          );
        }
      }
    }

    throw lastError;
  }

  /**
   * Draft a new automation script from scratch.
   */
  async draftScript(request: DraftScriptRequest): Promise<DemoScript> {
    this.validateDraftRequest(request);

    const response = await this.request<{
      agent_message?: DemoScript;
      [key: string]: unknown;
    }>("POST", "/explore", request, {
      timeoutMs: APIClient.MAPPING_TIMEOUT_MS,
      retries: 0,
    });

    // Handle different response formats for backward compatibility
    const script = response.agent_message || response;

    if (!script || typeof script !== "object" || !("steps" in script)) {
      throw new Error(
        "Invalid response format: expected DemoScript with steps array",
      );
    }

    return script as DemoScript;
  }

  /**
   * Resume an automation script from approved steps.
   */
  async resumeScript(request: ResumeScriptRequest): Promise<DemoScript> {
    this.validateResumeRequest(request);

    const response = await this.request<{
      agent_message?: DemoScript;
      [key: string]: unknown;
    }>("POST", "/explore/resume", request, {
      timeoutMs: APIClient.MAPPING_TIMEOUT_MS,
      retries: 0,
    });

    const script = response.agent_message || response;

    if (!script || typeof script !== "object" || !("steps" in script)) {
      throw new Error("Invalid response format: expected DemoScript");
    }

    return script as DemoScript;
  }

  /**
   * Record a demo video from approved steps.
   */
  async recordVideo(request: RecordVideoRequest): Promise<RecordResponse> {
    this.validateRecordRequest(request);

    const response = await this.request<RecordResponse>(
      "POST",
      "/record",
      request,
      {
        timeoutMs: APIClient.RECORDING_TIMEOUT_MS,
        retries: 0,
      },
    );

    if (response.status === "error") {
      throw new Error(response.message || "Failed to record video");
    }

    return response;
  }

  /**
   * Get library of recorded videos.
   */
  async getLibrary(): Promise<LibraryResponse> {
    return this.request<LibraryResponse>("GET", "/library");
  }

  /**
   * Validate draft script request.
   */
  private validateDraftRequest(request: DraftScriptRequest): void {
    if (!request.url || typeof request.url !== "string") {
      throw new Error("URL is required and must be a string");
    }

    if (!request.intent || typeof request.intent !== "string") {
      throw new Error("Intent is required and must be a string");
    }

    if (!request.grok_api_key || typeof request.grok_api_key !== "string") {
      throw new Error("API key is required");
    }
  }

  /**
   * Validate resume script request.
   */
  private validateResumeRequest(request: ResumeScriptRequest): void {
    if (!request.url) throw new Error("URL is required");
    if (!request.intent) throw new Error("Intent is required");
    if (!Array.isArray(request.approved_steps)) {
      throw new Error("Approved steps must be an array");
    }
    if (!request.grok_api_key) throw new Error("API key is required");
  }

  /**
   * Validate record video request.
   */
  private validateRecordRequest(request: RecordVideoRequest): void {
    if (!request.url) throw new Error("URL is required");
    if (
      !Array.isArray(request.approved_steps) ||
      request.approved_steps.length === 0
    ) {
      throw new Error("At least one step is required for recording");
    }
  }

  /**
   * Set custom base URL (useful for testing or different environments).
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, "");
  }

  /**
   * Set request timeout in milliseconds.
   */
  setTimeout(ms: number): void {
    this.timeout = ms;
  }

  /**
   * Set max retry attempts.
   */
  setRetryCount(count: number): void {
    this.retryCount = count;
  }
}

// Exported singleton instance
export const apiClient = new APIClient();

// Export types and error class
export { APIError } from "@/types/api";
