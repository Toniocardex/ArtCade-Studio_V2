// ---------------------------------------------------------------------------
// LeftSidebar - Scene (hierarchy + layers) above Assets, resizable split.
// Each section can be collapsed to its titlebar to give the other full height.
// ---------------------------------------------------------------------------

import { useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import ProjectExplorerPanel from './project-explorer/ProjectExplorerPanel'
import { EditorTab } from './ui/EditorTab'
import { SceneLayersPanel } from './project-explorer/SceneLayersPanel'
import HorizontalSplitHandle from './HorizontalSplitHandle'
import { usePersistedSplitRatio } from '../hooks/usePersistedSplitRatio'

function usePersistedFlag(key: string, initial: boolean): [boolean, (next: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const raw = globalThis.localStorage?.getItem(key)
      return raw === null || raw === undefined ? initial : raw === '1'
    } catch {
      return initial
    }
  })
  const set = (next: boolean) => {
    setValue(next)
    try {
      globalThis.localStorage?.setItem(key, next ? '1' : '0')
    } catch {
      // localStorage unavailable (private mode) — keep in-memory state only
    }
  }
  return [value, set]
}

type SectionTitlebarProps = Readonly<{
  label: string
  collapsed: boolean
  onToggle: () => void
}>

function SectionTitlebar({ label, collapsed, onToggle }: SectionTitlebarProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      title={collapsed ? `Expand ${label}` : `Collapse ${label}`}
      className="editor-panel-titlebar w-full !justify-between cursor-pointer
                 hover:bg-[var(--surface-hover)] transition-colors text-left"
    >
      <span>{label}</span>
      <ChevronDown
        size={12}
        className={`text-[var(--muted)] transition-transform ${collapsed ? '-rotate-90' : ''}`}
        aria-hidden
      />
    </button>
  )
}

export default function LeftSidebar() {
  const [sceneTab, setSceneTab] = useState<'hierarchy' | 'layers'>('hierarchy')
  const [topPct, setTopPct] = usePersistedSplitRatio('artcade.left-split-top-pct-v1', 52)
  const [sceneCollapsed, setSceneCollapsed] = usePersistedFlag('artcade.left-scene-collapsed-v1', false)
  const [assetsCollapsed, setAssetsCollapsed] = usePersistedFlag('artcade.left-assets-collapsed-v1', false)
  const stackRef = useRef<HTMLDivElement>(null)

  const onResizeSplit = (deltaPx: number) => {
    const el = stackRef.current
    if (!el || el.clientHeight <= 0) return
    const deltaPct = (deltaPx / el.clientHeight) * 100
    setTopPct((p) => p + deltaPct)
  }

  const bothExpanded = !sceneCollapsed && !assetsCollapsed

  const sceneFlex = sceneCollapsed
    ? '0 0 auto'
    : assetsCollapsed
      ? '1 1 0%'
      : `${topPct} 1 0%`
  const assetsFlex = assetsCollapsed
    ? '0 0 auto'
    : sceneCollapsed
      ? '1 1 0%'
      : `${100 - topPct} 1 0%`

  return (
    <div ref={stackRef} className="h-full min-h-0 flex flex-col bg-[var(--surface)]">
      <section
        className="min-h-0 flex flex-col overflow-hidden shrink-0"
        style={{ flex: sceneFlex }}
      >
        <SectionTitlebar
          label="Scene"
          collapsed={sceneCollapsed}
          onToggle={() => setSceneCollapsed(!sceneCollapsed)}
        />
        {!sceneCollapsed && (
          <>
            <div className="shrink-0 flex border-b border-[var(--outline)]">
              <EditorTab active={sceneTab === 'hierarchy'} onClick={() => setSceneTab('hierarchy')} className="flex-1 !text-[9px]">
                Hierarchy
              </EditorTab>
              <EditorTab active={sceneTab === 'layers'} onClick={() => setSceneTab('layers')} className="flex-1 !text-[9px]">
                Layers
              </EditorTab>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {sceneTab === 'layers' ? (
                <SceneLayersPanel />
              ) : (
                <ProjectExplorerPanel explorerPane="scene" />
              )}
            </div>
          </>
        )}
      </section>

      {bothExpanded && <HorizontalSplitHandle onResize={onResizeSplit} />}

      <section
        className="min-h-0 flex flex-col overflow-hidden"
        style={{ flex: assetsFlex }}
      >
        <SectionTitlebar
          label="Assets"
          collapsed={assetsCollapsed}
          onToggle={() => setAssetsCollapsed(!assetsCollapsed)}
        />
        {!assetsCollapsed && (
          <div className="flex-1 min-h-0 overflow-hidden">
            <ProjectExplorerPanel explorerPane="assets" />
          </div>
        )}
      </section>
    </div>
  )
}
