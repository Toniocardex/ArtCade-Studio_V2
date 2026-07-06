/** Debug session d62e8e — NDJSON ingest for canvas/render boot diagnosis. */
const DEBUG_INGEST =
  'http://127.0.0.1:7495/ingest/0f55c839-caed-4777-81e5-65e85359fb9f'

export function debugSceneLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
): void {
  // #region agent log
  fetch(DEBUG_INGEST, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': 'd62e8e',
    },
    body: JSON.stringify({
      sessionId: 'd62e8e',
      location,
      message,
      data,
      hypothesisId,
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion
}
