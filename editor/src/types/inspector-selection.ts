/** Right inspector asset context (mirrors Project Explorer selection). */
export type InspectorAssetSelection =
  | { type: 'image'; id: string }
  | { type: 'audio'; id: string }
  | { type: 'font'; id: string }
  | { type: 'tileset'; id: string }
