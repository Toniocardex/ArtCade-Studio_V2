import { useEffect, useState } from 'react'
import { useEditorSelector } from '../../store/editor-store'
import {
  editorGetVariables,
  isReady as isWasmReady,
  type RuntimeVariableSnapshot,
} from '../../utils/wasm-bridge'
import { InspectorSection } from './inspector-fields'

const EMPTY: RuntimeVariableSnapshot = { globals: {}, locals: {} }

function VariableRows({ values }: Readonly<{ values: RuntimeVariableSnapshot['globals'] }>) {
  const entries = Object.entries(values).sort(([a], [b]) => a.localeCompare(b))
  if (!entries.length) return <p className="text-[10px] text-[var(--muted)]">No declared values.</p>
  return (
    <div className="space-y-1 font-mono text-[10px]">
      {entries.map(([key, value]) => (
        <div key={key} className="grid grid-cols-[1fr_auto] gap-2">
          <span className="truncate text-[var(--muted)]">{key}</span>
          <span>{String(value)}</span>
        </div>
      ))}
    </div>
  )
}

export function VariableWatchSection({ entityId = 0 }: Readonly<{ entityId?: number }>) {
  const isPlaying = useEditorSelector((state) => state.isPlaying)
  const [snapshot, setSnapshot] = useState(EMPTY)

  useEffect(() => {
    if (!isPlaying || !isWasmReady()) {
      setSnapshot(EMPTY)
      return
    }
    const update = () => setSnapshot(editorGetVariables(entityId) ?? EMPTY)
    update()
    const timer = window.setInterval(update, 200)
    return () => window.clearInterval(timer)
  }, [entityId, isPlaying])

  if (!isPlaying) return null
  return (
    <InspectorSection label="Runtime Variable Watch" defaultOpen>
      <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-[var(--muted)]">Globals</p>
      <VariableRows values={snapshot.globals} />
      {entityId !== 0 && (
        <>
          <p className="mb-1 mt-3 text-[9px] font-bold uppercase tracking-widest text-[var(--muted)]">Object locals</p>
          <VariableRows values={snapshot.locals} />
        </>
      )}
    </InspectorSection>
  )
}
