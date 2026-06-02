import { useState } from 'react'
import ProjectExplorerPanel from '../project-explorer/ProjectExplorerPanel'
import { EditorTab } from '../ui/EditorTab'
import { SceneLayersPanel } from '../project-explorer/SceneLayersPanel'

type CompactTab = 'project' | 'assets' | 'objects'

/** Unified left rail for compact/minimal layout tiers (ADAPTIVE_LAYOUT D6). */
export default function CompactLeftSidebar() {
  const [tab, setTab] = useState<CompactTab>('project')
  const [sceneSubTab, setSceneSubTab] = useState<'hierarchy' | 'layers'>('hierarchy')

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
        {tab === 'project' && (
          <div className="h-full flex flex-col min-h-0">
            <div className="shrink-0 flex border-b border-[var(--outline-subtle)]">
              <EditorTab
                active={sceneSubTab === 'hierarchy'}
                onClick={() => setSceneSubTab('hierarchy')}
                className="flex-1 !text-[8px]"
              >
                Hierarchy
              </EditorTab>
              <EditorTab
                active={sceneSubTab === 'layers'}
                onClick={() => setSceneSubTab('layers')}
                className="flex-1 !text-[8px]"
              >
                Layers
              </EditorTab>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {sceneSubTab === 'layers' ? (
                <SceneLayersPanel />
              ) : (
                <ProjectExplorerPanel explorerPane="scene" />
              )}
            </div>
          </div>
        )}
        {tab === 'assets' && <ProjectExplorerPanel explorerPane="assets" />}
        {tab === 'objects' && <ProjectExplorerPanel explorerPane="all" />}
      </div>
    </div>
  )
}
