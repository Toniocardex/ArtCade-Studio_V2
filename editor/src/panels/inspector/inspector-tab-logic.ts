export type InspectorTab = 'entity' | 'scene'

/**
 * Tab rules:
 *   • No entity selected → Scene
 *   • First selection (none → entity) → Entity
 *   • Switch between entities → keep current tab
 *   • Deselect → Scene
 */
export function nextInspectorTab(
  prevTab: InspectorTab,
  prevHadEntity: boolean,
  hasEntity: boolean,
): InspectorTab {
  if (!hasEntity) return 'scene'
  if (!prevHadEntity) return 'entity'
  return prevTab
}

export function inspectorBodyView(opts: {
  tab: InspectorTab
  hasEntity: boolean
  hasScene: boolean
}): 'entity' | 'scene' | 'empty' {
  if (opts.tab === 'entity' && opts.hasEntity) return 'entity'
  if (opts.tab === 'scene' && opts.hasScene) return 'scene'
  return 'empty'
}
