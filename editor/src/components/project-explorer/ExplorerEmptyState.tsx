import type { ReactNode } from 'react'

export function ExplorerEmptyState({
  title,
  detail,
  action,
}: Readonly<{
  title: string
  detail?: string
  action?: ReactNode
}>) {
  return (
    <div className="px-2 py-2 text-[10px] text-[var(--muted)]">
      <p className="font-medium text-[var(--text)]">{title}</p>
      {detail ? <p className="mt-0.5 leading-relaxed">{detail}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
