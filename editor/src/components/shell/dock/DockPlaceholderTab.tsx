export type DockPlaceholderTabProps = Readonly<{
  title: string
  message: string
}>

export function DockPlaceholderTab({ title, message }: DockPlaceholderTabProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-4 text-center">
      <p className="editor-panel-header !border-0 !bg-transparent !justify-center">
        <span className="editor-panel-header__title">{title}</span>
      </p>
      <p className="text-[var(--muted)] mt-2 max-w-md leading-relaxed">{message}</p>
    </div>
  )
}
