// ---------------------------------------------------------------------------
// LeftSidebar — Scene (hierarchy + layers) above Assets, resizable split.
// ---------------------------------------------------------------------------

import { useRef, useState } from 'react'
import ProjectExplorerPanel from './project-explorer/ProjectExplorerPanel'
import { EditorTab } from './ui/EditorTab'
import { SceneLayersPanel } from './project-explorer/SceneLayersPanel'
import HorizontalSplitHandle from './HorizontalSplitHandle'
import { usePersistedSplitRatio } from '../hooks/usePersistedSplitRatio'

export default function LeftSidebar() {
  const [sceneTab, setSceneTab] = useState<'hierarchy' | 'layers'>('hierarchy')
  const [topPct, setTopPct] = usePersistedSplitRatio('artcade.left-split-top-pct-v1', 52)
  const stackRef = useRef<HTMLDivElement>(null)

  const onResizeSplit = (deltaPx: number) => {
    const el = stackRef.current
    if (!el || el.clientHeight <= 0) return
    const deltaPct = (deltaPx / el.clientHeight) * 100
    setTopPct((p) => p + deltaPct)
  }

  return (
    <div ref={stackRef} className="h-full min-h-0 flex flex-col bg-[var(--surface)]">
      <section
        className="min-h-0 flex flex-col overflow-hidden shrink-0"
        style={{ flex: `${topPct} 1 0%` }}
      >
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
      </section>

      <HorizontalSplitHandle onResize={onResizeSplit} />

      <section
        className="min-h-0 flex flex-col overflow-hidden"
        style={{ flex: `${100 - topPct} 1 0%` }}
      >
        <div className="shrink-0 px-3 py-1.5 border-b border-[var(--outline)] text-[9px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          Assets
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <ProjectExplorerPanel explorerPane="assets" />
        </div>
      </section>
    </div>
  )
}
