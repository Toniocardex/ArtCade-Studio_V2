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
      className="shrink-0 px-3 py-1 text-center text-[10px] text-[var(--primary-soft)] border-b border-[var(--outline)]
                 bg-[var(--surface-2)]"
      role="status"
    >
      Narrow window — layout is optimized for {MIN_WIDTH}px width or wider.
    </div>
  )
}
