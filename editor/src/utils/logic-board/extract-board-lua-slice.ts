// ---------------------------------------------------------------------------
// Extract per-board regions from compiled Logic Board Lua.
// Markers match compiler.ts: `${INDENT}-- board: ${label}`
// ---------------------------------------------------------------------------

const BOARD_MARKER = /^\s*-- board: (.+)\s*$/

export interface BoardLuaSlice {
  text: string
  sectionCount: number
}

/**
 * Return all `-- board: <boardLabel>` regions from a full compile output.
 * Multiple regions (init + tick) are joined with a blank line.
 */
export function extractBoardLuaSlice(fullLua: string, boardLabel: string): BoardLuaSlice {
  if (!boardLabel.trim()) {
    return { text: '', sectionCount: 0 }
  }

  const lines = fullLua.split('\n')
  const chunks: string[] = []
  let i = 0

  while (i < lines.length) {
    const match = lines[i].match(BOARD_MARKER)
    if (!match || match[1] !== boardLabel) {
      i++
      continue
    }

    const start = i
    i++
    while (i < lines.length) {
      const next = lines[i].match(BOARD_MARKER)
      if (next && next[1] !== boardLabel) break
      i++
    }
    chunks.push(lines.slice(start, i).join('\n'))
  }

  return {
    text: chunks.join('\n\n'),
    sectionCount: chunks.length,
  }
}
