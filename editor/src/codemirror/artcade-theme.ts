import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import type { Extension } from '@codemirror/state'

/** Desaturated Lua tokens on Dark Premium Anthracite script wells. */
const artcadeHighlightDark = HighlightStyle.define([
  { tag: t.comment,   color: '#4F8F73', fontStyle: 'normal' },
  { tag: t.keyword,   color: '#6E7684' },
  { tag: t.string,    color: '#B8973F' },
  { tag: t.number,    color: '#7C828C' },
  { tag: t.regexp,    color: '#A35656' },
  { tag: t.operator,  color: '#C7CCD4' },
  { tag: t.function(t.variableName), color: '#C7CCD4' },
  { tag: t.variableName, color: '#C7CCD4' },
  { tag: t.typeName,  color: '#6E7684' },
  { tag: t.bracket,   color: '#C7CCD4' },
])

/** Lua tokens on Light Premium script wells. */
const artcadeHighlightLight = HighlightStyle.define([
  { tag: t.comment,   color: '#16A34A', fontStyle: 'normal' },
  { tag: t.keyword,   color: '#3B82F6' },
  { tag: t.string,    color: '#B45309' },
  { tag: t.number,    color: '#2563EB' },
  { tag: t.regexp,    color: '#DC2626' },
  { tag: t.operator,  color: '#64748B' },
  { tag: t.function(t.variableName), color: '#2563EB' },
  { tag: t.variableName, color: '#1F2937' },
  { tag: t.typeName,  color: '#0F766E' },
  { tag: t.bracket,   color: '#64748B' },
])

const editorThemeDark = EditorView.theme({
  '&': {
    backgroundColor: '#0B0B0C',
    color: '#F2F2F2',
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
    backgroundColor: '#0B0B0C',
    color: '#626873',
    border: 'none',
  },
  '.cm-activeLineGutter': { color: '#C7CCD4' },
  '.cm-activeLine': { backgroundColor: '#111214' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: '#33425B99',
  },
  '&.cm-focused .cm-cursor': { borderLeftColor: '#F2F2F2' },
}, { dark: true })

const editorThemeLight = EditorView.theme({
  '&': {
    backgroundColor: '#FFFFFF',
    color: '#1F2937',
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
    backgroundColor: '#F7F9FB',
    color: '#64748B',
    border: 'none',
  },
  '.cm-activeLineGutter': { color: '#3B82F6' },
  '.cm-activeLine': { backgroundColor: '#EEF4FF' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: '#DBEAFE',
  },
  '&.cm-focused .cm-cursor': { borderLeftColor: '#3B82F6' },
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
