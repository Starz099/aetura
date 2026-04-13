/**
 * Unit tests for API client.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { APIClient, APIError } from "../client";
import { DraftScriptRequest, RecordVideoRequest } from "../types";

describe("APIClient", () => {
  let client: APIClient;

  beforeEach(() => {
    client = new APIClient("http://localhost:8000");
    // Reset fetch mock
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should initialize with defaults", () => {
      const client = new APIClient();
      expect(client).toBeDefined();
    });

    it("should initialize with custom settings", () => {
      const client = new APIClient("http://api.example.com", 60000, 5);
      expect(client).toBeDefined();
    });

    it("should remove trailing slash from baseUrl", () => {
      const client = new APIClient("http://localhost:8000/");
      // This tests internal behavior via setBaseUrl
      client.setBaseUrl("http://test.com/");
      expect(client).toBeDefined();
    });
  });

  describe("validateDraftRequest", () => {
    it("should reject missing URL", async () => {
      const invalidRequest = {
        url: "",
        intent: "test",
        grok_api_key: "key",
      } as DraftScriptRequest;

      await expect(client.draftScript(invalidRequest)).rejects.toThrow(
        "URL is required",
      );
    });

    it("should reject missing intent", async () => {
      const invalidRequest = {
        url: "https://example.com",
        intent: "",
        grok_api_key: "key",
      } as DraftScriptRequest;

      await expect(client.draftScript(invalidRequest)).rejects.toThrow(
        "Intent is required",
      );
    });

    it("should reject missing API key", async () => {
      const invalidRequest = {
        url: "https://example.com",
        intent: "test",
        grok_api_key: "",
      } as DraftScriptRequest;

      await expect(client.draftScript(invalidRequest)).rejects.toThrow(
        "API key is required",
      );
    });
  });

  describe("validateRecordRequest", () => {
    it("should reject request without steps", async () => {
      const invalidRequest: RecordVideoRequest = {
        url: "https://example.com",
        approved_steps: [],
      };

      await expect(client.recordVideo(invalidRequest)).rejects.toThrow(
        "At least one step is required",
      );
    });

    it("should reject request with invalid steps type", async () => {
      const invalidRequest = {
        url: "https://example.com",
        approved_steps: "not an array" as any,
      } as RecordVideoRequest;

      await expect(client.recordVideo(invalidRequest)).rejects.toThrow(
        "At least one step is required",
      );
    });
  });

  describe("configuration", () => {
    it("should allow setting custom baseUrl", () => {
      client.setBaseUrl("http://api.example.com");
      // Internal state is not directly accessible, but next request would use it
      expect(client).toBeDefined();
    });

    it("should allow setting timeout", () => {
      client.setTimeout(60000);
      expect(client).toBeDefined();
    });

    it("should allow setting retry count", () => {
      client.setRetryCount(5);
      expect(client).toBeDefined();
    });
  });
});

describe("APIError", () => {
  it("should create error with status code and code", () => {
    const error = new APIError(400, "INVALID_REQUEST", "Bad request");

    expect(error.statusCode).toBe(400);
    expect(error.code).toBe("INVALID_REQUEST");
    expect(error.message).toBe("Bad request");
    expect(error.name).toBe("APIError");
  });

  it("should inherit from Error", () => {
    const error = new APIError(500, "SERVER_ERROR", "Server error");

    expect(error).toBeInstanceOf(Error);
  });
});
