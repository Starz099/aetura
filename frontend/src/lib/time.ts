/**
 * Time and duration utilities.
 */

/**
 * Format seconds to HH:MM:SS format.
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format seconds to verbose time string (e.g., "1 hour 30 minutes").
 */
export function formatTimeVerbose(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
  }

  if (minutes > 0) {
    parts.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`);
  }

  if (secs > 0 || parts.length === 0) {
    parts.push(`${secs} second${secs !== 1 ? "s" : ""}`);
  }

  return parts.join(" ");
}

/**
 * Parse time string in format HH:MM:SS or MM:SS to seconds.
 */
export function parseTime(timeStr: string): number {
  const parts = timeStr.split(":");

  if (parts.length === 2) {
    const [minutes, seconds] = parts.map(Number);
    return minutes * 60 + seconds;
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts.map(Number);
    return hours * 3600 + minutes * 60 + seconds;
  }

  return 0;
}

/**
 * Validate that a time value is within a specified range.
 */
export function validateTimeRange(
  time: number,
  min: number,
  max: number,
): boolean {
  return time >= min && time <= max;
}

/**
 * Get duration from start to end time.
 */
export function getDuration(startTime: number, endTime: number): number {
  return Math.max(0, endTime - startTime);
}

/**
 * Check if time is in range [start, end].
 */
export function isTimeInRange(
  time: number,
  startTime: number,
  endTime: number,
): boolean {
  return time >= startTime && time <= endTime;
}

/**
 * Clamp time value between min and max.
 */
export function clampTime(
  time: number,
  minTime: number,
  maxTime: number,
): number {
  return Math.max(minTime, Math.min(maxTime, time));
}
