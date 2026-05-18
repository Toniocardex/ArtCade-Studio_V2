import { useRef, useState } from 'react'
import type { ElementType } from 'react'
import { Image, Music, Code, FileText, ImagePlus } from 'lucide-react'
import { useEditor } from '../store/editor-store'
import { importImageIntoProject } from '../utils/api'
import { dirName } from '../utils/project'
import type { ImageAsset } from '../types'

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

// Audio/scripts stay sample-only for now; IMAGES come from project.assets.
const SAMPLE_ASSETS = [
  { name: 'bgm_main.ogg',          type: 'AUDIO',   size: '1.4 MB' },
  { name: 'sfx_hurt.ogg',          type: 'AUDIO',   size: '22 KB'  },
  { name: 'sfx_jump.ogg',          type: 'AUDIO',   size: '18 KB'  },
  { name: 'player_controller.lua', type: 'SCRIPTS', size: '1.1 KB' },
  { name: 'enemy_ai.lua',          type: 'SCRIPTS', size: '840 B'  },
  { name: 'platformer.lua',        type: 'SCRIPTS', size: '2.2 KB' },
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
  const [cat, setCat]   = useState<Category>('ALL')
  const [msg, setMsg]   = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const project   = state.project
  const images    = Object.values(project?.assets ?? {})
  const selEntity = (project && state.selection.entityId != null)
    ? project.entities[state.selection.entityId]
    : null

  function flash(t: string) {
    setMsg(t)
    window.setTimeout(() => setMsg(null), 3000)
  }

  // ── Import an image into the project's persistent asset library ───────────
  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !project) return
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = String(reader.result)
      const buf  = await file.arrayBuffer()
      const bytes = new Uint8Array(buf)
      let relPath: string | null = null
      if (state.projectPath) {
        relPath = await importImageIntoProject(
          dirName(state.projectPath), file.name, bytes,
        )
      }
      // Browser / unsaved project: keep a stable path; persistence happens
      // once the project is saved with an assets/ folder. dataUrl drives the
      // immediate runtime render + thumbnail this session.
      const path = relPath ?? `assets/images/${file.name}`
      const asset: ImageAsset = {
        id:   `img_${Date.now().toString(36)}`,
        name: file.name,
        path,
        dataUrl,
      }
      dispatch({ type: 'ASSET_ADD', asset })
      flash(relPath ? `Imported ${file.name}` : `${file.name} (save project to persist)`)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function assignSprite(asset: ImageAsset) {
    if (!selEntity) { flash('Select an entity first, then double-click an image'); return }
    dispatch({
      type: 'ENTITY_SET_SPRITE',
      entityId: selEntity.id,
      sprite: { ...selEntity.sprite, spriteAssetId: asset.path },
    })
    flash(`Sprite "${asset.name}" → ${selEntity.name}`)
  }

  function openScript(name: string) {
    const path = `scripts/${name}`
    const already = state.openScripts.find(s => s.path === path)
    dispatch({
      type: 'OPEN_SCRIPT',
      file: already ?? { path, content: scriptStub(name), isDirty: false },
    })
  }

  const samples = SAMPLE_ASSETS.filter(a => cat === 'ALL' || a.type === cat)
  const showImages = cat === 'ALL' || cat === 'IMAGES'

  return (
    <div className="h-full flex flex-col bg-[var(--bg)]">
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/gif"
        className="hidden"
        onChange={onPickFile}
      />

      {/* Category tabs + import */}
      <div className="flex items-center border-b border-[var(--border)] px-2 flex-shrink-0">
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
        <div className="flex-1" />
        {msg && <span className="text-[9px] text-[var(--muted)] mr-3">{msg}</span>}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={!project}
          className="flex items-center gap-1.5 px-3 py-1 my-1 rounded text-[10px] font-semibold
                     border border-[var(--accent-bd)] bg-[var(--accent-bg)] text-[var(--accent)]
                     hover:bg-[var(--accent-bg-h)] disabled:opacity-40"
        >
          <ImagePlus size={12} /> Import image
        </button>
      </div>

      {/* Asset grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {showImages && images.length === 0 && cat === 'IMAGES' && (
          <p className="text-[var(--muted)] text-[10px] mb-3">
            No images yet — use “Import image”. Double-click an image (with an
            entity selected) to assign it as that entity's sprite.
          </p>
        )}
        <div className="grid grid-cols-6 gap-3">
          {showImages && images.map(asset => (
            <div
              key={asset.id}
              onDoubleClick={() => assignSprite(asset)}
              title={selEntity
                ? `Double-click → assign as sprite of "${selEntity.name}"`
                : 'Select an entity, then double-click to assign as its sprite'}
              className="flex flex-col items-center gap-2 p-2 rounded
                         border border-[var(--border)] hover:border-[rgb(var(--accent-rgb)/0.5)]
                         bg-[var(--bg)] cursor-pointer transition-colors group"
            >
              <div className="w-[22px] h-[22px] flex items-center justify-center group-hover:scale-110 transition-transform">
                {asset.dataUrl
                  ? <img src={asset.dataUrl} alt={asset.name}
                         className="max-w-full max-h-full object-contain" style={{ imageRendering: 'pixelated' }} />
                  : <AssetIcon type="IMAGES" />}
              </div>
              <span className="text-[9px] truncate w-full text-center text-[var(--muted)]">
                {asset.name}
              </span>
              <span className="text-[8px] text-[rgb(var(--muted-rgb)/0.5)]">image</span>
            </div>
          ))}

          {samples.map((asset, i) => (
            <div
              key={`s${i}`}
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
