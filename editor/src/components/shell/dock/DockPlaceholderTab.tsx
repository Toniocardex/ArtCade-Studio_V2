export type DockPlaceholderTabProps = Readonly<{
  title: string
  message: string
}>

export function DockPlaceholderTab({ title, message }: DockPlaceholderTabProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--primary)]">
        {title}
      </p>
      <p className="text-[10px] text-[var(--muted)] mt-2 max-w-md">{message}</p>
    </div>
  )
}
