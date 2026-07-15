export function ExplorerEmptyProject() {
  return (
    <div className="h-full flex items-center justify-center bg-[var(--surface)]">
      <span className="text-[var(--muted)] text-xs">No project</span>
    </div>
  )
}

export function ExplorerFooter({
  sceneCount,
  typeCount,
  instanceCount,
}: Readonly<{ sceneCount: number; typeCount: number; instanceCount: number }>) {
  return (
    <div className="px-2 py-1 border-t border-[var(--outline)] text-[9px] text-[var(--muted)] flex-shrink-0">
      {sceneCount} scenes · {typeCount} types · {instanceCount} instances
    </div>
  )
}
