// ---------------------------------------------------------------------------
// LeftSidebar — Scenes/Objects (top) + Asset browser (bottom) in canvas mode.
// Assets section is resizable and collapsible to maximize viewport width/height.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import SceneObjectsPanel from '../panels/SceneObjectsPanel'
import AssetBrowserPanel from '../panels/AssetBrowserPanel'
import HorizontalSplitHandle from './HorizontalSplitHandle'
import { usePersistedHeight } from '../hooks/usePersistedHeight'
import { usePersistedBoolean } from '../hooks/usePersistedBoolean'
import { triggerLayoutReflow } from '../utils/layout-reflow'

// Asset panel height (persisted in localStorage as artcade.left-assets-h-v4):
// - DEFAULT_ASSETS_H 360px: room for tab row, import/remove toolbar, thumbnails.
// - MIN_ASSETS_H 200px, MAX_ASSETS_RATIO 0.55 of sidebar: user can drag HorizontalSplitHandle.
// - Top Scenes/Entities section uses remaining flex space (scrolls via panel-scroll).
// - Migration artcade.left-assets-migrated-v4 only raises short v2/v3 saved heights; never shrinks.
const DEFAULT_ASSETS_H = 360
const MIN_ASSETS_H = 200
const MAX_ASSETS_RATIO = 0.55

export default function LeftSidebar() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [maxAssetsH, setMaxAssetsH] = useState(400)
  const [assetsCollapsed, setAssetsCollapsed] = usePersistedBoolean(
    'artcade.left-assets-collapsed',
    false,
  )

  const [assetsHeight, setAssetsHeight] = usePersistedHeight(
    'artcade.left-assets-h-v4',
    DEFAULT_ASSETS_H,
    MIN_ASSETS_H,
    maxAssetsH,
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const updateMax = () => {
      setMaxAssetsH(Math.max(MIN_ASSETS_H, Math.round(el.clientHeight * MAX_ASSETS_RATIO)))
    }
    updateMax()
    const ro = new ResizeObserver(updateMax)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    setAssetsHeight((h) => Math.min(h, maxAssetsH))
  }, [maxAssetsH, setAssetsHeight])

  // One-time: raise short heights saved in v2/v3 so import toolbar stays visible.
  useEffect(() => {
    if (globalThis.window === undefined) return
    const migrated = globalThis.localStorage.getItem('artcade.left-assets-migrated-v4')
    if (migrated) return
    for (const key of ['artcade.left-assets-h-v3', 'artcade.left-assets-h-v2']) {
      const raw = globalThis.localStorage.getItem(key)
      if (!raw) continue
      const n = Number(raw)
      if (Number.isFinite(n) && n < DEFAULT_ASSETS_H - 20) {
        setAssetsHeight(DEFAULT_ASSETS_H)
        break
      }
    }
    globalThis.localStorage.setItem('artcade.left-assets-migrated-v4', '1')
  }, [setAssetsHeight])

  useEffect(() => {
    triggerLayoutReflow()
  }, [assetsHeight, assetsCollapsed])

  const assetsPanelH = assetsCollapsed ? 0 : assetsHeight

  return (
    <div ref={containerRef} className="h-full min-h-0 flex flex-col bg-[var(--panel)]">
      <div className="flex-1 min-h-0 overflow-hidden">
        <SceneObjectsPanel />
      </div>

      {assetsCollapsed ? (
        <button
          type="button"
          onClick={() => setAssetsCollapsed(false)}
          className="flex-shrink-0 h-7 w-full flex items-center justify-center gap-1 border-t border-[var(--border)]
                     text-[10px] uppercase tracking-wider font-semibold text-[var(--muted)]
                     hover:text-[var(--text)] hover:bg-[var(--panel-2)] transition-colors"
          title="Show assets"
          aria-label="Show assets panel"
        >
          <ChevronUp size={12} />
          Assets
        </button>
      ) : (
        <>
          <HorizontalSplitHandle onResize={(d) => setAssetsHeight((h) => h + d)} />
          <div
            className="flex flex-col flex-shrink-0 min-h-0 overflow-hidden border-t border-[var(--border)]"
            style={{ height: assetsPanelH }}
          >
            <div className="h-7 flex items-center justify-between flex-shrink-0 px-2 border-b border-[var(--border)]">
              <span className="text-[10px] tracking-wider uppercase font-semibold text-[var(--muted)]">
                Assets
              </span>
              <button
                type="button"
                onClick={() => setAssetsCollapsed(true)}
                title="Hide assets panel"
                aria-label="Hide assets panel"
                className="w-7 h-6 flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)]"
              >
                <ChevronDown size={12} />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <AssetBrowserPanel />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
