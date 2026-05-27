/** Parse a number from Logic Board numeric fields (supports comma decimals). */
export function parseLogicNumber(raw: string): number | undefined {
  const s = raw.trim().replace(',', '.')
  if (s === '') return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}
