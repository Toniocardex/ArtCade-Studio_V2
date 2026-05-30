/**
 * Rasterize SVG to PNG for build_app_icons.py (sharp — no native Cairo).
 * Usage: node scripts/render-icon-svg.mjs <input.svg> <size> <output.png>
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'

const [svgPath, sizeRaw, outPath] = process.argv.slice(2)
if (!svgPath || !sizeRaw || !outPath) {
  console.error('Usage: node render-icon-svg.mjs <input.svg> <size> <output.png>')
  process.exit(1)
}

const size = Number(sizeRaw)
if (!Number.isFinite(size) || size < 16) {
  console.error('Invalid size:', sizeRaw)
  process.exit(1)
}

const svg = readFileSync(resolve(svgPath))
const png = await sharp(svg, { density: Math.max(144, Math.ceil((size / 1024) * 288)) })
  .resize(size, size, { fit: 'fill' })
  .png()
  .toBuffer()

writeFileSync(resolve(outPath), png)
