/**
 * Lightweight 2D axis hint (X/Y + N/E). No 3D compass — editor orientation only.
 */

export type ViewportAxisGizmoProps = Readonly<{
  visible?: boolean
}>

export function ViewportAxisGizmo({ visible = true }: ViewportAxisGizmoProps) {
  if (!visible) return null

  return (
    <div
      className="absolute bottom-3 right-3 z-[2] pointer-events-none select-none"
      aria-hidden
    >
      <svg width="56" height="56" viewBox="0 0 56 56" className="drop-shadow-md">
        {/* Y axis — up in world space (screen -Y) */}
        <line x1="28" y1="28" x2="28" y2="8" stroke="var(--accent)" strokeWidth="2" />
        <text x="32" y="10" fill="var(--accent)" fontSize="9" fontWeight="700" fontFamily="monospace">
          Y
        </text>
        <text x="24" y="6" fill="var(--muted)" fontSize="7" fontWeight="600" textAnchor="middle">
          N
        </text>
        {/* X axis — right */}
        <line x1="28" y1="28" x2="48" y2="28" stroke="var(--danger-2)" strokeWidth="2" />
        <text x="50" y="31" fill="var(--danger-2)" fontSize="9" fontWeight="700" fontFamily="monospace">
          X
        </text>
        <text x="52" y="24" fill="var(--muted)" fontSize="7" fontWeight="600">
          E
        </text>
        {/* Origin */}
        <circle cx="28" cy="28" r="2.5" fill="var(--text)" opacity="0.85" />
      </svg>
    </div>
  )
}
