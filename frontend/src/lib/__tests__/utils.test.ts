/**
 * Tests for utility functions.
 */

import { describe, it, expect } from "vitest";
import {
  clamp,
  toNumber,
  isValidNumber,
  round,
  formatNumber,
} from "../numbers";
import {
  formatTime,
  formatTimeVerbose,
  parseTime,
  validateTimeRange,
  clampTime,
} from "../time";
import {
  isValidUrl,
  isValidEmail,
  isEmpty,
  isNotEmpty,
  isValidDuration,
  isPositiveInteger,
} from "../validation";

describe("Number utilities", () => {
  describe("clamp", () => {
    it("should clamp values within range", () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });

  describe("toNumber", () => {
    it("should convert string to number", () => {
      expect(toNumber("123")).toBe(123);
      expect(toNumber("45.6")).toBe(45.6);
    });

    it("should return default on invalid", () => {
      expect(toNumber("abc")).toBe(0);
      expect(toNumber("abc", 99)).toBe(99);
    });
  });

  describe("isValidNumber", () => {
    it("should validate numbers", () => {
      expect(isValidNumber(123)).toBe(true);
      expect(isValidNumber("123")).toBe(false);
      expect(isValidNumber(NaN)).toBe(false);
      expect(isValidNumber(Infinity)).toBe(false);
    });
  });

  describe("round", () => {
    it("should round to specified decimals", () => {
      expect(round(3.14159, 2)).toBe(3.14);
      expect(round(3.5)).toBe(4);
    });
  });

  describe("formatNumber", () => {
    it("should format with thousands separator", () => {
      expect(formatNumber(1000)).toBe("1,000");
      expect(formatNumber(1234567)).toBe("1,234,567");
    });
  });
});

describe("Time utilities", () => {
  describe("formatTime", () => {
    it("should format seconds to HH:MM:SS", () => {
      expect(formatTime(0)).toBe("0:00");
      expect(formatTime(65)).toBe("1:05");
      expect(formatTime(3661)).toBe("1:01:01");
    });
  });

  describe("formatTimeVerbose", () => {
    it("should format as readable string", () => {
      expect(formatTimeVerbose(0)).toBe("0 seconds");
      expect(formatTimeVerbose(60)).toBe("1 minute");
      expect(formatTimeVerbose(65)).toBe("1 minute 5 seconds");
    });
  });

  describe("parseTime", () => {
    it("should parse MM:SS format", () => {
      expect(parseTime("1:30")).toBe(90);
      expect(parseTime("0:45")).toBe(45);
    });

    it("should parse HH:MM:SS format", () => {
      expect(parseTime("1:01:30")).toBe(3690);
    });

    it("should return 0 for invalid", () => {
      expect(parseTime("invalid")).toBe(0);
    });
  });

  describe("validateTimeRange", () => {
    it("should validate time within range", () => {
      expect(validateTimeRange(5, 0, 10)).toBe(true);
      expect(validateTimeRange(-1, 0, 10)).toBe(false);
      expect(validateTimeRange(11, 0, 10)).toBe(false);
    });
  });

  describe("clampTime", () => {
    it("should clamp time to range", () => {
      expect(clampTime(5, 0, 10)).toBe(5);
      expect(clampTime(-5, 0, 10)).toBe(0);
      expect(clampTime(15, 0, 10)).toBe(10);
    });
  });
});

describe("Validation utilities", () => {
  describe("isValidUrl", () => {
    it("should validate URLs", () => {
      expect(isValidUrl("https://example.com")).toBe(true);
      expect(isValidUrl("http://localhost:8000")).toBe(true);
      expect(isValidUrl("not a url")).toBe(false);
    });
  });

  describe("isValidEmail", () => {
    it("should validate emails", () => {
      expect(isValidEmail("test@example.com")).toBe(true);
      expect(isValidEmail("invalid@")).toBe(false);
      expect(isValidEmail("notanemail")).toBe(false);
    });
  });

  describe("isEmpty", () => {
    it("should check if string is empty", () => {
      expect(isEmpty("")).toBe(true);
      expect(isEmpty("   ")).toBe(true);
      expect(isEmpty("text")).toBe(false);
    });
  });

  describe("isNotEmpty", () => {
    it("should check if string has content", () => {
      expect(isNotEmpty("text")).toBe(true);
      expect(isNotEmpty("")).toBe(false);
      expect(isNotEmpty("   ")).toBe(false);
    });
  });

  describe("isValidDuration", () => {
    it("should validate positive duration", () => {
      expect(isValidDuration(10)).toBe(true);
      expect(isValidDuration(0)).toBe(false);
      expect(isValidDuration(-5)).toBe(false);
      expect(isValidDuration(Infinity)).toBe(false);
    });
  });

  describe("isPositiveInteger", () => {
    it("should validate positive integers", () => {
      expect(isPositiveInteger(1)).toBe(true);
      expect(isPositiveInteger(0)).toBe(false);
      expect(isPositiveInteger(1.5)).toBe(false);
      expect(isPositiveInteger("1")).toBe(false);
    });
  });
});
