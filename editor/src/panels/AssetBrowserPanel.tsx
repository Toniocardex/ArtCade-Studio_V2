import { useState } from 'react'
import type { ElementType } from 'react'
import { Image, Music, Code, FileText } from 'lucide-react'
import { useEditor } from '../store/editor-store'

/** Starter content used the first time a script asset is opened. */
function scriptStub(name: string): string {
  return [
    `-- ${name}`,
    '-- Opened from Assets. Edit and Ctrl+S to save.',
    '',
    'function tick(dt)',
    '  -- your game logic here',
    'end',
    '',
  ].join('\n')
}

type Category = 'ALL' | 'IMAGES' | 'AUDIO' | 'SCRIPTS'

const CATEGORIES: Category[] = ['ALL', 'IMAGES', 'AUDIO', 'SCRIPTS']

const SAMPLE_ASSETS = [
  { name: 'hero_idle.png',           type: 'IMAGES',  size: '12 KB' },
  { name: 'hero_run.png',            type: 'IMAGES',  size: '28 KB' },
  { name: 'forest_tileset.png',      type: 'IMAGES',  size: '64 KB' },
  { name: 'bgm_main.ogg',            type: 'AUDIO',   size: '1.4 MB' },
  { name: 'sfx_hurt.ogg',            type: 'AUDIO',   size: '22 KB'  },
  { name: 'sfx_jump.ogg',            type: 'AUDIO',   size: '18 KB'  },
  { name: 'player_controller.lua',   type: 'SCRIPTS', size: '1.1 KB' },
  { name: 'enemy_ai.lua',            type: 'SCRIPTS', size: '840 B'  },
  { name: 'platformer.lua',          type: 'SCRIPTS', size: '2.2 KB' },
]

const ICON_MAP: Record<string, ElementType> = {
  IMAGES:  Image,
  AUDIO:   Music,
  SCRIPTS: Code,
}

function AssetIcon({ type }: { type: string }) {
  const Icon = ICON_MAP[type] ?? FileText
  const color = type === 'IMAGES' ? 'var(--accent)' : type === 'AUDIO' ? 'var(--accent-2)' : 'var(--warn)'
  return <Icon size={22} color={color} />
}

export default function AssetBrowserPanel() {
  const { state, dispatch } = useEditor()
  const [cat, setCat] = useState<Category>('ALL')

  const visible = SAMPLE_ASSETS.filter(a => cat === 'ALL' || a.type === cat)

  // Double-click a script → open it in the Editor Script in its own tab.
  // OPEN_SCRIPT dedupes by path, so an already-open script is just focused
  // (its content / unsaved edits are preserved — never overwritten).
  function openScript(name: string) {
    const path = `scripts/${name}`
    const already = state.openScripts.find(s => s.path === path)
    dispatch({
      type: 'OPEN_SCRIPT',
      file: already ?? { path, content: scriptStub(name), isDirty: false },
    })
  }

  return (
    <div className="h-full flex flex-col bg-[var(--bg)]">
      {/* Category tabs */}
      <div className="flex border-b border-[var(--border)] px-2 flex-shrink-0">
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`px-4 py-2 text-[10px] font-bold transition-all ${
              cat === c
                ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Asset grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-6 gap-3">
          {visible.map((asset, i) => (
            <div
              key={i}
              onDoubleClick={() => {
                if (asset.type === 'SCRIPTS') openScript(asset.name)
              }}
              title={asset.type === 'SCRIPTS' ? 'Double-click to open in Editor Script' : asset.name}
              className="flex flex-col items-center gap-2 p-2 rounded
                         border border-[var(--border)] hover:border-[rgb(var(--accent-rgb)/0.5)]
                         bg-[var(--bg)] cursor-pointer transition-colors group"
            >
              <div className="text-[var(--muted)] group-hover:scale-110 transition-transform">
                <AssetIcon type={asset.type} />
              </div>
              <span className="text-[9px] truncate w-full text-center text-[var(--muted)]">
                {asset.name}
              </span>
              <span className="text-[8px] text-[rgb(var(--muted-rgb)/0.5)]">{asset.size}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
