/**
 * Validation utilities for common patterns.
 */

/**
 * Validate URL format.
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate email format.
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if string is empty or only whitespace.
 */
export function isEmpty(value: string): boolean {
  return !value || value.trim().length === 0;
}

/**
 * Check if string is not empty.
 */
export function isNotEmpty(value: string): boolean {
  return !isEmpty(value);
}

/**
 * Validate duration is positive.
 */
export function isValidDuration(duration: number): boolean {
  return typeof duration === "number" && duration > 0 && isFinite(duration);
}

/**
 * Validate array has at least one element.
 */
export function hasElements<T>(arr: T[]): boolean {
  return Array.isArray(arr) && arr.length > 0;
}

/**
 * Ensure value is a positive integer.
 */
export function isPositiveInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/**
 * Ensure value is a non-negative integer.
 */
export function isNonNegativeInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
