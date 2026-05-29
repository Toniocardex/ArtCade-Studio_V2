import { frameKey } from '../../utils/spritesheet-studio'
import type { ImageAsset } from '../../types'
import type { SpritesheetStudioSession } from './useSpritesheetStudioSession'

type AtlasGridProps = Readonly<{
  asset: ImageAsset
  session: SpritesheetStudioSession
}>

export function AtlasGrid({ asset, session }: AtlasGridProps) {
  const { imgWH, grid, cellW, cellH, selectedKeys, toggleCell } = session

  if (!asset.dataUrl || !imgWH) {
    return (
      <p className="text-sm text-[var(--muted)] p-4">
        Save the project or re-import the image to edit animation frames on this sheet.
      </p>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 p-3">
      <div
        className="relative border border-[var(--border-2)] overflow-auto flex-1 min-h-0"
        data-testid="spritesheet-preview-host"
      >
        <img
          src={asset.dataUrl}
          alt=""
          className="block max-w-none"
          style={{ imageRendering: 'pixelated', width: imgWH.w, height: imgWH.h }}
        />
        <div
          className="absolute inset-0 grid pointer-events-auto"
          style={{
            gridTemplateColumns: `repeat(${grid.cols}, ${cellW}px)`,
            gridTemplateRows: `repeat(${grid.rows}, ${cellH}px)`,
            width: grid.cols * cellW,
            height: grid.rows * cellH,
          }}
        >
          {Array.from({ length: grid.totalFrames }, (_, i) => {
            const col = i % grid.cols
            const row = Math.floor(i / grid.cols)
            const key = frameKey({ x: col * cellW, y: row * cellH, w: cellW, h: cellH })
            const on = selectedKeys.has(key)
            return (
              <button
                key={key}
                type="button"
                className={`border border-[rgb(255_255_255/0.15)] ${
                  on ? 'bg-[rgb(var(--accent-rgb)/0.35)]' : 'bg-transparent hover:bg-[rgb(255_255_255/0.08)]'
                }`}
                onClick={() => toggleCell(col, row)}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
