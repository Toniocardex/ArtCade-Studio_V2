import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  /** Label shown in the error card, e.g. "Canvas" or "Inspector". */
  label?: string
}

interface State {
  error: Error | null
}

/**
 * Catches render errors inside a single panel and shows a contained
 * recovery card instead of crashing the whole editor.
 */
export class PanelErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[PanelErrorBoundary:${this.props.label ?? 'panel'}]`, error, info.componentStack)
  }

  private reset = () => this.setState({ error: null })

  render() {
    if (!this.state.error) return this.props.children

    const label = this.props.label ?? 'Panel'
    const msg = this.state.error.message

    return (
      <div className="h-full w-full flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 max-w-xs text-center">
          <AlertTriangle size={20} className="text-[var(--danger)] flex-shrink-0" />
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold text-[var(--text)]">
              {label} crashed
            </span>
            <span className="text-[11px] text-[var(--muted)] break-all">
              {msg}
            </span>
          </div>
          <button
            type="button"
            onClick={this.reset}
            className="flex items-center gap-1.5 px-3 py-1 rounded text-[11px]
                       bg-[var(--surface)] border border-[var(--outline)]
                       text-[var(--text)] hover:border-[var(--accent)] transition-colors"
          >
            <RefreshCw size={11} />
            Retry
          </button>
        </div>
      </div>
    )
  }
}
