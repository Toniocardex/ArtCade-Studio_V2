import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/** Surfaces startup crashes in the Tauri WebView (otherwise a blank black window). */
export class BootErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[BootErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    const msg = this.state.error.stack ?? this.state.error.message
    return (
      <div
        style={{
          padding: 24,
          height: '100vh',
          boxSizing: 'border-box',
          background: '#1A1A1A',
          color: '#EAEAEA',
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 12,
          overflow: 'auto',
        }}
      >
        <h1 style={{ color: '#A84343', fontSize: 14, margin: '0 0 12px' }}>
          ArtCade Editor failed to start
        </h1>
        <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{msg}</pre>
      </div>
    )
  }
}
