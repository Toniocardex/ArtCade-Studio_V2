import type { ImageAsset, ImagePointDef } from '../../types'

export type ImagePointsEditorProps = Readonly<{
  asset: ImageAsset
  onPatchPoints: (points: ImagePointDef[]) => void
}>

export function ImagePointsEditor({ asset, onPatchPoints }: ImagePointsEditorProps) {
  const points = asset.imagePoints ?? []

  return (
    <div className="p-2 rounded border border-[var(--border)] bg-[var(--panel-3)]">
      <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-2">
        Image points — {asset.name}
      </p>
      <ul className="space-y-1 mb-2">
        {points.map((pt, i) => (
          <li key={pt.id || i} className="flex gap-2 items-center text-xs">
            <input
              className="bg-[var(--bg)] border border-[var(--border-2)] rounded px-1 w-20"
              value={pt.id}
              placeholder="id"
              onChange={(e) => {
                const next = [...points]
                next[i] = { ...pt, id: e.target.value }
                onPatchPoints(next)
              }}
            />
            <input
              type="number"
              step="0.01"
              className="bg-[var(--bg)] border border-[var(--border-2)] rounded px-1 w-14"
              value={pt.x}
              onChange={(e) => {
                const next = [...points]
                next[i] = { ...pt, x: Number.parseFloat(e.target.value) || 0 }
                onPatchPoints(next)
              }}
            />
            <input
              type="number"
              step="0.01"
              className="bg-[var(--bg)] border border-[var(--border-2)] rounded px-1 w-14"
              value={pt.y}
              onChange={(e) => {
                const next = [...points]
                next[i] = { ...pt, y: Number.parseFloat(e.target.value) || 0 }
                onPatchPoints(next)
              }}
            />
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="text-[10px] text-[var(--muted)] underline underline-offset-2 hover:text-[var(--text)]"
        onClick={() => {
          onPatchPoints([
            ...points,
            { id: `point_${points.length + 1}`, x: 0.5, y: 0.5 },
          ])
        }}
      >
        + Add point
      </button>
    </div>
  )
}
