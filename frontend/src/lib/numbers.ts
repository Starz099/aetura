/**
 * Number utilities and helpers.
 */

/**
 * Clamp a number between min and max values.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Safely convert a value to a number.
 */
export function toNumber(value: unknown, defaultValue: number = 0): number {
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Check if a value is a valid number.
 */
export function isValidNumber(value: unknown): boolean {
  if (typeof value !== "number") return false;
  return !isNaN(value) && isFinite(value);
}

/**
 * Round number to specified decimal places.
 */
export function round(value: number, decimals: number = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Format number as percentage with specified decimal places.
 */
export function toPercent(value: number, decimals: number = 1): string {
  return `${round(value * 100, decimals)}%`;
}

/**
 * Format number with commas for thousands separator.
 */
export function formatNumber(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
