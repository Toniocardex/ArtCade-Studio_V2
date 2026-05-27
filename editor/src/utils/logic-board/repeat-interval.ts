/** Default spacing between Repeat iterations when the field is omitted. */
export const REPEAT_DEFAULT_INTERVAL_SECONDS = 0.5

/** Resolve Repeat interval for compile + summaries (seconds; 0 = same frame). */
export function repeatIntervalSeconds(
  intervalSeconds: number | null | undefined,
): number {
  if (intervalSeconds === undefined || intervalSeconds === null) {
    return REPEAT_DEFAULT_INTERVAL_SECONDS
  }
  const n = Number(intervalSeconds)
  if (!Number.isFinite(n)) return REPEAT_DEFAULT_INTERVAL_SECONDS
  return Math.max(0, n)
}
