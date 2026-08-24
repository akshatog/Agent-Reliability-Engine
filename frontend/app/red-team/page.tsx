'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Activity, ArrowUpRight, Check, ChevronRight, Download, FlaskConical, Library, Loader2, ShieldAlert, Swords, Terminal, Zap } from 'lucide-react'
import { useAgent } from '@/lib/agent-context'
import { RED_TEAM_SCENARIOS, SUGGESTION_CHIPS } from '@/lib/mock-data'
import type { RedTeamScenario } from '@/lib/mock-data'
import { redTeamChat, ApiError } from '@/lib/api'
import { mapRedTeamResponse } from '@/lib/red-team-mapper'
import type { RedTeamDisplayItem } from '@/lib/api-types'

type Tab = 'console' | 'scenarios' | 'library'

function ScenarioCard({ scenario }: { scenario: RedTeamDisplayItem | RedTeamScenario }) {
  const isPass = scenario.verdict === 'PASS'
  const runId = scenario.runId
  return (
    <article className={`scenario-card ${isPass ? 'safe-card' : ''}`}>
      <div className="scenario-heading">
        <span><Check size={13} /> Scenario Generated</span>
        <span className="scenario-run">{runId}</span>
      </div>
      <div style={{ display: 'flex', gap: 6, margin: '8px 0' }}>
        <span className="category-badge">{scenario.category}</span>
        <span className="owasp-badge">OWASP LLM</span>
      </div>
      <blockquote>{scenario.prompt}</blockquote>
      <div className={`verdict-row ${isPass ? 'pass' : 'fail'}`}>
        <div>
          <span className="verdict-label">VERDICT</span>
          <strong className={isPass ? 'pass-text' : 'fail-text'}>{scenario.verdict}</strong>
        </div>
        <div className="meta">
          <span>SEVERITY <b>{scenario.severity}</b></span>
          <span>CONFIDENCE <b>{scenario.confidence}</b></span>
        </div>
      </div>
      <Link className="analysis-link" href={`/traces/${runId}`}>View Full Analysis <ArrowUpRight size={13} /></Link>
    </article>
  )
}

