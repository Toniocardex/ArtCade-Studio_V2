import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import type { Extension } from '@codemirror/state'

/** Lua syntax — dark (EDITOR_MOCKUP_TOKENS.md --syn-*). */
const artcadeHighlightDark = HighlightStyle.define([
  { tag: t.comment,   color: '#34D399', fontStyle: 'normal' },
  { tag: t.keyword,   color: '#60A5FA' },
  { tag: t.string,    color: '#FBBF24' },
  { tag: t.number,    color: '#F472B6' },
  { tag: t.regexp,    color: '#EF4444' },
  { tag: t.operator,  color: '#D4D4D8' },
  { tag: t.function(t.variableName), color: '#A78BFA' },
  { tag: t.variableName, color: '#D4D4D8' },
  { tag: t.typeName,  color: '#60A5FA' },
  { tag: t.bracket,   color: '#D4D4D8' },
])

/** Lua syntax — light (EDITOR_MOCKUP_TOKENS.md --syn-*). */
const artcadeHighlightLight = HighlightStyle.define([
  { tag: t.comment,   color: '#059669', fontStyle: 'normal' },
  { tag: t.keyword,   color: '#2563EB' },
  { tag: t.string,    color: '#B45309' },
  { tag: t.number,    color: '#DB2777' },
  { tag: t.regexp,    color: '#DC2626' },
  { tag: t.operator,  color: '#71717A' },
  { tag: t.function(t.variableName), color: '#7C3AED' },
  { tag: t.variableName, color: '#18181B' },
  { tag: t.typeName,  color: '#2563EB' },
  { tag: t.bracket,   color: '#71717A' },
])

const editorThemeDark = EditorView.theme({
  '&': {
    backgroundColor: '#09090B',
    color: '#D4D4D8',
  },
  '.cm-content': {
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    fontSize: '14px',
    lineHeight: '22px',
    fontStyle: 'normal',
  },
  '.cm-scroller': {
    overflow: 'auto',
    overscrollBehavior: 'contain',
  },
  '.cm-gutters': {
    backgroundColor: '#18181B',
    color: '#52525B',
    border: 'none',
  },
  '.cm-activeLineGutter': { color: '#D4D4D8' },
  '.cm-activeLine': { backgroundColor: '#27272A' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: '#3B82F640',
  },
  '&.cm-focused .cm-cursor': { borderLeftColor: '#D4D4D8' },
}, { dark: true })

const editorThemeLight = EditorView.theme({
  '&': {
    backgroundColor: '#FFFFFF',
    color: '#18181B',
  },
  '.cm-content': {
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    fontSize: '14px',
    lineHeight: '22px',
    fontStyle: 'normal',
  },
  '.cm-scroller': {
    overflow: 'auto',
    overscrollBehavior: 'contain',
  },
  '.cm-gutters': {
    backgroundColor: '#F4F4F5',
    color: '#A1A1AA',
    border: 'none',
  },
  '.cm-activeLineGutter': { color: '#2563EB' },
  '.cm-activeLine': { backgroundColor: '#DBEAFE' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: '#2563EB40',
  },
  '&.cm-focused .cm-cursor': { borderLeftColor: '#2563EB' },
}, { dark: false })

export const artcadeDark: Extension[] = [
  editorThemeDark,
  syntaxHighlighting(artcadeHighlightDark, { fallback: true }),
]

export const artcadeLight: Extension[] = [
  editorThemeLight,
  syntaxHighlighting(artcadeHighlightLight, { fallback: true }),
]

export function themeExtensions(themeId: string): Extension[] {
  return themeId === 'artcade-light' ? artcadeLight : artcadeDark
}
