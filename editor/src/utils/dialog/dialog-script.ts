/**
 * RPG Maker–style dialog script ↔ runtime graph JSON.
 * See docs/DIALOG_SYSTEM.md.
 */

import type { DialogGraphJson } from './import-dialog-csv'

export type DialogCommand =
  | { type: 'showText'; character: string; text: string; portrait?: string }
  | {
      type: 'showChoices'
      options: { text: string; commands: DialogCommand[] }[]
    }
  | {
      type: 'setVariable'
      variable: string
      operation: '=' | '+=' | '-='
      value: number
    }
  | { type: 'emitMessage'; event: string }
  | {
      type: 'condition'
      variable: string
      operator: string
      value: number
      ifTrue: DialogCommand[]
      ifFalse: DialogCommand[]
    }
  | { type: 'end' }

export interface DialogScript {
  dialogId: string
  commands: DialogCommand[]
}

export interface ParseDialogResult {
  script: DialogScript
  /** When set, graph is not fully editable as a command list. */
  parseWarning?: string
}

type GraphNode = Record<string, unknown> & {
  type?: string
  next?: string
  options?: { text: string; next: string }[]
}

let idSeq = 0

function resetIds(): void {
  idSeq = 0
}

function allocId(): string {
  idSeq += 1
  return `n${idSeq}`
}

function allocEndId(): string {
  return 'n_end'
}

interface CompileBlockResult {
  entry: string | null
  exit: string | null
  nodes: Record<string, Record<string, unknown>>
}

function compileBlock(commands: DialogCommand[]): CompileBlockResult {
  const nodes: Record<string, Record<string, unknown>> = {}
  let prevExit: string | null = null
  let entry: string | null = null

  const linkNext = (from: string, to: string) => {
    nodes[from].next = to
  }

  for (const cmd of commands) {
    switch (cmd.type) {
      case 'showText': {
        const id = allocId()
        const node: Record<string, unknown> = {
          type: 'say',
          character: cmd.character,
          text: cmd.text,
        }
        if (cmd.portrait) node.portrait = cmd.portrait
        nodes[id] = node
        if (prevExit) linkNext(prevExit, id)
        else entry = id
        prevExit = id
        break
      }
      case 'setVariable': {
        const id = allocId()
        nodes[id] = {
          type: 'setVariable',
          variable: cmd.variable,
          operation: cmd.operation,
          value: cmd.value,
        }
        if (prevExit) linkNext(prevExit, id)
        else entry = id
        prevExit = id
        break
      }
      case 'emitMessage': {
        const id = allocId()
        nodes[id] = {
          type: 'emitEvent',
          event: cmd.event,
        }
        if (prevExit) linkNext(prevExit, id)
        else entry = id
        prevExit = id
        break
      }
      case 'condition': {
        const id = allocId()
        const trueBlock = compileBlock(cmd.ifTrue)
        const falseBlock = compileBlock(cmd.ifFalse)
        Object.assign(nodes, trueBlock.nodes, falseBlock.nodes)
        nodes[id] = {
          type: 'condition',
          variable: cmd.variable,
          operator: cmd.operator,
          value: cmd.value,
          ifTrue: trueBlock.entry ?? ensureEnd(nodes),
          ifFalse: falseBlock.entry ?? ensureEnd(nodes),
        }
        if (prevExit) linkNext(prevExit, id)
        else entry = id
        return { entry, exit: null, nodes }
      }
      case 'showChoices': {
        const choiceId = allocId()
        nodes[choiceId] = { type: 'choice', options: [] as { text: string; next: string }[] }
        if (prevExit) linkNext(prevExit, choiceId)
        else entry = choiceId
        const options = (nodes[choiceId].options ?? []) as { text: string; next: string }[]
        for (const opt of cmd.options) {
          const branch = compileBlock(opt.commands)
          Object.assign(nodes, branch.nodes)
          const branchEntry = branch.entry ?? ensureEnd(nodes)
          options.push({ text: opt.text, next: branchEntry })
        }
        nodes[choiceId].options = options
        return { entry, exit: null, nodes }
      }
      case 'end': {
        const endId = ensureEnd(nodes)
        if (prevExit) linkNext(prevExit, endId)
        return { entry, exit: endId, nodes }
      }
      default:
        break
    }
  }

  if (prevExit) {
    const endId = ensureEnd(nodes)
    linkNext(prevExit, endId)
    return { entry, exit: endId, nodes }
  }

  return { entry, exit: null, nodes }
}

