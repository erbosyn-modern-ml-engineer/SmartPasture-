import { Component, type ErrorInfo, type ReactNode } from 'react'

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[SmartPasture error boundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="shell__content">
          <section className="panel state-panel state-panel--error">
            <div>
              <h1>SmartPasture could not render this workspace</h1>
              <p>Reload the page. If the error persists after deploy, clear the cached build assets.</p>
              <button type="button" className="button button--primary" onClick={() => window.location.reload()}>
                Reload
              </button>
            </div>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}
