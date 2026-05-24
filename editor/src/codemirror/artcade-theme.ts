import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import type { Extension } from '@codemirror/state'

const artcadeHighlightDark = HighlightStyle.define([
  { tag: t.comment,   color: '#7A9C7E', fontStyle: 'normal' },
  { tag: t.keyword,   color: '#569CD6' },
  { tag: t.string,    color: '#CE9178' },
  { tag: t.number,    color: '#B5CEA8' },
  { tag: t.regexp,    color: '#D16969' },
  { tag: t.operator,  color: '#D4D4D4' },
  { tag: t.function(t.variableName), color: '#DCDCAA' },
  { tag: t.variableName, color: '#9CDCFE' },
  { tag: t.typeName,  color: '#4EC9B0' },
  { tag: t.bracket,   color: '#D4D4D4' },
])

const artcadeHighlightLight = HighlightStyle.define([
  { tag: t.comment,   color: '#5D7A61', fontStyle: 'normal' },
  { tag: t.keyword,   color: '#0000FF' },
  { tag: t.string,    color: '#A31515' },
  { tag: t.number,    color: '#098658' },
  { tag: t.function(t.variableName), color: '#795E26' },
])

const editorThemeDark = EditorView.theme({
  '&': {
    backgroundColor: '#09090B',
    color: '#E4E4E7',
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
    backgroundColor: '#09090B',
    color: '#52525B',
    border: 'none',
  },
  '.cm-activeLineGutter': { color: '#A1A1AA' },
  '.cm-activeLine': { backgroundColor: '#18181B' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: '#1E3A8A80',
  },
  '&.cm-focused .cm-cursor': { borderLeftColor: '#E4E4E7' },
}, { dark: true })

const editorThemeLight = EditorView.theme({
  '&': {
    backgroundColor: '#FAFAFA',
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
    backgroundColor: '#FAFAFA',
    color: '#71717A',
    border: 'none',
  },
  '.cm-activeLine': { backgroundColor: '#F4F4F5' },
  '&.cm-focused .cm-cursor': { borderLeftColor: '#18181B' },
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
