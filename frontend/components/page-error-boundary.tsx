'use client'

/**
 * PageErrorBoundary
 *
 * Wraps individual dashboard pages to catch React render errors and API
 * failures gracefully. Without this, a single thrown exception in a page
 * component would crash the entire Next.js shell.
 *
 * Usage:
 *   <PageErrorBoundary>
 *     <MyPage />
 *   </PageErrorBoundary>
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  /** Optional label shown in the error card to identify which page failed */
  pageName?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class PageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production you'd send this to a logging service
    console.error(`[PageErrorBoundary] ${this.props.pageName ?? 'page'} crashed:`, error, info)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '1.5rem',
        padding: '2rem',
        textAlign: 'center',
      }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'rgba(239,68,68,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid rgba(239,68,68,0.3)',
        }}>
          <AlertTriangle size={26} style={{ color: '#ef4444' }} />
        </div>

        <div>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary, #f1f5f9)' }}>
            {this.props.pageName ? `${this.props.pageName} failed to load` : 'Something went wrong'}
          </h2>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)' }}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </p>
        </div>

        <button
          onClick={this.handleReset}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '0.5rem 1.25rem',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.06)',
            color: 'var(--text-primary, #f1f5f9)',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 500,
          }}
        >
          <RefreshCw size={14} />
          Try again
        </button>
      </div>
    )
  }
}
