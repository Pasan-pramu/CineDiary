import { RotateCcw, TriangleAlert } from 'lucide-react'
import { Component } from 'react'
import { logError } from '../errors'

interface ErrorBoundaryProps {
  children: React.ReactNode
  /** When this changes (e.g. the page), a crashed view gets another try. */
  resetKey?: string
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Catches a crash while rendering and shows a friendly screen instead of a blank window.
 * The error goes to the local error log. (Class component: React has no hook for this.)
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    logError('render', error, info.componentStack ?? undefined)
  }

  componentDidUpdate(previous: ErrorBoundaryProps): void {
    if (previous.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="panel max-w-md p-8 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-danger-surface)] text-[var(--color-danger)]">
            <TriangleAlert size={26} />
          </div>
          <h1 className="mt-5 text-lg font-semibold text-[var(--color-text-primary)]">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
            This screen ran into a problem. Your diary is safe; nothing was lost. Reloading usually
            fixes it.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn btn-primary"
            >
              <RotateCcw size={16} /> Reload
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.hash = '#/'
                window.location.reload()
              }}
              className="btn btn-secondary"
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
