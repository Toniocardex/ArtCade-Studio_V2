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
  /** Set when loaded from a graph the command editor cannot fully represent. */
  parseWarning?: string
}

export interface ParseDialogResult {
  script: DialogScript
  /** When set, graph is not fully editable as a command list. */
  parseWarning?: string
}

type GraphNode = Record<string, unknown>
type GraphNodes = Record<string, GraphNode>
type DialogChoiceOption = { text: string; next: string }
type SetVariableOp = '=' | '+=' | '-='

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

/** Avoid [object Object] when JSON fields are not strings. */
function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asGraphRef(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asSetVariableOp(value: unknown): SetVariableOp {
  if (value === '+=' || value === '-=' || value === '=') return value
  return '='
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && !Number.isNaN(value) ? value : Number(value) || 0
}

function nodeType(node: GraphNode): string {
  return asString(node.type)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asChoiceOptions(value: unknown): DialogChoiceOption[] {
  if (!Array.isArray(value)) return []
  const options: DialogChoiceOption[] = []
  for (const item of value) {
    if (!isRecord(item)) continue
    const text = asString(item.text)
    const next = asString(item.next)
    if (text && next) options.push({ text, next })
  }
  return options
}

interface CompileBlockResult {
  entry: string | null
  exit: string | null
  nodes: GraphNodes
}

interface CompileLinearState {
  nodes: GraphNodes
  prevExit: string | null
  entry: string | null
}

function linkNext(nodes: GraphNodes, from: string, to: string): void {
  nodes[from].next = to
}

function appendLinearNode(
  state: CompileLinearState,
  node: Record<string, unknown>,
): CompileLinearState {
  const id = allocId()
  state.nodes[id] = node
  if (state.prevExit) linkNext(state.nodes, state.prevExit, id)
  else state.entry = id
  return { ...state, prevExit: id }
}

function compileShowText(
  cmd: Extract<DialogCommand, { type: 'showText' }>,
  state: CompileLinearState,
): CompileLinearState {
  const node: Record<string, unknown> = {
    type: 'say',
    character: cmd.character,
    text: cmd.text,
  }
  if (cmd.portrait) node.portrait = cmd.portrait
  return appendLinearNode(state, node)
}

function compileSetVariable(
  cmd: Extract<DialogCommand, { type: 'setVariable' }>,
  state: CompileLinearState,
): CompileLinearState {
  return appendLinearNode(state, {
    type: 'setVariable',
    variable: cmd.variable,
    operation: cmd.operation,
    value: cmd.value,
  })
}

function compileEmitMessage(
  cmd: Extract<DialogCommand, { type: 'emitMessage' }>,
  state: CompileLinearState,
): CompileLinearState {
  return appendLinearNode(state, { type: 'emitEvent', event: cmd.event })
}

function compileCondition(
  cmd: Extract<DialogCommand, { type: 'condition' }>,
  state: CompileLinearState,
): CompileBlockResult {
  const id = allocId()
  const trueBlock = compileBlock(cmd.ifTrue)
  const falseBlock = compileBlock(cmd.ifFalse)
  const nodes = { ...state.nodes, ...trueBlock.nodes, ...falseBlock.nodes }
  nodes[id] = {
    type: 'condition',
    variable: cmd.variable,
    operator: cmd.operator,
    value: cmd.value,
    ifTrue: trueBlock.entry ?? ensureEnd(nodes),
    ifFalse: falseBlock.entry ?? ensureEnd(nodes),
  }
  if (state.prevExit) linkNext(nodes, state.prevExit, id)
  const entry = state.entry ?? id
  return { entry, exit: null, nodes }
}

function compileShowChoices(
  cmd: Extract<DialogCommand, { type: 'showChoices' }>,
  state: CompileLinearState,
): CompileBlockResult {
  const choiceId = allocId()
  const nodes = { ...state.nodes }
  const options: { text: string; next: string }[] = []
  for (const opt of cmd.options) {
    const branch = compileBlock(opt.commands)
    Object.assign(nodes, branch.nodes)
    options.push({ text: opt.text, next: branch.entry ?? ensureEnd(nodes) })
  }
  nodes[choiceId] = { type: 'choice', options }
  if (state.prevExit) linkNext(nodes, state.prevExit, choiceId)
  const entry = state.entry ?? choiceId
  return { entry, exit: null, nodes }
}

function compileEnd(state: CompileLinearState): CompileBlockResult {
  const nodes = { ...state.nodes }
  const endId = ensureEnd(nodes)
  if (state.prevExit) linkNext(nodes, state.prevExit, endId)
  return { entry: state.entry, exit: endId, nodes }
}

function compileLinearCommand(
  cmd: DialogCommand,
  state: CompileLinearState,
): CompileLinearState | CompileBlockResult {
  switch (cmd.type) {
    case 'showText':
      return compileShowText(cmd, state)
    case 'setVariable':
      return compileSetVariable(cmd, state)
    case 'emitMessage':
      return compileEmitMessage(cmd, state)
    case 'condition':
      return compileCondition(cmd, state)
    case 'showChoices':
      return compileShowChoices(cmd, state)
    case 'end':
      return compileEnd(state)
    default:
      return state
  }
}

function isTerminalCompileResult(
  result: CompileLinearState | CompileBlockResult,
): result is CompileBlockResult {
  return !('prevExit' in result)
}

function compileBlock(commands: DialogCommand[]): CompileBlockResult {
  let state: CompileLinearState = { nodes: {}, prevExit: null, entry: null }

  for (const cmd of commands) {
    const result = compileLinearCommand(cmd, state)
    if (isTerminalCompileResult(result)) return result
    state = result
  }

  if (state.prevExit) {
    const nodes = { ...state.nodes }
    const endId = ensureEnd(nodes)
    linkNext(nodes, state.prevExit, endId)
    return { entry: state.entry, exit: endId, nodes }
  }

  return { entry: state.entry, exit: null, nodes: state.nodes }
}

function ensureEnd(nodes: GraphNodes): string {
  const endId = allocEndId()
  if (!nodes[endId]) nodes[endId] = { type: 'end' }
  return endId
}

export function compileDialogScript(script: DialogScript): DialogGraphJson {
  resetIds()
  const { entry, nodes } = compileBlock(script.commands)
  if (!nodes.n_end) ensureEnd(nodes)
  const startNode = entry ?? Object.keys(nodes)[0] ?? ''
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

type ParseStep =
  | { kind: 'continue'; next: string | undefined }
  | { kind: 'stop'; commands: DialogCommand[] }
  | { kind: 'fail' }

function parseSayCommand(node: GraphNode): DialogCommand {
  return {
    type: 'showText',
    character: asString(node.character),
    text: asString(node.text),
    ...(typeof node.portrait === 'string' ? { portrait: node.portrait } : {}),
  }
}

function linearNextStep(node: GraphNode): ParseStep {
  return { kind: 'continue', next: asGraphRef(node.next) || undefined }
}

function parseSetVariableCommand(node: GraphNode): DialogCommand {
  return {
    type: 'setVariable',
    variable: asString(node.variable),
    operation: asSetVariableOp(node.operation),
    value: asNumber(node.value),
  }
}

function parseEmitCommand(node: GraphNode): DialogCommand {
  return { type: 'emitMessage', event: asString(node.event) }
}

function parseChoiceNode(
  graph: DialogGraphJson,
  node: GraphNode,
  endIds: Set<string>,
  visiting: Set<string>,
): ParseStep {
  const opts = asChoiceOptions(node.options)
  const options: { text: string; commands: DialogCommand[] }[] = []
  for (const opt of opts) {
    if (!opt.next) return { kind: 'fail' }
    const branch = parseBranch(graph, opt.next, endIds, new Set(visiting))
    if (branch === null) return { kind: 'fail' }
    options.push({ text: opt.text, commands: branch })
  }
  return { kind: 'stop', commands: [{ type: 'showChoices', options }] }
}

function parseConditionNode(
  graph: DialogGraphJson,
  node: GraphNode,
  endIds: Set<string>,
  visiting: Set<string>,
): ParseStep {
  const ifTrue = asGraphRef(node.ifTrue)
  const ifFalse = asGraphRef(node.ifFalse)
  const trueCmds = parseBranch(graph, ifTrue, endIds, new Set(visiting))
  const falseCmds = parseBranch(graph, ifFalse, endIds, new Set(visiting))
  if (trueCmds === null || falseCmds === null) return { kind: 'fail' }
  return {
    kind: 'stop',
    commands: [
      {
        type: 'condition',
        variable: asString(node.variable),
        operator: asString(node.operator, '=='),
        value: asNumber(node.value),
        ifTrue: trueCmds,
        ifFalse: falseCmds,
      },
    ],
  }
}

function parseGraphNode(
  graph: DialogGraphJson,
  node: GraphNode,
  endIds: Set<string>,
  visiting: Set<string>,
): { step: ParseStep; command?: DialogCommand } {
  const t = nodeType(node)
  if (t === 'say') {
    return { step: linearNextStep(node), command: parseSayCommand(node) }
  }
  if (t === 'setVariable') {
    return { step: linearNextStep(node), command: parseSetVariableCommand(node) }
  }
  if (t === 'emitEvent') {
    return { step: linearNextStep(node), command: parseEmitCommand(node) }
  }
  if (t === 'end') {
    return { step: { kind: 'stop', commands: [{ type: 'end' }] } }
  }
  if (t === 'choice') {
    return { step: parseChoiceNode(graph, node, endIds, visiting) }
  }
  if (t === 'condition') {
    return { step: parseConditionNode(graph, node, endIds, visiting) }
  }
  return { step: { kind: 'fail' } }
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

    const { step, command } = parseGraphNode(graph, raw, endIds, visiting)
    if (step.kind === 'fail') return null
    if (command) commands.push(command)
    if (step.kind === 'stop') {
      commands.push(...step.commands)
      return commands
    }
    cur = step.next
  }

  return commands
}

function collectEndNodeIds(graph: DialogGraphJson): Set<string> {
  const endIds = new Set<string>()
  for (const [id, raw] of Object.entries(graph.nodes)) {
    if (nodeType(raw) === 'end') endIds.add(id)
  }
  return endIds
}

export function parseDialogGraph(graph: DialogGraphJson): ParseDialogResult {
  const endIds = collectEndNodeIds(graph)
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
  const sortedNodes: GraphNodes = {}
  for (const key of Object.keys(graph.nodes).sort((a, b) => a.localeCompare(b))) {
    sortedNodes[key] = graph.nodes[key]
  }
  return { ...graph, nodes: sortedNodes }
}

type CanonNode = Record<string, unknown>

function canonSayNode(raw: GraphNode, queue: string[], remapRef: (r: string | undefined) => string | undefined): CanonNode {
  const out: CanonNode = { type: raw.type, character: raw.character, text: raw.text }
  if (typeof raw.portrait === 'string') out.portrait = raw.portrait
  const nextRef = asGraphRef(raw.next)
  if (nextRef) {
    out.next = remapRef(nextRef)
    queue.push(nextRef)
  }
  return out
}

function canonChoiceNode(raw: GraphNode, queue: string[], remapRef: (r: string | undefined) => string | undefined): CanonNode {
  return {
    type: raw.type,
    options: asChoiceOptions(raw.options).map((opt) => {
      queue.push(opt.next)
      const next = remapRef(opt.next) ?? opt.next
      return { text: opt.text, next }
    }),
  }
}

function canonSetVariableNode(raw: GraphNode, queue: string[], remapRef: (r: string | undefined) => string | undefined): CanonNode {
  const out: CanonNode = { type: raw.type, variable: raw.variable, operation: raw.operation, value: raw.value }
  const nextRef = asGraphRef(raw.next)
  if (nextRef) {
    out.next = remapRef(nextRef)
    queue.push(nextRef)
  }
  return out
}

function canonEmitNode(raw: GraphNode, queue: string[], remapRef: (r: string | undefined) => string | undefined): CanonNode {
  const out: CanonNode = { type: raw.type, event: raw.event }
  const nextRef = asGraphRef(raw.next)
  if (nextRef) {
    out.next = remapRef(nextRef)
    queue.push(nextRef)
  }
  return out
}

function canonConditionNode(raw: GraphNode, queue: string[], remapRef: (r: string | undefined) => string | undefined): CanonNode {
  const ifTrueRef = asGraphRef(raw.ifTrue)
  const ifFalseRef = asGraphRef(raw.ifFalse)
  const out: CanonNode = {
    type: raw.type,
    variable: raw.variable,
    operator: raw.operator,
    value: raw.value,
    ifTrue: remapRef(ifTrueRef),
    ifFalse: remapRef(ifFalseRef),
  }
  if (ifTrueRef) queue.push(ifTrueRef)
  if (ifFalseRef) queue.push(ifFalseRef)
  return out
}

function buildCanonNode(
  raw: GraphNode,
  queue: string[],
  remapRef: (ref: string | undefined) => string | undefined,
): CanonNode {
  const t = nodeType(raw)
  if (t === 'say') return canonSayNode(raw, queue, remapRef)
  if (t === 'choice') return canonChoiceNode(raw, queue, remapRef)
  if (t === 'setVariable') return canonSetVariableNode(raw, queue, remapRef)
  if (t === 'emitEvent') return canonEmitNode(raw, queue, remapRef)
  if (t === 'condition') return canonConditionNode(raw, queue, remapRef)
  if (t === 'end') return { type: raw.type }
  return { ...raw }
}

/** Relabel node ids in BFS order so structurally equal graphs compare equal. */
export function canonicalizeDialogGraph(graph: DialogGraphJson): DialogGraphJson {
  const idMap = new Map<string, string>()
  let seq = 0
  const mapId = (old: string): string => {
    if (old === 'n_end') return 'n_end'
    let mapped = idMap.get(old)
    if (!mapped) {
      seq += 1
      mapped = `n${seq}`
      idMap.set(old, mapped)
    }
    return mapped
  }

  const remapRef = (ref: string | undefined): string | undefined => {
    if (!ref) return ref
    return ref === 'n_end' ? 'n_end' : mapId(ref)
  }

  const visited = new Set<string>()
  const queue = [graph.startNode]
  const canonNodes: Record<string, CanonNode> = {}

  while (queue.length > 0) {
    const oldId = queue.shift()
    if (oldId === undefined) break
    if (visited.has(oldId)) continue
    visited.add(oldId)

    const raw = graph.nodes[oldId]
    if (!raw) continue

    const newId = oldId === 'n_end' ? 'n_end' : mapId(oldId)
    canonNodes[newId] = buildCanonNode(raw, queue, remapRef)
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
