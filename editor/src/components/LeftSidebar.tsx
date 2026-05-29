// ---------------------------------------------------------------------------
// LeftSidebar — unified Project Explorer (scenes, entities, types, assets).
// ---------------------------------------------------------------------------

import ProjectExplorerPanel from './project-explorer/ProjectExplorerPanel'

export default function LeftSidebar() {
  return (
    <div className="h-full min-h-0 flex flex-col bg-[var(--panel)]">
      <ProjectExplorerPanel />
    </div>
  )
}
