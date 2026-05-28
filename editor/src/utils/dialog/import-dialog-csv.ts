/**
 * CSV → dialogs/{dialogId}.json (ArtCade dialog format).
 * See docs/DIALOG_CSV_FORMAT.md.
 */

export interface DialogGraphJson {
  dialogId: string
  startNode: string
  nodes: Record<string, Record<string, unknown>>
}

export interface ImportDialogCsvResult {
  graphs: DialogGraphJson[]
  errors: string[]
}

type Row = Record<string, string>

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out
}

function parseCsv(text: string): Row[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim())
  if (lines.length < 2) return []
  const headers = splitCsvLine(lines[0]).map((h) => h.trim())
  const rows: Row[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i])
    const row: Row = {}
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] ?? '').trim()
    })
    rows.push(row)
  }
  return rows
}

function mapRecordType(rt: string): string {
  switch (rt) {
    case 'say': return 'say'
    case 'choice': return 'choice'
    case 'condition': return 'condition'
    case 'set_var': return 'setVariable'
    case 'emit': return 'emitEvent'
    case 'end': return 'end'
    default: return rt
  }
}

export function importDialogCsv(csvText: string): ImportDialogCsvResult {
  const rows = parseCsv(csvText)
  const errors: string[] = []
  const byDialog = new Map<string, DialogGraphJson>()

  for (const row of rows) {
    const dialogId = row.dialog_id
    const id = row.id
    const rt = row.record_type
    if (!dialogId || !id || !rt) {
      errors.push(`skip row: missing dialog_id, id, or record_type`)
      continue
    }

    if (!byDialog.has(dialogId)) {
      byDialog.set(dialogId, { dialogId, startNode: '', nodes: {} })
    }
    const graph = byDialog.get(dialogId)!
    const type = mapRecordType(rt)

    if (type === 'choice') {
      let node = graph.nodes[id] as { type: string; options?: { text: string; next: string }[] }
      if (!node) {
        node = { type: 'choice', options: [] }
        graph.nodes[id] = node
      }
      const optText = row.option_text
      const optNext = row.next
      const idx = Number(row.option_index) || (node.options?.length ?? 0) + 1
      if (!node.options) node.options = []
      node.options[idx - 1] = { text: optText, next: optNext }
      continue
    }

    const node: Record<string, unknown> = { type }
    if (row.character) node.character = row.character
    if (row.text) node.text = row.text
    if (row.text_key) node.textKey = row.text_key
    if (row.portrait) node.portrait = row.portrait
    if (row.next) node.next = row.next
    if (type === 'condition') {
      node.variable = row.variable
      node.operator = row.operator || row.op || '=='
      node.value = Number(row.value) || 0
      if (row.if_true) node.ifTrue = row.if_true
      if (row.if_false) node.ifFalse = row.if_false
    }
    if (type === 'setVariable') {
      node.variable = row.variable
      node.operation = row.operation || '='
      node.value = Number(row.value) || 0
    }
    if (type === 'emitEvent') {
      node.event = row.event
    }
    graph.nodes[id] = node

    if (!graph.startNode && type === 'say') graph.startNode = id
    if (graph.startNode === '' && id === 'n1') graph.startNode = 'n1'
  }

  const graphs: DialogGraphJson[] = []
  for (const g of byDialog.values()) {
    if (!g.startNode) {
      const first = Object.keys(g.nodes)[0]
      g.startNode = first ?? ''
    }
    if (!g.startNode) errors.push(`dialog ${g.dialogId}: no start node`)
    else graphs.push(g)
  }

  return { graphs, errors }
}

export function dialogGraphToJson(graph: DialogGraphJson): string {
  return JSON.stringify(graph, null, 2)
}