function ensureEnd(nodes: Record<string, Record<string, unknown>>): string {
  const endId = allocEndId()
  if (!nodes[endId]) nodes[endId] = { type: 'end' }
  return endId
}

export function compileDialogScript(script: DialogScript): DialogGraphJson {
  resetIds()
  const { entry, nodes } = compileBlock(script.commands)
  const startNode = entry ?? Object.keys(nodes)[0] ?? ''
  if (!nodes.n_end && Object.keys(nodes).length > 0) ensureEnd(nodes)
  return {
    dialogId: script.dialogId,
    startNode,
    nodes,
  }
}

export function emptyDialogScript(dialogId: string): DialogScript {
  return {
    dialogId,
    commands: [
      { type: 'showText', character: '', text: '' },
      { type: 'end' },
    ],
  }
}

function nodeType(node: GraphNode): string {
  return String(node.type ?? '')
}

function parseBranch(
  graph: DialogGraphJson,
  startId: string,
  endIds: Set<string>,
  visiting: Set<string>,
): DialogCommand[] | null {
  const commands: DialogCommand[] = []
  let cur: string | undefined = startId

  while (cur) {
    if (endIds.has(cur)) return commands
    if (visiting.has(cur)) return null
    visiting.add(cur)

    const raw = graph.nodes[cur]
    if (!raw) return null
    const node = raw as GraphNode
    const t = nodeType(node)

    if (t === 'say') {
      commands.push({
        type: 'showText',
        character: String(node.character ?? ''),
        text: String(node.text ?? ''),
        ...(node.portrait ? { portrait: String(node.portrait) } : {}),
      })
      cur = node.next
      continue
    }

    if (t === 'setVariable') {
      commands.push({
        type: 'setVariable',
        variable: String(node.variable ?? ''),
        operation: (node.operation as '=' | '+=' | '-=') ?? '=',
        value: Number(node.value) || 0,
      })
      cur = node.next
      continue
    }

    if (t === 'emitEvent') {
      commands.push({
        type: 'emitMessage',
        event: String(node.event ?? ''),
      })
      cur = node.next
      continue
    }

    if (t === 'end') {
      commands.push({ type: 'end' })
      return commands
    }

    if (t === 'choice') {
      const opts = node.options ?? []
      const options: { text: string; commands: DialogCommand[] }[] = []
      for (const opt of opts) {
        if (!opt.next) return null
        const branch = parseBranch(graph, opt.next, endIds, new Set(visiting))
        if (branch === null) return null
        options.push({ text: opt.text, commands: branch })
      }
      commands.push({ type: 'showChoices', options })
      return commands
    }

    if (t === 'condition') {
      const ifTrue = String(node.ifTrue ?? '')
      const ifFalse = String(node.ifFalse ?? '')
      const trueCmds = parseBranch(graph, ifTrue, endIds, new Set(visiting))
      const falseCmds = parseBranch(graph, ifFalse, endIds, new Set(visiting))
      if (trueCmds === null || falseCmds === null) return null
      commands.push({
        type: 'condition',
        variable: String(node.variable ?? ''),
        operator: String(node.operator ?? '=='),
        value: Number(node.value) || 0,
        ifTrue: trueCmds,
        ifFalse: falseCmds,
      })
      return commands
    }

    return null
  }

  return commands
}

