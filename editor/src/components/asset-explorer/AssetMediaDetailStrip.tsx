import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useEditor } from '../../store/editor-store'
import type { AudioAsset, FontAsset } from '../../types'
import type { AssetExplorerSelection } from '../../hooks/useAssetExplorerActions'

export type AssetMediaDetailStripProps = Readonly<{
  selection: AssetExplorerSelection
}>

export function AssetMediaDetailStrip({ selection }: AssetMediaDetailStripProps) {
  const { state } = useEditor()
  const [open, setOpen] = useState(true)
  const project = state.project
  if (!project) return null

  if (selection.type === 'audio') {
    const asset: AudioAsset | undefined = project.audioAssets?.[selection.id]
    if (!asset) return null
    return (
      <DetailShell
        open={open}
        onToggle={() => setOpen((v) => !v)}
        title={`Audio — ${asset.name}`}
      >
        <p className="text-[10px] text-[var(--muted)] truncate" title={asset.path}>
          {asset.path}
        </p>
        <AudioPreview path={asset.path} projectPath={state.projectPath} />
      </DetailShell>
    )
  }

  if (selection.type === 'font') {
    const asset: FontAsset | undefined = project.fontAssets?.[selection.id]
    if (!asset) return null
    return (
      <DetailShell
        open={open}
        onToggle={() => setOpen((v) => !v)}
        title={`Font — ${asset.name}`}
      >
        <p className="text-[10px] text-[var(--muted)] truncate" title={asset.path}>
          {asset.path}
        </p>
        <p className="text-[10px] text-[var(--text)]">
          Default size: {asset.defaultSize ?? 32}px
        </p>
      </DetailShell>
    )
  }

  return null
}

function DetailShell({
  title,
  open,
  onToggle,
  children,
}: Readonly<{
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}>) {
  return (
    <div className="mx-2 mb-2 rounded border border-[var(--border)] bg-[var(--panel-2)] flex-shrink-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-1 px-2 py-1.5 text-left border-b border-[var(--border)]
                   hover:bg-[rgb(var(--border-rgb)/0.2)]"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown size={12} className="text-[var(--muted)]" />
        ) : (
          <ChevronRight size={12} className="text-[var(--muted)]" />
        )}
        <span className="text-[10px] font-semibold text-[var(--text)] truncate">{title}</span>
      </button>
      {open ? <div className="p-2 space-y-2">{children}</div> : null}
    </div>
  )
}

function AudioPreview({
  path,
  projectPath,
}: Readonly<{ path: string; projectPath: string | null }>) {
  const [src, setSrc] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
      if (src) URL.revokeObjectURL(src)
    }
  }, [src])

  useEffect(() => {
    setSrc(null)
    setPlaying(false)
    audioRef.current?.pause()
    audioRef.current = null
  }, [path, projectPath])

  if (!projectPath) {
    return <p className="text-[9px] text-[var(--muted)]">Save project to preview audio from disk.</p>
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="text-[10px] px-2 py-1 rounded border border-[var(--border)] hover:bg-[var(--panel-3)]"
        onClick={async () => {
          if (playing) {
            audioRef.current?.pause()
            audioRef.current = null
            setPlaying(false)
            return
          }
          let blobUrl = src
          if (!blobUrl) {
            const { readProjectFileBytes, bytesToArrayBuffer } = await import('../../utils/asset-file-api')
            const { dirName } = await import('../../utils/project')
            const root = dirName(projectPath)
            const bytes = await readProjectFileBytes(root, path)
            if (!bytes) return
            const blob = new Blob([bytesToArrayBuffer(bytes)])
            blobUrl = URL.createObjectURL(blob)
            setSrc(blobUrl)
          }
          const audio = new Audio(blobUrl)
          audioRef.current = audio
          audio.onended = () => {
            setPlaying(false)
            audioRef.current = null
          }
          setPlaying(true)
          void audio.play()
        }}
      >
        {playing ? 'Stop' : 'Play preview'}
      </button>
    </div>
  )
}
