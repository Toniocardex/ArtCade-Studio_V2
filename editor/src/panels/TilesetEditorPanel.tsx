import { useEffect, useRef, useState } from 'react'
import { Paintbrush, Eraser, Pipette } from 'lucide-react'
import { useEditor } from '../store/editor-store'
import { DEFAULT_TILE_PALETTE } from '../types'
import type { TileDef } from '../types'

type TileTool = 'paint' | 'erase' | 'pick'

export default function TilesetEditorPanel() {
  const { state, dispatch } = useEditor()
  const { project, selection } = state

  const sceneId = selection.sceneId ?? project?.activeSceneId ?? ''
  const scene   = project?.scenes[sceneId]
  const tilemap = scene?.tilemap
  const palette: TileDef[] =
    project?.tilePalette && project.tilePalette.length > 0
      ? project.tilePalette
      : DEFAULT_TILE_PALETTE

  const [tool, setTool]           = useState<TileTool>('paint')
  const [selectedTile, setSelectedTile] = useState<number>(palette[0]?.id ?? 1)
  const painting = useRef(false)

  // end a drag-paint anywhere the mouse is released
  useEffect(() => {
    const up = () => { painting.current = false }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])

  if (!project || !scene) {
    return (
      <div className="h-full bg-[#0B1121] flex items-center justify-center">
        <span className="text-[#9CA3AF] text-xs">No scene selected</span>
      </div>
    )
  }

  const colorOf = (id: number) =>
    id === 0 ? 'transparent' : (palette.find(t => t.id === id)?.color ?? '#374151')

  function applyAt(index: number) {
    if (!tilemap) return
    if (tool === 'pick') {
      const id = tilemap.data[index]
      if (id > 0) setSelectedTile(id)
      return
    }
    const tileId = tool === 'erase' ? 0 : selectedTile
    dispatch({ type: 'TILEMAP_PAINT', sceneId, index, tileId })
  }

  return (
    <div className="h-full flex bg-[#0B1121] select-none">

      {/* Tool rail */}
      <div className="w-10 border-r border-[#1A253A] flex flex-col items-center py-3 gap-3 flex-shrink-0">
        {([
          { id: 'paint', Icon: Paintbrush },
          { id: 'erase', Icon: Eraser     },
          { id: 'pick',  Icon: Pipette    },
        ] as const).map(({ id, Icon }) => (
          <button
            key={id}
            onClick={() => setTool(id)}
            title={id}
            className={`p-1.5 rounded transition-colors ${
              tool === id
                ? 'text-[#FF00FF] bg-[#FF00FF]/10'
                : 'text-[#9CA3AF] hover:text-white'
            }`}
          >
            <Icon size={14} />
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 p-3 overflow-auto">
        {!tilemap ? (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <span className="text-[#9CA3AF] text-xs">
              No tilemap for “{scene.name}”.
            </span>
            <button
              onClick={() => dispatch({ type: 'TILEMAP_INIT', sceneId })}
              className="px-3 py-1.5 rounded text-xs font-semibold border
                         border-[#0a5a5a] bg-[#062a2a] text-[#00FFFF]
                         hover:bg-[#0a3a3a]"
            >
              ＋ Create Tilemap ({Math.round(scene.worldSize.x / 32)}×
              {Math.round(scene.worldSize.y / 32)})
            </button>
          </div>
        ) : (
          <div
            className="inline-grid border border-[#1A253A] bg-[#070b13]"
            style={{
              gridTemplateColumns: `repeat(${tilemap.cols}, 18px)`,
              gridAutoRows: '18px',
            }}
          >
            {tilemap.data.map((id, i) => (
              <div
                key={i}
                onMouseDown={() => { painting.current = true; applyAt(i) }}
                onMouseEnter={() => { if (painting.current) applyAt(i) }}
                className="border border-white/[0.04] hover:border-[#00FFFF]/40"
                style={{ backgroundColor: colorOf(id) }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Palette + info */}
      <div className="w-52 border-l border-[#1A253A] p-3 flex flex-col gap-3 flex-shrink-0">
        <div className="text-[9px] text-[#9CA3AF] uppercase tracking-widest">
          Palette
        </div>
        <div className="grid grid-cols-4 gap-2">
          {palette.map(t => (
            <button
              key={t.id}
              onClick={() => { setSelectedTile(t.id); setTool('paint') }}
              title={`${t.name}${t.solid ? ' (solid)' : ''}`}
              className={`h-9 rounded border relative ${
                selectedTile === t.id && tool !== 'erase'
                  ? 'border-[#FF00FF] scale-105 shadow-[0_0_8px_#FF00FF44]'
                  : 'border-white/10 hover:border-white/30'
              }`}
              style={{ backgroundColor: t.color }}
            >
              {t.solid && (
                <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-red-500 rounded-bl" />
              )}
            </button>
          ))}
        </div>

        <div className="text-[10px] text-[#9CA3AF] border-t border-[#1A253A] pt-2 space-y-1">
          <div>Tool: <span className="text-[#FF00FF] uppercase">{tool}</span></div>
          <div>
            Brush:{' '}
            <span className="text-[#00FFFF]">
              {tool === 'erase'
                ? 'empty'
                : palette.find(t => t.id === selectedTile)?.name ?? '—'}
            </span>
          </div>
          {tilemap && (
            <div className="text-[8px] opacity-60">
              {tilemap.cols}×{tilemap.rows} · {tilemap.tileSize}px
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
