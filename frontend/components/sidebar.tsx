'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  GitCompare,
  LayoutDashboard,
  Menu,
  Radar,
  Shield,
  Swords,
  Target,
  X,
  Zap,
} from 'lucide-react'
import { useAgent } from '@/lib/agent-context'
import { AGENTS } from '@/lib/mock-data'
import type { AgentId } from '@/lib/mock-data'
import type { AgentVersionRead } from '@/lib/api-types'

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Scenarios', href: '/scenarios', icon: Target },
  { label: 'Red Team', href: '/red-team', icon: Swords },
]

const analysisItems = [
  { label: 'Scorecard', href: '/scorecard', icon: Radar },
  { label: 'Remediation', href: '/remediation', icon: GitCompare },
  { label: 'Report', href: '/report', icon: FileText },
]

const MOCK_AGENT_LIST = Object.values(AGENTS) as typeof AGENTS[AgentId][]

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { agentId, agent, setAgentId, versions, activeVersionId, setActiveVersionId, versionsLoading } = useAgent()

  // Use live versions when available, fall back to mock list
  const hasLiveVersions = versions.length > 0

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [dropdownOpen])

  function selectAgent(id: AgentId) {
    setAgentId(id)
    setDropdownOpen(false)
  }

  function selectVersion(version: AgentVersionRead) {
    setActiveVersionId(version.id)
    setDropdownOpen(false)
  }

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`sidebar-backdrop ${mobileOpen ? 'sidebar-backdrop-visible' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'sidebar-mobile-open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-top">
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Shield size={24} className="logo-mark" style={{ color: '#22D3EE' }} />
            {!collapsed && (
              <span className="logo-wordmark gradient-text">ARE</span>
            )}
          </Link>
          <div className="logo-rule"><span /></div>

          {/* Collapse toggle (desktop) */}
          <button
            className="collapse-button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          {/* Close (mobile) */}
          <button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {!collapsed && <div className="nav-section-label">OPERATIONS</div>}
          {navItems.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`nav-item ${isActive(href) ? 'nav-item-active' : ''}`}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} />
              {!collapsed && label}
            </Link>
          ))}

          {!collapsed && <div className="nav-section-label">ANALYSIS</div>}
          {analysisItems.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`nav-item ${isActive(href) ? 'nav-item-active' : ''}`}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} />
              {!collapsed && label}
            </Link>
          ))}
        </nav>

        {/* Bottom agent switcher */}
        <div className="sidebar-bottom">
          {!collapsed && (
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                className="agent-selector"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                aria-haspopup="listbox"
                aria-expanded={dropdownOpen}
              >
                <Zap size={16} style={{ color: '#22D3EE', flexShrink: 0 }} />
                <div className="agent-copy">
                  <span className="eyebrow" style={{ marginBottom: 3 }}>ACTIVE AGENT</span>
                  <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {hasLiveVersions
                      ? (versions.find((v) => v.id === activeVersionId)?.name ?? agent.name)
                      : `${agent.name} ${agent.version}`}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span className="live-dot" />
                  <ChevronDown
                    size={13}
                    style={{
                      color: '#8B8B9E',
                      transform: dropdownOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s',
                    }}
                  />
                </div>
              </button>

              {/* Dropdown */}
              {dropdownOpen && (
                <div
                  role="listbox"
                  aria-label="Select agent"
                  style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 8px)',
                    left: 0,
                    right: 0,
                    background: '#131320',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    overflow: 'hidden',
                    boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
                    zIndex: 50,
                    animation: 'slideUp 0.15s ease both',
                  }}
                >
                  <div style={{ padding: '8px 12px 6px', color: '#55556A', fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.12em' }}>
                    {hasLiveVersions ? 'SELECT AGENT VERSION' : 'SELECT AGENT'}
                  </div>

                  {/* Live version list */}
                  {hasLiveVersions && versions.map((v) => {
                    const isSelected = v.id === activeVersionId
                    return (
                      <button
                        key={v.id}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => selectVersion(v)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          width: '100%',
                          padding: '10px 12px',
                          background: isSelected ? 'rgba(34,211,238,0.08)' : 'transparent',
                          border: 0,
                          borderLeft: isSelected ? '2px solid #22D3EE' : '2px solid transparent',
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: '0.15s',
                        }}
                        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)' }}
                        onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                      >
                        <div style={{
                          width: 30, height: 30, borderRadius: 8,
                          background: isSelected ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.05)',
                          display: 'grid', placeItems: 'center', flexShrink: 0,
                        }}>
                          <Zap size={14} style={{ color: isSelected ? '#22D3EE' : '#8B8B9E' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: isSelected ? '#F0F0F5' : '#8B8B9E', marginBottom: 1 }}>
                            {v.name}
                          </div>
                          <div style={{ fontSize: 10, color: '#55556A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                            {v.id.slice(0, 8)}…
                          </div>
                        </div>
                        {isSelected && (
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22D3EE', boxShadow: '0 0 8px #22D3EE', flexShrink: 0 }} />
                        )}
                      </button>
                    )
                  })}

                  {/* Fallback: mock agent list when backend is unreachable */}
                  {!hasLiveVersions && MOCK_AGENT_LIST.map((a) => {
                    const isSelected = a.id === agentId
                    return (
                      <button
                        key={a.id}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => selectAgent(a.id as AgentId)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          width: '100%',
                          padding: '10px 12px',
                          background: isSelected ? 'rgba(34,211,238,0.08)' : 'transparent',
                          border: 0,
                          borderLeft: isSelected ? '2px solid #22D3EE' : '2px solid transparent',
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: '0.15s',
                        }}
                        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)' }}
                        onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                      >
                        <div style={{
                          width: 30, height: 30, borderRadius: 8,
                          background: isSelected ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.05)',
                          display: 'grid', placeItems: 'center', flexShrink: 0,
                        }}>
                          <Zap size={14} style={{ color: isSelected ? '#22D3EE' : '#8B8B9E' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: isSelected ? '#F0F0F5' : '#8B8B9E', marginBottom: 1 }}>
                            {a.name} <span style={{ color: '#55556A', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{a.version}</span>
                          </div>
                          <div style={{ fontSize: 10, color: '#55556A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {a.description}
                          </div>
                        </div>
                        {isSelected && (
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22D3EE', boxShadow: '0 0 8px #22D3EE', flexShrink: 0 }} />
                        )}
                      </button>
                    )
                  })}

                  <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '4px 0' }} />
                  <div style={{ padding: '8px 12px', color: '#55556A', fontSize: 9, fontFamily: 'var(--font-mono)' }}>
                    {hasLiveVersions
                      ? `${versions.length} VERSION${versions.length !== 1 ? 'S' : ''} LOADED FROM BACKEND`
                      : 'BACKEND OFFLINE · USING DEMO DATA'}
                  </div>
                </div>
              )}
            </div>
          )}

          {!collapsed && (
            <div className="connection-row">
              <Activity size={12} />
              <span>
                {versionsLoading
                  ? 'Connecting to backend…'
                  : hasLiveVersions
                    ? `Live · ${versions.length} version${versions.length !== 1 ? 's' : ''}`
                    : 'Demo Mode · Backend offline'}
              </span>
            </div>
          )}

        </div>
      </aside>

      {/* Mobile menu button */}
      <button
        className="mobile-menu"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>
    </>
  )
}
