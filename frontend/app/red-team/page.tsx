'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Activity, ArrowUpRight, Check, ChevronRight, Download, Library, Loader2, ShieldAlert, Swords, Terminal, Zap } from 'lucide-react'
import { useAgent } from '@/lib/agent-context'
import { RED_TEAM_SCENARIOS, SUGGESTION_CHIPS } from '@/lib/mock-data'
import type { RedTeamScenario } from '@/lib/mock-data'
import { redTeamChat, ApiError } from '@/lib/api'
import { mapRedTeamResponse } from '@/lib/red-team-mapper'
import type { RedTeamDisplayItem } from '@/lib/api-types'

function ScenarioCard({ scenario }: { scenario: RedTeamDisplayItem | RedTeamScenario }) {
  const isPass = scenario.verdict === 'PASS'
  const runId = scenario.runId
  return (
    <article className={`scenario-card ${isPass ? 'safe-card' : ''}`}>
      <div className="scenario-heading">
        <span><Check size={13} /> Scenario Generated</span>
        <span className="scenario-run">{runId}</span>
      </div>
      <div className="badge-row">
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

function IdleRadar() {
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
        AWAITING ATTACK VECTOR
      </p>
      <p className="idle-copy" style={{ margin: '0 0 24px', fontSize: 12, color: 'var(--text-muted)' }}>
        Launch an attack from the console to stream live execution telemetry
      </p>

      {/* Ghosted preview skeleton of execution trace */}
      <div style={{
        textAlign: 'left',
        background: 'rgba(255,255,255,0.02)',
        border: '1px dashed rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: '16px 20px',
        opacity: 0.5,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 12 }}>
          <span>STANDBY PREVIEW</span>
          <span>STREAMING TELEMETRY</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { step: '01', title: 'Adversarial Prompt Ingestion', detail: 'Parses input vector & checks safety boundaries', color: 'var(--emerald)' },
            { step: '02', title: 'Guardrail & Policy Evaluation', detail: 'Evaluates system prompt constraints & tool policies', color: 'var(--amber)' },
            { step: '03', title: 'Execution & Verdict Classification', detail: 'LLM-as-judge assesses action output & safety verdict', color: 'var(--rose)' },
          ].map((item) => (
            <div key={item.step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                border: `1px solid ${item.color}`,
                color: item.color,
                fontSize: 9,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                fontFamily: 'var(--font-mono)',
              }}>
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
  if (!running && !selected) return <section className="theater"><IdleRadar /></section>
  const scenario = selected!
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
        <div className={`trace-step ${(scenario as RedTeamDisplayItem).justification ? 'elevated' : 'safe'}`}>
          <div className="trace-node">01</div>
          <div>
            <strong>{scenario.verdict === 'PASS' ? 'SAFE BEHAVIOR CONFIRMED' : 'FAILURE DETECTED'}</strong>
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

  // Live items prepended; mock scenarios shown as history when backend offline
  const [liveItems, setLiveItems] = useState<RedTeamDisplayItem[]>([])
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [launchError, setLaunchError] = useState<string | null>(null)
  const [selected, setSelected] = useState<RedTeamDisplayItem | RedTeamScenario | null>(null)

  // Combined history: live items first (newest first), then mock as fallback
  const allScenarios: (RedTeamDisplayItem | RedTeamScenario)[] = [
    ...liveItems,
    ...(liveItems.length === 0 ? mockScenarios : []),
  ]

  // Reset when agent switches
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
      // Fallback demo mode
      await new Promise((r) => setTimeout(r, 1900))
      setSelected({ ...mockScenarios[0], prompt: input, time: 'NOW', runId: `run-demo-${Date.now().toString().slice(-4)}` })
    }
    setRunning(false)
  }, [input, running, activeVersionId, mockScenarios])

  return (
    <div className="redteam-shell">
      <header className="redteam-topbar">
        <div className="redteam-brand"><Swords size={17} /><span>RED TEAM</span><i>///</i></div>
        <nav className="redteam-nav"><a href="#console" className="active">Console</a><a href="#scenarios">Scenarios</a><a href="#library">Library</a></nav>
        <div className="redteam-actions">
          <span className="live-dot" />
          <span>{agent.name} {activeVersionId ? 'LIVE' : 'DEMO'}</span>
          <button aria-label="Open terminal"><Terminal size={16} /></button>
        </div>
      </header>

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

      <footer className="statusbar">
        <span>
          Session: <b>{allScenarios.length}</b> attacks executed ·{' '}
          <em>{allScenarios.filter((s) => s.verdict === 'FAIL').length} failures detected</em>
        </span>
        <button><Download size={13} /> Export Session</button>
      </footer>
    </div>
  )
}

