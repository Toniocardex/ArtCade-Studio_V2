import { useRef, useState } from 'react'
import { ChevronDown, Layers, ListTree } from 'lucide-react'
import ProjectExplorerPanel from '../project-explorer/ProjectExplorerPanel'
import { ExplorerExpandedProvider } from '../project-explorer/ExplorerExpandedContext'
import { SceneLayersPanel } from '../project-explorer/SceneLayersPanel'
import HorizontalSplitHandle from '../HorizontalSplitHandle'
import { EditorTab } from '../ui/EditorTab'
import { SegmentedControl } from '../ui/SegmentedControl'
import { usePersistedSplitRatio } from '../../hooks/usePersistedSplitRatio'

type SceneSubTab = 'hierarchy' | 'layers'
type CompactTab = 'project' | 'assets' | 'objects'

export type ExplorerShellProps = Readonly<{
  variant: 'stacked' | 'compact'
}>

const SCENE_SEGMENTS = [
  { value: 'hierarchy', label: 'Hierarchy', icon: ListTree },
  { value: 'layers', label: 'Layers', icon: Layers },
] as const

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
      // localStorage unavailable; in-memory state is still usable for this session.
    }
  }
  return [value, set]
}

function SectionTitlebar({
  label,
  collapsed,
  onToggle,
}: Readonly<{
  label: string
  collapsed: boolean
  onToggle: () => void
}>) {
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

function ScenePane({
  sceneSubTab,
  setSceneSubTab,
}: Readonly<{
  sceneSubTab: SceneSubTab
  setSceneSubTab: (tab: SceneSubTab) => void
}>) {
  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="shrink-0 border-b border-[var(--outline-subtle)] p-1">
        <SegmentedControl
          value={sceneSubTab}
          onChange={(value) => setSceneSubTab(value as SceneSubTab)}
          options={SCENE_SEGMENTS}
          aria-label="Scene explorer mode"
        />
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {sceneSubTab === 'layers' ? (
          <SceneLayersPanel />
        ) : (
          <ProjectExplorerPanel explorerPane="scene" />
        )}
      </div>
    </div>
  )
}

function StackedExplorerShell({
  sceneSubTab,
  setSceneSubTab,
}: Readonly<{
  sceneSubTab: SceneSubTab
  setSceneSubTab: (tab: SceneSubTab) => void
}>) {
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
      <section className="min-h-0 flex flex-col overflow-hidden shrink-0" style={{ flex: sceneFlex }}>
        <SectionTitlebar
          label="Scene"
          collapsed={sceneCollapsed}
          onToggle={() => setSceneCollapsed(!sceneCollapsed)}
        />
        {!sceneCollapsed ? <ScenePane sceneSubTab={sceneSubTab} setSceneSubTab={setSceneSubTab} /> : null}
      </section>

      {bothExpanded ? <HorizontalSplitHandle onResize={onResizeSplit} /> : null}

      <section className="min-h-0 flex flex-col overflow-hidden" style={{ flex: assetsFlex }}>
        <SectionTitlebar
          label="Assets"
          collapsed={assetsCollapsed}
          onToggle={() => setAssetsCollapsed(!assetsCollapsed)}
        />
        {!assetsCollapsed ? (
          <div className="flex-1 min-h-0 overflow-hidden">
            <ProjectExplorerPanel explorerPane="assets" />
          </div>
        ) : null}
      </section>
    </div>
  )
}

function CompactExplorerShell({
  sceneSubTab,
  setSceneSubTab,
}: Readonly<{
  sceneSubTab: SceneSubTab
  setSceneSubTab: (tab: SceneSubTab) => void
}>) {
  const [tab, setTab] = useState<CompactTab>('project')

  return (
    <div className="h-full min-h-0 flex flex-col bg-[var(--surface)]">
      <div className="shrink-0 flex border-b border-[var(--outline)]">
        <EditorTab active={tab === 'project'} onClick={() => setTab('project')} className="flex-1 !text-[9px]">
          Project
        </EditorTab>
        <EditorTab active={tab === 'assets'} onClick={() => setTab('assets')} className="flex-1 !text-[9px]">
          Assets
        </EditorTab>
        <EditorTab active={tab === 'objects'} onClick={() => setTab('objects')} className="flex-1 !text-[9px]">
          Objects
        </EditorTab>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'project' ? (
          <ScenePane sceneSubTab={sceneSubTab} setSceneSubTab={setSceneSubTab} />
        ) : null}
        {tab === 'assets' ? <ProjectExplorerPanel explorerPane="assets" /> : null}
        {tab === 'objects' ? <ProjectExplorerPanel explorerPane="scene" /> : null}
      </div>
    </div>
  )
}

export function ExplorerShell({ variant }: ExplorerShellProps) {
  const [sceneSubTab, setSceneSubTab] = useState<SceneSubTab>('hierarchy')

  const shell = variant === 'compact' ? (
    <CompactExplorerShell sceneSubTab={sceneSubTab} setSceneSubTab={setSceneSubTab} />
  ) : (
    <StackedExplorerShell sceneSubTab={sceneSubTab} setSceneSubTab={setSceneSubTab} />
  )

  return <ExplorerExpandedProvider>{shell}</ExplorerExpandedProvider>
}
