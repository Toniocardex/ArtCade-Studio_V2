import { useState } from 'react'
import { Paintbrush, Eraser, Pipette, Settings } from 'lucide-react'

interface Tile {
  id:     number
  isWall: boolean
}

const TILES: Tile[] = Array.from({ length: 32 }, (_, i) => ({
  id:     i,
  isWall: i < 8,
}))

// Alternating colors like the mockup
function tileColor(id: number, selected: boolean): string {
  if (selected) return '#1A253A'
  return id % 2 === 0 ? '#111827' : '#0B1121'
}

type TileTool = 'paint' | 'erase' | 'pick'

export default function TilesetEditorPanel() {
  const [selectedTile, setSelectedTile] = useState(0)
  const [activeTool, setActiveTool]     = useState<TileTool>('paint')
  const [isWall, setIsWall]             = useState(TILES[0].isWall)

  function selectTile(tile: Tile) {
    setSelectedTile(tile.id)
    setIsWall(tile.isWall)
  }

  return (
    <div className="h-full flex bg-[#0B1121]">

      {/* Mini toolbar */}
      <div className="w-10 border-r border-[#1A253A] flex flex-col items-center py-3 gap-3 flex-shrink-0">
        {([
          { id: 'paint', Icon: Paintbrush },
          { id: 'erase', Icon: Eraser     },
          { id: 'pick',  Icon: Pipette    },
        ] as const).map(({ id, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTool(id)}
            title={id}
            className={`p-1.5 rounded transition-colors ${
              activeTool === id
                ? 'text-[#FF00FF] bg-[#FF00FF]/10'
                : 'text-[#9CA3AF] hover:text-white'
            }`}
          >
            <Icon size={14} />
          </button>
        ))}
        <div className="h-px w-6 bg-[#1A253A]" />
        <button className="p-1.5 text-[#9CA3AF] hover:text-white">
          <Settings size={14} />
        </button>
      </div>

      {/* Tile grid + properties */}
      <div className="flex-1 p-4 flex gap-6 overflow-hidden">

        {/* Tile grid */}
        <div className="bg-[#111827] border border-[#1A253A] p-2 overflow-auto">
          <div className="grid grid-cols-8 gap-1">
            {TILES.map(tile => (
              <div
                key={tile.id}
                onClick={() => selectTile(tile)}
                style={{ backgroundColor: tileColor(tile.id, selectedTile === tile.id) }}
                className={`w-10 h-10 border cursor-pointer transition-all relative select-none ${
                  selectedTile === tile.id
                    ? 'border-[#FF00FF] scale-105 z-10 shadow-[0_0_8px_#FF00FF44]'
                    : 'border-white/5 hover:border-white/20'
                }`}
              >
                {tile.isWall && (
                  <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-bl" />
                )}
                <span className="absolute bottom-0 left-0 text-[6px] opacity-20 p-0.5">
                  {tile.id}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Selected tile properties */}
        <div className="w-48 space-y-4 text-[10px] flex-shrink-0">
          <div className="p-3 bg-[#1A253A] rounded border border-[#FF00FF]/30">
            <span className="text-[#9CA3AF] block mb-2 uppercase text-[8px] tracking-widest">
              Brush Selection
            </span>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#00FFFF]/10 border border-[#FF00FF]" />
              <div>
                <div className="font-bold text-[#FF00FF]">TILE_{selectedTile}</div>
                <div className="text-[8px] text-[#9CA3AF]">16×16 px</div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isWall}
                onChange={e => setIsWall(e.target.checked)}
                className="accent-[#FF00FF]"
              />
              <span className="text-[#D1D5DB]">Collision (Solid)</span>
            </label>
            <label className="flex items-center gap-2 cursor-not-allowed opacity-40">
              <input type="checkbox" defaultChecked={false} disabled className="accent-[#FF00FF]" />
              <span className="text-[#D1D5DB]">Auto-Tile Link</span>
            </label>
          </div>

          <div className="text-[8px] text-[#9CA3AF] border-t border-[#1A253A] pt-2">
            Tool: <span className="text-[#FF00FF] uppercase">{activeTool}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
