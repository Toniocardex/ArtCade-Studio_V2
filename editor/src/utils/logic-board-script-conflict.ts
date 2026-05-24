/** Normalize line endings and trailing whitespace for stable compare. */
export function normalizeScriptText(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd()
}

/** True when the open editor buffer differs from the latest Logic Board compile. */
export function logicBoardScriptOutOfSync(
  editorContent: string,
  compiledLua: string,
): boolean {
  return normalizeScriptText(editorContent) !== normalizeScriptText(compiledLua)
}
