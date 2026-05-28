/**
 * Dialog Editor — visual graph (React Flow) + CSV import.
 * Exports dialogs/{dialogId}.json alongside project.json.
 */
import { useCallback, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { importDialogCsv, dialogGraphToJson } from '../utils/dialog/import-dialog-csv'

const initialNodes: Node[] = [
  { id: 'n1', position: { x: 0, y: 0 }, data: { label: 'Say: Welcome' }, type: 'input' },
  { id: 'n2', position: { x: 220, y: 0 }, data: { label: 'Choice' } },
]

const initialEdges: Edge[] = [{ id: 'e1-2', source: 'n1', target: 'n2' }]

export default function DialogEditorPanel() {
  const [dialogId, setDialogId] = useState('innkeeper')
  const [jsonPreview, setJsonPreview] = useState('')
  const [importLog, setImportLog] = useState('')
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const onConnect = useCallback(
    (conn: Connection) => setEdges((eds) => addEdge(conn, eds)),
    [setEdges],
  )

  const flowProps = useMemo(
    () => ({ nodes, edges, onNodesChange, onEdgesChange, onConnect, fitView: true }),
    [nodes, edges, onNodesChange, onEdgesChange, onConnect],
  )

  const handleCsvFile = useCallback(async (file: File) => {
    const text = await file.text()
    const { graphs, errors } = importDialogCsv(text)
    setImportLog([...errors, `Imported ${graphs.length} dialog(s)`].join('\n'))
    if (graphs[0]) {
      setDialogId(graphs[0].dialogId)
      setJsonPreview(dialogGraphToJson(graphs[0]))
      const flowNodes: Node[] = Object.keys(graphs[0].nodes).map((id, i) => ({
        id,
        position: { x: (i % 4) * 200, y: Math.floor(i / 4) * 120 },
        data: {
          label: `${(graphs[0].nodes[id] as { type?: string }).type ?? '?'}: ${id}`,
        },
      }))
      const flowEdges: Edge[] = []
      for (const [id, raw] of Object.entries(graphs[0].nodes)) {
        const node = raw as { next?: string; options?: { next: string }[] }
        if (node.next)
          flowEdges.push({ id: `${id}-${node.next}`, source: id, target: node.next })
        node.options?.forEach((opt, oi) => {
          if (opt.next)
            flowEdges.push({
              id: `${id}-opt${oi}-${opt.next}`,
              source: id,
              target: opt.next,
              label: opt.next,
            })
        })
      }
      setNodes(flowNodes)
      setEdges(flowEdges)
    }
  }, [setNodes, setEdges])

  const exportHint = `Save to project: dialogs/${dialogId}.json (use File → Save Project after copying JSON)`

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[var(--bg)] text-[var(--text)]">
      <header className="shrink-0 px-4 py-2 border-b border-[var(--border)] flex items-center gap-3 flex-wrap">
        <h1 className="text-sm font-semibold">Dialog Editor</h1>
        <label className="text-xs">
          Dialog ID{' '}
          <input
            className="ml-1 px-2 py-1 rounded border border-[var(--border)] bg-[var(--panel)]"
            value={dialogId}
            onChange={(e) => setDialogId(e.target.value)}
          />
        </label>
        <label className="text-xs cursor-pointer px-2 py-1 rounded border border-[var(--border)] hover:bg-[var(--panel)]">
          Import CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleCsvFile(f)
            }}
          />
        </label>
      </header>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 min-h-[320px]">
          <ReactFlow {...flowProps}>
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>
        <aside className="w-80 shrink-0 border-l border-[var(--border)] flex flex-col p-3 gap-2 text-xs overflow-auto">
          <p className="text-[var(--muted)]">{exportHint}</p>
          {importLog && <pre className="text-[10px] whitespace-pre-wrap text-[var(--warn)]">{importLog}</pre>}
          <textarea
            className="flex-1 min-h-[200px] font-mono text-[11px] p-2 rounded border border-[var(--border)] bg-[var(--panel)]"
            placeholder="JSON preview after CSV import…"
            value={jsonPreview}
            onChange={(e) => setJsonPreview(e.target.value)}
          />
        </aside>
      </div>
    </div>
  )
}
