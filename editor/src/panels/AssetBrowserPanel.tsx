import { useState } from 'react'
import type { ElementType } from 'react'
import { Image, Music, Code, FileText } from 'lucide-react'

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
  const color = type === 'IMAGES' ? '#00FFFF' : type === 'AUDIO' ? '#FF00FF' : '#F97316'
  return <Icon size={22} color={color} />
}

export default function AssetBrowserPanel() {
  const [cat, setCat] = useState<Category>('ALL')

  const visible = SAMPLE_ASSETS.filter(a => cat === 'ALL' || a.type === cat)

  return (
    <div className="h-full flex flex-col bg-[#0B1121]">
      {/* Category tabs */}
      <div className="flex border-b border-[#1A253A] px-2 flex-shrink-0">
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`px-4 py-2 text-[10px] font-bold transition-all ${
              cat === c
                ? 'text-[#00FFFF] border-b-2 border-[#00FFFF]'
                : 'text-[#9CA3AF] hover:text-[#D1D5DB]'
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
              className="flex flex-col items-center gap-2 p-2 rounded
                         border border-[#1A253A] hover:border-[#00FFFF]/50
                         bg-[#0B1121] cursor-pointer transition-colors group"
            >
              <div className="text-[#9CA3AF] group-hover:scale-110 transition-transform">
                <AssetIcon type={asset.type} />
              </div>
              <span className="text-[9px] truncate w-full text-center text-[#9CA3AF]">
                {asset.name}
              </span>
              <span className="text-[8px] text-[#9CA3AF]/50">{asset.size}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
