import { useEffect, useState } from 'react'
import type { Monaco } from '@monaco-editor/react'
import { useEditor } from '../store/editor-store'
import CodeEditor from '../components/CodeEditor'

/** Tracks the <html data-theme> attribute so Monaco follows the app theme. */
function useThemeMode(): 'dark' | 'light' {
  const read = () =>
    document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
  const [theme, setTheme] = useState<'dark' | 'light'>(read)
  useEffect(() => {
    const obs = new MutationObserver(() => setTheme(read()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return theme
}

// ---------------------------------------------------------------------------
// ArtCade Lua autocomplete — registered once on Monaco mount
// ---------------------------------------------------------------------------

function registerLuaExtras(monaco: Monaco) {
  const mk      = monaco.languages.CompletionItemKind
  const snippet = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet

  monaco.languages.registerCompletionItemProvider('lua', {
    provideCompletionItems: (model: import('monaco-editor').editor.ITextModel, position: import('monaco-editor').Position) => {
      const word  = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
        startColumn: word.startColumn,        endColumn:    word.endColumn,
      }

      const suggestions = [
        { label: 'entity.setPosition',      kind: mk.Function, insertTextRules: snippet, range, insertText: 'entity.setPosition(${1:id}, ${2:x}, ${3:y})'       },
        { label: 'entity.setVelocity',      kind: mk.Function, insertTextRules: snippet, range, insertText: 'entity.setVelocity(${1:id}, ${2:vx}, ${3:vy})'     },
        { label: 'entity.position',         kind: mk.Function, insertTextRules: snippet, range, insertText: 'entity.position(${1:id})'                            },
        { label: 'entity.velocity',         kind: mk.Function, insertTextRules: snippet, range, insertText: 'entity.velocity(${1:id})'                            },
        { label: 'entity.destroy',          kind: mk.Function, insertTextRules: snippet, range, insertText: 'entity.destroy(${1:id})'                             },
        { label: 'pool.getAll',             kind: mk.Function, insertTextRules: snippet, range, insertText: 'pool.getAll("${1:ClassName}")'                       },
        { label: 'pool.getFirst',           kind: mk.Function, insertTextRules: snippet, range, insertText: 'pool.getFirst("${1:ClassName}")'                     },
        { label: 'pool.count',              kind: mk.Function, insertTextRules: snippet, range, insertText: 'pool.count("${1:ClassName}")'                        },
        { label: 'input.isKeyDown',         kind: mk.Function, insertTextRules: snippet, range, insertText: 'input.isKeyDown("${1:W}")'                           },
        { label: 'input.wasKeyPressed',     kind: mk.Function, insertTextRules: snippet, range, insertText: 'input.wasKeyPressed("${1:Space}")'                   },
        { label: 'input.wasKeyReleased',    kind: mk.Function, insertTextRules: snippet, range, insertText: 'input.wasKeyReleased("${1:Space}")'                  },
        { label: 'collision.overlap',       kind: mk.Function, insertTextRules: snippet, range, insertText: 'collision.overlap(${1:id1}, ${2:id2})'               },
        { label: 'collision.touchingClass', kind: mk.Function, insertTextRules: snippet, range, insertText: 'collision.touchingClass(${1:id}, "${2:Ground}")'     },
        { label: 'audio.playSound',         kind: mk.Function, insertTextRules: snippet, range, insertText: 'audio.playSound("${1:path}", ${2:1.0}, ${3:1.0})'   },
        { label: 'audio.playMusic',         kind: mk.Function, insertTextRules: snippet, range, insertText: 'audio.playMusic("${1:path}", ${2:true})'             },
        { label: 'audio.stopAll',           kind: mk.Function, insertTextRules: snippet, range, insertText: 'audio.stopAll()'                                     },
        { label: 'state.get',               kind: mk.Function, insertTextRules: snippet, range, insertText: 'state.get("${1:key}")'                               },
        { label: 'state.set',               kind: mk.Function, insertTextRules: snippet, range, insertText: 'state.set("${1:key}", ${2:value})'                   },
        { label: 'state.add',               kind: mk.Function, insertTextRules: snippet, range, insertText: 'state.add("${1:key}", ${2:1})'                      },
        { label: 'debug.log',               kind: mk.Function, insertTextRules: snippet, range, insertText: 'debug.log(${1:msg})'                                 },
        { label: 'event.emit',              kind: mk.Function, insertTextRules: snippet, range, insertText: 'event.emit("${1:name}", ${2:{}})'                    },
        { label: 'event.on',               kind: mk.Function, insertTextRules: snippet, range, insertText: 'event.on("${1:name}", function(data)\n\t$0\nend)'    },
        { label: 'time.elapsed',            kind: mk.Property, insertTextRules: snippet, range, insertText: 'time.elapsed()'                                      },
        { label: 'save.write',             kind: mk.Function, insertTextRules: snippet, range, insertText: 'save.write("${1:slot}", ${2:data})'                  },
        { label: 'save.read',              kind: mk.Function, insertTextRules: snippet, range, insertText: 'save.read("${1:slot}")'                               },
      ]

      return { suggestions }
    },
  })
}

// ---------------------------------------------------------------------------
// Script tab bar
// ---------------------------------------------------------------------------

function ScriptTabBar({ paths, activePath, dirtyPaths, onSelect }: {
  paths:      string[]
  activePath: string | null
  dirtyPaths: Set<string>
  onSelect:   (path: string) => void
}) {
  return (
    <div className="flex overflow-x-auto border-b border-[var(--border)] bg-[var(--panel)] flex-shrink-0">
      {paths.map(p => {
        const label = p.split('/').pop() ?? p
        const active = p === activePath
        return (
          <button
            key={p}
            onClick={() => onSelect(p)}
            className={`flex items-center gap-2 px-4 py-2 text-[11px] whitespace-nowrap
                        border-r border-[var(--border)] transition-colors ${
                          active
                            ? 'bg-[var(--bg)] text-[var(--accent)] border-t-2 border-t-[var(--accent)]'
                            : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel-3)]'
                        }`}
          >
            {label}
            {dirtyPaths.has(p) && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-2)] flex-shrink-0" />
            )}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Panel — the Editor Script view.
//
// Native integration via <CodeEditor/> (Measure-First + Uncontrolled). The
// editor is keyed by the active script path so switching tabs REMOUNTS it
// with that file's content as the frozen initial value (uncontrolled): edits
// flow one-way to the store via onChange. No `value` feedback, no forced
// relayout timers, no loading overlay.
// ---------------------------------------------------------------------------

export default function ScriptEditorPanel() {
  const { state, dispatch } = useEditor()
  const { openScripts, activeScriptPath } = state
  const themeMode = useThemeMode()

  const currentScript = openScripts.find(s => s.path === activeScriptPath)
  const dirtyPaths    = new Set(openScripts.filter(s => s.isDirty).map(s => s.path))

  return (
    <div className="h-full w-full flex-1 min-w-0 flex flex-col bg-[var(--bg)]">
      <ScriptTabBar
        paths={openScripts.map(s => s.path)}
        activePath={activeScriptPath}
        dirtyPaths={dirtyPaths}
        onSelect={path => dispatch({ type: 'SET_ACTIVE_SCRIPT', path })}
      />

      <div className="flex-1 min-h-0 min-w-0 w-full bg-[var(--bg)]">
        {currentScript ? (
          <CodeEditor
            key={currentScript.path}
            language="lua"
            theme={themeMode === 'light' ? 'light' : 'vs-dark'}
            value={currentScript.content}
            onReady={(_editor, monaco) => registerLuaExtras(monaco)}
            onChange={(v) =>
              dispatch({ type: 'UPDATE_SCRIPT', path: currentScript.path, content: v })
            }
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-[var(--muted)]">
            <span className="text-[11px] uppercase tracking-widest">
              No script open
            </span>
            <span className="text-[10px] mt-1 text-[rgb(var(--muted-rgb)/0.5)]">
              Select an entity with a script in the Hierarchy panel
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