export function parseDialogGraph(graph: DialogGraphJson): ParseDialogResult {
  const endIds = new Set<string>()
  for (const [id, raw] of Object.entries(graph.nodes)) {
    if (nodeType(raw as GraphNode) === 'end') endIds.add(id)
  }

  const commands = parseBranch(graph, graph.startNode, endIds, new Set())
  if (commands === null) {
    return {
      script: { dialogId: graph.dialogId, commands: [] },
      parseWarning:
        'This dialog uses an advanced graph layout. Edit the JSON file or re-import CSV.',
    }
  }

  return {
    script: { dialogId: graph.dialogId, commands },
  }
}

/** Normalize graph for test comparison (stable key order). */
export function normalizeDialogGraph(graph: DialogGraphJson): DialogGraphJson {
  const sortedNodes: Record<string, Record<string, unknown>> = {}
  for (const key of Object.keys(graph.nodes).sort()) {
    sortedNodes[key] = graph.nodes[key]
  }
  return { ...graph, nodes: sortedNodes }
}

type CanonNode = Record<string, unknown>

/** Relabel node ids in BFS order so structurally equal graphs compare equal. */
export function canonicalizeDialogGraph(graph: DialogGraphJson): DialogGraphJson {
  const idMap = new Map<string, string>()
  let seq = 0
  const mapId = (old: string): string => {
    if (old === 'n_end') return 'n_end'
    if (!idMap.has(old)) {
      seq += 1
      idMap.set(old, `n${seq}`)
    }
    return idMap.get(old)!
  }

  const remapRef = (ref: string | undefined): string | undefined => {
    if (!ref) return ref
    return ref === 'n_end' ? 'n_end' : mapId(ref)
  }

  const visited = new Set<string>()
  const queue = [graph.startNode]
  const canonNodes: Record<string, CanonNode> = {}

  while (queue.length) {
    const oldId = queue.shift()!
    if (visited.has(oldId)) continue
    visited.add(oldId)

    const raw = graph.nodes[oldId] as GraphNode | undefined
    if (!raw) continue

    const newId = oldId === 'n_end' ? 'n_end' : mapId(oldId)
    const t = nodeType(raw)
    const out: CanonNode = { type: raw.type }

    if (t === 'say') {
      out.character = raw.character
      out.text = raw.text
      if (raw.portrait) out.portrait = raw.portrait
      if (raw.next) {
        out.next = remapRef(raw.next)
        queue.push(raw.next)
      }
    } else if (t === 'choice') {
      out.options = (raw.options ?? []).map((opt) => {
        queue.push(opt.next)
        return { text: opt.text, next: remapRef(opt.next)! }
      })
    } else if (t === 'setVariable') {
      out.variable = raw.variable
      out.operation = raw.operation
      out.value = raw.value
      if (raw.next) {
        out.next = remapRef(raw.next)
        queue.push(raw.next)
      }
    } else if (t === 'emitEvent') {
      out.event = raw.event
      if (raw.next) {
        out.next = remapRef(raw.next)
        queue.push(raw.next)
      }
    } else if (t === 'condition') {
      out.variable = raw.variable
      out.operator = raw.operator
      out.value = raw.value
      out.ifTrue = remapRef(String(raw.ifTrue ?? ''))
      out.ifFalse = remapRef(String(raw.ifFalse ?? ''))
      if (raw.ifTrue) queue.push(String(raw.ifTrue))
      if (raw.ifFalse) queue.push(String(raw.ifFalse))
    } else if (t === 'end') {
      // no refs
    } else {
      Object.assign(out, raw)
    }

    canonNodes[newId] = out
  }

  return {
    dialogId: graph.dialogId,
    startNode: graph.startNode === 'n_end' ? 'n_end' : mapId(graph.startNode),
    nodes: canonNodes,
  }
}

export function dialogGraphsStructurallyEqual(a: DialogGraphJson, b: DialogGraphJson): boolean {
  return (
    JSON.stringify(normalizeDialogGraph(canonicalizeDialogGraph(a))) ===
    JSON.stringify(normalizeDialogGraph(canonicalizeDialogGraph(b)))
  )
}
