import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import type { Extension } from '@codemirror/state'

/** Desaturated Lua tokens on Dark Anthracite script wells. */
const artcadeHighlightDark = HighlightStyle.define([
  { tag: t.comment,   color: '#6F8F7A', fontStyle: 'normal' },
  { tag: t.keyword,   color: '#6F8A9B' },
  { tag: t.string,    color: '#B59A5B' },
  { tag: t.number,    color: '#8D969E' },
  { tag: t.regexp,    color: '#B86A62' },
  { tag: t.operator,  color: '#AAB2B8' },
  { tag: t.function(t.variableName), color: '#C4CBD0' },
  { tag: t.variableName, color: '#AAB2B8' },
  { tag: t.typeName,  color: '#6B7C87' },
  { tag: t.bracket,   color: '#AAB2B8' },
])

/** Lua colours on Industrial Mid-Grey script wells (light theme). */
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
    backgroundColor: '#111518',
    color: '#D8DEE3',
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
    backgroundColor: '#111518',
    color: '#555E65',
    border: 'none',
  },
  '.cm-activeLineGutter': { color: '#AAB2B8' },
  '.cm-activeLine': { backgroundColor: '#1B2024' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: '#33414C99',
  },
  '&.cm-focused .cm-cursor': { borderLeftColor: '#D8DEE3' },
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
