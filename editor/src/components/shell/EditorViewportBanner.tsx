import { useEffect, useState } from 'react'

const MIN_WIDTH = 1520

/** Non-blocking hint when the editor window is narrower than the recommended layout width. */
export function EditorViewportBanner() {
  const [narrow, setNarrow] = useState(false)

  useEffect(() => {
    const check = () => setNarrow(globalThis.innerWidth < MIN_WIDTH)
    check()
    globalThis.addEventListener('resize', check)
    return () => globalThis.removeEventListener('resize', check)
  }, [])

  if (!narrow) return null

  return (
    <div
      className="absolute left-0 right-0 top-[var(--editor-top-chrome-h)] z-20 pointer-events-none
                 px-3 py-0.5 text-center text-[9px] text-[var(--primary-soft)]
                 bg-[var(--surface-2)]/90 border-b border-[var(--outline-subtle)]"
      role="status"
    >
      Narrow window — layout is optimized for {MIN_WIDTH}px width or wider.
    </div>
  )
}
