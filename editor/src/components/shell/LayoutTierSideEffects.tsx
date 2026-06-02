import { useEffect, useRef } from 'react'
import { useEditorLayoutContext } from '../../contexts/editor-layout-context'
import { useLayoutTier } from '../../contexts/editor-layout-tier-context'
import type { LayoutTier } from '../../utils/editor-layout-tier'

/** Applies tier-driven UI policy (dock collapsed in compact/minimal — ADAPTIVE_LAYOUT D10). */
export function LayoutTierSideEffects() {
  const tier = useLayoutTier()
  const layout = useEditorLayoutContext()
  const prevTier = useRef<LayoutTier>(tier)

  useEffect(() => {
    const enteredCompact =
      (tier === 'compact' || tier === 'minimal') &&
      (prevTier.current === 'full')
    if (enteredCompact) {
      layout.setDockCollapsed(true)
    }
    prevTier.current = tier
  }, [tier, layout])

  return null
}