function MessageHistory({ scenarios }: { scenarios: (RedTeamDisplayItem | RedTeamScenario)[] }) {
  return (
    <div className="history">
      {scenarios.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)', fontSize: 12 }}>
          No attacks executed yet. Describe an attack scenario below to begin.
        </div>
      )}
      {scenarios.map((scenario, index) => {
        const key = scenario.runId
        return (
          <div className="exchange" key={key}>
            <div className="user-message">
              <div className="message-meta"><span>YOU</span><time>{scenario.time}</time></div>
              <p>{scenario.prompt}</p>
            </div>
            <div className="system-message">
              <div className="system-label">
                <ShieldAlert size={13} /> ARE SYSTEM <span>SCENARIO ENGINE / {String(index + 1).padStart(2, '0')}</span>
              </div>
              <ScenarioCard scenario={scenario} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ScenariosPanel({ scenarios }: { scenarios: (RedTeamDisplayItem | RedTeamScenario)[] }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <div style={{ color: 'var(--rose)', fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <FlaskConical size={12} />SCENARIO HISTORY
          </div>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>
            {scenarios.length} attack{scenarios.length !== 1 ? 's' : ''} executed this session
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(52,211,153,.1)', color: 'var(--emerald)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
            {scenarios.filter(s => s.verdict === 'PASS').length} PASS
          </span>
          <span style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(244,63,94,.1)', color: 'var(--rose)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
            {scenarios.filter(s => s.verdict === 'FAIL').length} FAIL
          </span>
        </div>
      </div>
      {scenarios.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--text-muted)', fontSize: 13 }}>
          <FlaskConical size={40} style={{ opacity: 0.3, marginBottom: 16 }} />
          <p>No scenarios yet. Run attacks from the Console tab.</p>
        </div>
      ) : (
        scenarios.map((s) => (
          <article key={s.runId} style={{
            padding: '16px',
            background: 'var(--bg-surface)',
            border: `1px solid ${s.verdict === 'FAIL' ? 'rgba(244,63,94,.15)' : 'rgba(52,211,153,.1)'}`,
            borderRadius: 12,
            transition: '0.2s',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <span className="category-badge">{s.category}</span>
                <span className="owasp-badge">OWASP LLM</span>
              </div>
              <span style={{
                padding: '3px 10px', borderRadius: 999, fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                background: s.verdict === 'PASS' ? 'rgba(52,211,153,.12)' : 'rgba(244,63,94,.12)',
                color: s.verdict === 'PASS' ? 'var(--emerald)' : 'var(--rose)',
              }}>{s.verdict}</span>
            </div>
            <p style={{ margin: '0 0 8px', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>{s.prompt}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.time} · confidence {s.confidence}</span>
              <Link href={`/traces/${s.runId}`} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--cyan)', fontSize: 10, textDecoration: 'none' }}>
                View Trace <ArrowUpRight size={12} />
              </Link>
            </div>
          </article>
        ))
      )}
    </div>
  )
}

function LibraryPanel({ scenarios }: { scenarios: (RedTeamDisplayItem | RedTeamScenario)[] }) {
  const failures = scenarios.filter(s => s.verdict === 'FAIL')
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ color: 'var(--rose)', fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Library size={12} />SAVED FAILURES · REMEDIATION QUEUE
        </div>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>
          Attack scenarios where guardrails were bypassed — prioritised for patching
        </p>
      </div>
      {failures.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--text-muted)', fontSize: 13 }}>
          <ShieldAlert size={40} style={{ opacity: 0.3, marginBottom: 16 }} />
          <p style={{ marginBottom: 4 }}>No failures recorded yet.</p>
          <p style={{ fontSize: 11 }}>All guardrails are holding — or run more attacks from the Console tab.</p>
        </div>
      ) : (
        failures.map((s) => (
          <article key={s.runId} style={{
            padding: '18px',
            background: 'rgba(244,63,94,0.03)',
            border: '1px solid rgba(244,63,94,.18)',
            borderRadius: 12,
          }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <span className="category-badge">{s.category}</span>
              <span style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(244,63,94,.12)', color: 'var(--rose)', fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                GUARDRAIL BYPASSED
              </span>
            </div>
            <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>{s.prompt}</p>
            {'justification' in s && s.justification && (
              <p style={{ margin: '0 0 12px', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.5 }}>
                {s.justification}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <Link href={`/traces/${s.runId}`} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', border: '1px solid rgba(34,211,238,.2)', borderRadius: 8, color: 'var(--cyan)', fontSize: 10, textDecoration: 'none' }}>
                <ArrowUpRight size={12} /> Full Analysis
              </Link>
              <Link href="/remediation" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', border: '1px solid rgba(244,63,94,.25)', borderRadius: 8, color: 'var(--rose)', fontSize: 10, textDecoration: 'none' }}>
                <Zap size={12} /> Fix with AI
              </Link>
            </div>
          </article>
        ))
      )}
    </div>
  )
}

function IdleRadar({ running }: { running?: boolean }) {
  return (
    <div className="idle" style={{ width: '100%', maxWidth: 460, margin: 'auto', padding: '24px 0' }}>
      <div className="radar" style={{ width: 140, height: 140, margin: '0 auto 20px' }}>
        <div className="sweep" />
        <div className="radar-dot" />
        <span style={{ width: 70, height: 70 }} />
        <span style={{ width: 105, height: 105 }} />
        <span style={{ width: 140, height: 140 }} />
      </div>
      <p className="awaiting" style={{ margin: '0 0 6px', fontSize: 11, letterSpacing: '0.16em', color: 'var(--cyan)' }}>
        {running ? 'EXECUTING ATTACK...' : 'AWAITING ATTACK VECTOR'}
      </p>
      <p className="idle-copy" style={{ margin: '0 0 24px', fontSize: 12, color: 'var(--text-muted)' }}>
        {running ? 'Streaming live execution telemetry from the sandbox...' : 'Launch an attack from the console to stream live execution telemetry'}
      </p>
      <div style={{ textAlign: 'left', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 20px', opacity: running ? 0.8 : 0.5, transition: 'opacity 0.3s' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 12 }}>
          <span>STANDBY PREVIEW</span><span>STREAMING TELEMETRY</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { step: '01', title: 'Adversarial Prompt Ingestion', detail: 'Parses input vector & checks safety boundaries', color: 'var(--emerald)' },
            { step: '02', title: 'Guardrail & Policy Evaluation', detail: 'Evaluates system prompt constraints & tool policies', color: 'var(--amber)' },
            { step: '03', title: 'Execution & Verdict Classification', detail: 'LLM-as-judge assesses action output & safety verdict', color: 'var(--rose)' },
          ].map((item) => (
            <div key={item.step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', border: `1px solid ${item.color}`, color: item.color, fontSize: 9, display: 'grid', placeItems: 'center', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
                {item.step}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{item.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Theater({ running, selected }: { running: boolean; selected: RedTeamDisplayItem | RedTeamScenario | null }) {
  if (!selected) return <section className="theater"><IdleRadar running={running} /></section>
  const scenario = selected
  const isPass = scenario.verdict === 'PASS'
  const runId = scenario.runId
  return (
    <section className="theater theater-active">
      <div className="execution-header">
        <span className="pulse-bar" />
        <div>
          <p><Activity size={14} /> {running ? 'EXECUTING ATTACK' : 'EXECUTION COMPLETE'}</p>
          <span>{scenario.category} / {runId}</span>
        </div>
        <Zap size={18} className="energy" />
      </div>
      {!running && (
        <div className={`slam ${isPass ? 'slam-pass' : ''}`}>
          <strong>{scenario.verdict}</strong>
          <span>{isPass ? 'ATTACK DEFENDED — AGENT HELD SAFE' : 'ATTACK SUCCESSFUL — GUARDRAIL BYPASSED'}</span>
        </div>
      )}
      <div className="trace-title"><span>CLASSIFICATION</span><span>LIVE RESULT</span></div>
      <div className="trace">
        <div className={`trace-step ${isPass ? 'safe' : 'danger'}`}>
          <div className="trace-node">01</div>
          <div>
            <strong>{isPass ? 'SAFE BEHAVIOR CONFIRMED' : 'FAILURE DETECTED'}</strong>
            <p>{(scenario as RedTeamDisplayItem).justification ?? `Category: ${scenario.category}`}</p>
          </div>
          <time>{scenario.time}</time>
        </div>
      </div>
      {!running && (
        <div className="theater-actions">
          <Link href={`/traces/${runId}`}>View Full Analysis <ChevronRight size={14} /></Link>
          <button><Library size={14} /> Save to Scenario Library</button>
        </div>
      )}
    </section>
  )
}

export default function RedTeamPage() {
  const { agentId, agent, activeVersionId } = useAgent()
  const mockScenarios = RED_TEAM_SCENARIOS[agentId]
  const chips = SUGGESTION_CHIPS[agentId]

  const [activeTab, setActiveTab] = useState<Tab>('console')
  const [liveItems, setLiveItems] = useState<RedTeamDisplayItem[]>([])
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [launchError, setLaunchError] = useState<string | null>(null)
  const [selected, setSelected] = useState<RedTeamDisplayItem | RedTeamScenario | null>(null)

  const allScenarios: (RedTeamDisplayItem | RedTeamScenario)[] = [
    ...liveItems,
    ...(liveItems.length === 0 ? mockScenarios : []),
  ]

  useEffect(() => { setSelected(null); setInput('') }, [agentId])

  const launch = useCallback(async () => {
    if (!input.trim() || running) return
    setRunning(true)
    setLaunchError(null)

    if (activeVersionId) {
      try {
        const resp = await redTeamChat(activeVersionId, input.trim())
        const item = mapRedTeamResponse(resp, input.trim())
        setLiveItems((prev) => [item, ...prev])
        setSelected(item)
      } catch (err) {
        setLaunchError(
          err instanceof ApiError
            ? `API error ${err.status} — ${JSON.stringify((err.body as {detail?: string})?.detail ?? err.body)}`
            : 'Request failed — is the backend running?'
        )
        setSelected(null)
      }
    } else {
      await new Promise((r) => setTimeout(r, 1900))
      setSelected({ ...mockScenarios[0], prompt: input, time: 'NOW', runId: `run-demo-${Date.now().toString().slice(-4)}` })
    }
    setRunning(false)
  }, [input, running, activeVersionId, mockScenarios])

  const failCount = allScenarios.filter(s => s.verdict === 'FAIL').length

  const tabStyle = (tab: Tab) => ({
    background: 'none' as const,
    border: 'none' as const,
    borderBottom: activeTab === tab ? '2px solid var(--rose)' : '2px solid transparent',
    cursor: 'pointer' as const,
    color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
    padding: '21px 0',
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.04em',
    transition: '0.2s',
  })

  return (
    <div className="redteam-shell">
      <header className="redteam-topbar">
        <div className="redteam-brand"><Swords size={17} /><span>RED TEAM</span><i>///</i></div>
        <nav className="redteam-nav">
          <button style={tabStyle('console')} onClick={() => setActiveTab('console')}>Console</button>
          <button style={tabStyle('scenarios')} onClick={() => setActiveTab('scenarios')}>Scenarios</button>
          <button style={tabStyle('library')} onClick={() => setActiveTab('library')}>
            Library
            {failCount > 0 && (
              <span style={{ marginLeft: 6, padding: '1px 5px', borderRadius: 999, background: 'var(--rose)', color: '#fff', fontSize: 8, fontWeight: 700, verticalAlign: 'middle' }}>
                {failCount}
              </span>
            )}
          </button>
        </nav>
        <div className="redteam-actions">
          <span className="live-dot" />
          <span>{agent.name} {activeVersionId ? 'LIVE' : 'DEMO'}</span>
          <button aria-label="Open terminal"><Terminal size={16} /></button>
        </div>
      </header>

      {activeTab === 'console' && (
        <div className="split-layout">
          <section className="console" id="console">
            <div className="console-head">
              <div className="eyebrow"><Swords size={14} /> RED TEAM CONSOLE</div>
              <p>Natural Language Adversarial Testing · {agent.name} {agent.version}</p>
              <div className="rule"><i /></div>
            </div>
            <MessageHistory scenarios={allScenarios} />
            <div className="input-dock">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Describe an attack scenario for ${agent.name}...`}
                rows={3}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) launch() }}
              />
              {launchError && (
                <p style={{ color: '#F43F5E', fontSize: 11, margin: '4px 0 0' }}>⚠ {launchError}</p>
              )}
              <div className="input-row">
                <button
                  className={`execute ${input.trim() ? 'ready' : ''}`}
                  onClick={launch}
                  disabled={!input.trim() || running}
                >
                  {running ? <Loader2 size={15} className="spin" /> : <Swords size={15} />}
                  {running ? 'Executing...' : 'Execute Attack'}
                </button>
                <div className="suggestions">
                  {chips.labels.map((item, i) => (
                    <button key={item} onClick={() => setInput(chips.prompts[i])}>{item}</button>
                  ))}
                </div>
              </div>
            </div>
          </section>
          <Theater running={running} selected={selected} />
        </div>
      )}

      {activeTab === 'scenarios' && (
        <div style={{ height: 'calc(100vh - 92px)', display: 'flex', flexDirection: 'column' }}>
          <ScenariosPanel scenarios={allScenarios} />
        </div>
      )}

      {activeTab === 'library' && (
        <div style={{ height: 'calc(100vh - 92px)', display: 'flex', flexDirection: 'column' }}>
          <LibraryPanel scenarios={allScenarios} />
        </div>
      )}

      <footer className="statusbar">
        <span>
          Session: <b>{allScenarios.length}</b> attacks executed ·{' '}
          <em>{failCount} failures detected</em>
        </span>
        <button><Download size={13} /> Export Session</button>
      </footer>
    </div>
  )
}
