import { useEditor } from '../../store/editor-store'

const LAYER_ROWS = [
  { name: 'Debug', order: 700 },
  { name: 'UI', order: 600 },
  { name: 'Foreground', order: 500 },
  { name: 'Gameplay', order: 400 },
  { name: 'Collision', order: 300 },
  { name: 'Platforms', order: 200 },
  { name: 'Background', order: 100 },
  { name: 'Parallax Far', order: 0 },
] as const

/** UI-only layer reference (spec §4) until ProjectDoc gains a layer model. */
export function SceneLayersPanel() {
  const { state } = useEditor()
  const scene = state.project?.scenes.find((s) => s.id === state.selection.sceneId)

  return (
    <div className="h-full overflow-auto p-2 text-[10px]">
      <p className="text-[var(--muted)] mb-2 px-1">
        Layer ordering for <strong className="text-[var(--primary)]">{scene?.name ?? 'scene'}</strong>.
        Assign entities via Inspector (Layer field).
      </p>
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-[var(--muted)] uppercase tracking-wide text-[8px]">
            <th className="text-left py-1">Layer</th>
            <th className="text-right py-1">Order</th>
          </tr>
        </thead>
        <tbody>
          {LAYER_ROWS.map((row) => (
            <tr key={row.name} className="border-t border-[var(--outline-faint)]">
              <td className="py-1.5 text-[var(--primary)]">{row.name}</td>
              <td className="py-1.5 text-right font-mono text-[var(--muted)]">{row.order}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
