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

/** Lua colours on Industrial Mid-Grey script wells (light theme = mid-grey UI, not paper-white). */
const artcadeHighlightLight = HighlightStyle.define([
  { tag: t.comment,   color: '#8FA893', fontStyle: 'normal' },
  { tag: t.keyword,   color: '#7BA3D4' },
  { tag: t.string,    color: '#D4A574' },
  { tag: t.number,    color: '#A8C99A' },
  { tag: t.regexp,    color: '#D48A8A' },
  { tag: t.operator,  color: '#D0D0D0' },
  { tag: t.function(t.variableName), color: '#D4C88A' },
  { tag: t.variableName, color: '#9EC8E8' },
  { tag: t.typeName,  color: '#6EC9B8' },
  { tag: t.bracket,   color: '#D0D0D0' },
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
    backgroundColor: '#3A3A3A',
    color: '#E0E0E0',
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
    backgroundColor: '#3A3A3A',
    color: '#7A7A7A',
    border: 'none',
  },
  '.cm-activeLineGutter': { color: '#999999' },
  '.cm-activeLine': { backgroundColor: '#454545' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: '#5C83C440',
  },
  '&.cm-focused .cm-cursor': { borderLeftColor: '#E0E0E0' },
}, { dark: true })

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
