import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/sidebar'
import { AgentProvider } from '@/lib/agent-context'

export const metadata: Metadata = {
  title: 'Agent Reliability Engine',
  description: 'Monitor, test, and harden your AI agents with adversarial scenario testing, guardrail verification, and real-time reliability scoring.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AgentProvider>
          <Sidebar />
          <div className="app-frame">
            <header className="app-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="eyebrow" style={{ letterSpacing: '0.1em' }}>
                  AGENT RELIABILITY ENGINE
                </span>
              </div>
              <div className="header-actions">
                <div className="status-pill">
                  <span className="live-dot" style={{ width: 6, height: 6 }} />
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>
                    All systems operational
                  </span>
                </div>
              </div>
            </header>
            <main className="page-content">
              {children}
            </main>
          </div>
        </AgentProvider>
      </body>
    </html>
  )
}
