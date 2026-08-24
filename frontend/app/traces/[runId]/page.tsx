'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementType,
} from 'react'
import { useParams } from 'next/navigation'
import { useAgent } from '@/lib/agent-context'
import { getRun, classifyRun, ApiError } from '@/lib/api'
import { mapTrace, type DisplayStep } from '@/lib/trace-mapper'
import { useWebSocket } from '@/lib/use-websocket'
import { BASE_URL } from '@/lib/api'
import type { RunRead, ClassificationRead, BackendTraceStep } from '@/lib/api-types'
import {
  AlertTriangle,
  Brain,
  Check,
  ChevronDown,
  Clipboard,
  Crosshair,
  Flag,
  Menu,
  Pause,
  Play,
  Shield,
  ShieldOff,
  Wrench,
  X,
} from 'lucide-react'
import { PageErrorBoundary } from '@/components/page-error-boundary'

// ── WebSocket URL ─────────────────────────────────────────────────────────────
const WS_URL = BASE_URL.replace(/^http/, 'ws') + '/ws/traces'

// ── Sub-components (unchanged UI, real data injected) ─────────────────────────

function Badge({ children, tone = 'muted' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

interface IntelProps {
  open: boolean
  setOpen: (v: boolean) => void
  run: RunRead | null
  classification: ClassificationRead | null
}

function Intel({ open, setOpen, run, classification }: IntelProps) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const runId = run?.id?.slice(0, 8) ?? '--------'
  const copy = () => {
    navigator.clipboard?.writeText(run?.id ?? '')
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  // Build tool list from trace
  const toolCalls = useMemo(() => {
    if (!run?.trace) return []
    return run.trace
      .filter((s) => s.step_type === 'tool_call')
      .map((s) => ({
        name: (s.content?.tool_name as string) ?? 'unknown',
        risk: (s.risk_level ?? 'LOW').toUpperCase(),
        response: JSON.stringify(s.content ?? {}, null, 2),
      }))
  }, [run])

  return (
    <aside className={`intel trace-panel ${open ? 'is-open' : ''}`}>
      <button className="mobile-panel-toggle" onClick={() => setOpen(false)}><X size={15} /> Close intel</button>
      <div className="eyebrow">SCENARIO INTEL</div>
      <div className="run-id">
        {runId}{' '}
        <button aria-label="Copy run ID" onClick={copy}>
          {copied ? <Check size={13} /> : <Clipboard size={13} />}
        </button>
      </div>
      {classification && (
        <div className="badge-row">
          <Badge tone="rose">{classification.failure_category ?? 'UNCATEGORIZED'}</Badge>
          {classification.owasp_mapping && <Badge tone="violet">{classification.owasp_mapping}</Badge>}
        </div>
      )}

      {/* Attack vector: first user_input step */}
      {run?.trace && (() => {
        const firstInput = run.trace.find((s) => s.step_type === 'user_input')
        if (!firstInput) return null
        const msg = (firstInput.content?.message as string) ?? (firstInput.content?.text as string)
        return (
          <section className="intel-section">
            <div className="eyebrow section-label"><Crosshair size={12} /> ATTACK VECTOR</div>
            <blockquote>&ldquo;{msg}&rdquo;</blockquote>
          </section>
        )
      })()}

      <section className="intel-section tools">
        <div className="eyebrow section-label">
          <Wrench size={12} /> ARMED TOOLS <span className="tool-count">{toolCalls.length}</span>
        </div>
        {toolCalls.map(({ name, risk, response }, i) => (
          <div className="tool-row" key={`${name}-${i}`}>
            <button onClick={() => setExpanded(expanded === i ? null : i)} aria-expanded={expanded === i}>
              <ChevronDown size={13} className={expanded === i ? 'rotate' : ''} />
              <code>{name}</code>
              <Badge tone={risk === 'CRITICAL' ? 'rose' : risk === 'LOW' ? 'green' : 'amber'}>{risk}</Badge>
            </button>
            {expanded === i && <pre>{response}</pre>}
          </div>
        ))}
        {toolCalls.length === 0 && <p style={{ color: '#55556A', fontSize: 12 }}>No tool calls in this trace.</p>}
      </section>
    </aside>
  )
}

interface TimelineProps {
  steps: DisplayStep[]
  current: number
  autoScroll: boolean
  streaming: boolean
}

function Timeline({ steps, current, autoScroll, streaming }: TimelineProps) {
  const totalMs = steps.length > 0
    ? `${(steps.length * 0.4).toFixed(1)}s`
    : '—'

  return (
    <main className="narrative trace-panel">
      <div className="narrative-head">
        <div className="eyebrow">ATTACK NARRATIVE</div>
        <div className="head-meta">
          <code>{totalMs}</code>
          {streaming
            ? <Badge tone="amber">STREAMING</Badge>
            : <Badge tone="green">COMPLETED</Badge>}
        </div>
      </div>
      <div className="timeline">
        {steps.length === 0 && (
          <p style={{ color: '#55556A', fontSize: 13, padding: '24px 0' }}>
            No trace steps yet. Run a scenario to see the execution trace.
          </p>
        )}
        {steps.map((step, i) => {
          const Icon: ElementType = step.icon
          return (
            <article
              className={`step step-${step.type} ${i <= current ? 'step-visible' : 'step-dim'}`}
              key={`${step.title}-${i}`}
            >
              <div className="connector" />
              <div className="dot">{step.guardrail && <X size={9} />}</div>
              <div className="step-card">
                <header>
                  <div className="step-title"><Icon size={16} /><strong>{step.title}</strong></div>
                  <code>{step.time}</code>
                </header>
                <div className="step-sub">
                  <Badge tone={
                    step.type === 'critical' || step.risk === 'BYPASSED' ? 'rose'
                      : step.type === 'elevated' ? 'amber'
                      : step.type === 'safe' ? 'green'
                      : 'muted'
                  }>{String(i + 1).padStart(2, '0')}</Badge>
                  <span className="risk">{step.risk}</span>
                </div>
                {step.body && <p>{step.body}</p>}
                {step.flaw && <div className="annotation">REASONING FLAW <span>{step.flaw}</span></div>}
                {step.tool && step.toolName && (
                  <div className="tool-call">
                    <code className="tool-name">{step.toolName}</code>
                    <pre>{JSON.stringify(step.body ?? {})}</pre>
                  </div>
                )}
                {step.tool && (
                  <div className="warning">
                    <AlertTriangle size={16} />{' '}
                    <strong>RISK:</strong> {step.toolName ?? 'Unknown'} called{' '}
                    {step.risk === 'CRITICAL' ? 'without confirmation' : 'with elevated risk'}
                  </div>
                )}
                {step.guardrail && (
                  <div className="guardrail">
                    <strong>NO CONFIRMATION DETECTED</strong>
                    <p>
                      The agent called a high-risk tool without requesting user confirmation.
                    </p>
                    <Badge tone="rose">GUARDRAIL BYPASSED</Badge>
                  </div>
                )}
                {step.aftermath && (
                  <div className="tool-call compact">
                    <code className="tool-name muted-text">{step.toolName ?? 'tool_response'}</code>
                    <pre>{step.body ?? ''}</pre>
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>
      {autoScroll && <div className="auto-note">AUTO-SCROLL ENABLED</div>}
    </main>
  )
}

interface VerdictPanelProps {
  open: boolean
  setOpen: (v: boolean) => void
  classification: ClassificationRead | null
  classifying: boolean
}

function VerdictPanel({ open, setOpen, classification, classifying }: VerdictPanelProps) {
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState('1x')
  const [auto, setAuto] = useState(true)
  const [current, setCurrent] = useState(2)
  const circumference = 2 * Math.PI * 32
  const confidence = classification?.confidence ?? 0
  const dashOffset = circumference * (1 - confidence)

  return (
    <aside className={`verdict-panel trace-panel ${open ? 'is-open' : ''}`}>
      <button className="mobile-panel-toggle" onClick={() => setOpen(false)}><X size={15} /> Close verdict</button>
      <div className="eyebrow">VERDICT</div>

      {classifying && (
        <p style={{ color: '#8B8B9E', fontSize: 12 }}>Classifying run…</p>
      )}
      {!classifying && !classification && (
        <p style={{ color: '#55556A', fontSize: 12 }}>No classification yet.</p>
      )}
      {classification && (
        <>
          <div className={`trace-${classification.verdict === 'PASS' ? 'pass' : 'fail'}`}>
            {classification.verdict}
          </div>
          <Badge tone={classification.verdict === 'PASS' ? 'green' : 'rose'}>
            {classification.failure_category ?? 'UNCATEGORIZED'}
          </Badge>
          {classification.severity && (
            <div className="trace-severity">{classification.severity}</div>
          )}

          <div className="confidence">
            <svg viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="32" />
              <circle
                className="progress"
                cx="40"
                cy="40"
                r="32"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
              />
            </svg>
            <strong>{Math.round(confidence * 100)}%</strong>
            <span>confidence</span>
          </div>

          {classification.owasp_mapping && (
            <div className="trace-owasp">
              <Badge tone="violet">{classification.owasp_mapping}</Badge>
              <p>{classification.justification}</p>
            </div>
          )}

          <section className="justification">
            <div className="eyebrow">JUSTIFICATION</div>
            <p>{classification.justification}</p>
          </section>
        </>
      )}

      <section className="replay">
        <div className="eyebrow">REPLAY</div>
        <div className="replay-row">
          <button
            className="play"
            onClick={() => { setPlaying(!playing); setCurrent(playing ? current : 5) }}
            aria-label={playing ? 'Pause replay' : 'Play replay'}
          >
            {playing ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <div className="speeds">
            {['0.5x', '1x', '2x'].map((s) => (
              <button className={speed === s ? 'active' : ''} onClick={() => setSpeed(s)} key={s}>{s}</button>
            ))}
          </div>
        </div>
        <div className="progress-bar">
          <span style={{ width: `${((current + 1) / 6) * 100}%` }} />
          <i style={{ left: `${((current + 1) / 6) * 100}%` }} />
        </div>
        <div className="replay-foot">
          <code>Step {current + 1}/6</code>
          <button className="toggle" onClick={() => setAuto(!auto)} aria-pressed={auto}>
            <span className={auto ? 'on' : ''} /> Auto-scroll
          </button>
        </div>
      </section>
    </aside>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TraceViewerPage() {
  return (
    <PageErrorBoundary pageName="Trace Viewer">
      <TraceViewerPageInner />
    </PageErrorBoundary>
  )
}

function TraceViewerPageInner() {
  const params = useParams()
  const runId = (params.runId as string) ?? ''
  const { agent } = useAgent()

  // ── Fetch run data ────────────────────────────────────────────────────────
  const [run, setRun] = useState<RunRead | null>(null)
  const [runError, setRunError] = useState<string | null>(null)

  useEffect(() => {
    if (!runId) return
    const controller = new AbortController()
    getRun(runId, controller.signal)
      .then(setRun)
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return
        setRunError(err instanceof ApiError ? `Error ${err.status}` : 'Failed to load run')
      })
    return () => controller.abort()
  }, [runId])

  // ── WebSocket streaming ───────────────────────────────────────────────────
  const { messages, status: wsStatus } = useWebSocket(WS_URL)

  // Accumulate streaming steps from WebSocket
  const [streamSteps, setStreamSteps] = useState<BackendTraceStep[]>([])
  useEffect(() => {
    const newSteps = messages
      .filter((m) => m.event === 'trace_step')
      .map((m) => m.data as unknown as BackendTraceStep)
    if (newSteps.length > 0) {
      setStreamSteps((prev) => [...prev, ...newSteps.slice(prev.length)])
    }
  }, [messages])

  // ── Display steps: prefer streaming, fall back to persisted trace ─────────
  const traceSteps: BackendTraceStep[] = streamSteps.length > 0
    ? streamSteps
    : (run?.trace ?? [])
  const displaySteps = useMemo(() => mapTrace(traceSteps), [traceSteps])
  const isStreaming = wsStatus === 'open' && streamSteps.length > 0

  // ── Classification (with Strict Mode double-fire guard) ───────────────────
  const [classification, setClassification] = useState<ClassificationRead | null>(null)
  const [classifying, setClassifying] = useState(false)
  const hasTriggeredClassify = useRef(false)

  useEffect(() => {
    if (!run) return
    // Only classify once the run is loaded and only if not already classified
    if (hasTriggeredClassify.current) return   // Strict Mode guard
    hasTriggeredClassify.current = true

    const controller = new AbortController()
    setClassifying(true)
    classifyRun(runId, controller.signal)
      .then(setClassification)
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return
        // Non-fatal: classification may already exist or trace may be empty
      })
      .finally(() => setClassifying(false))
    return () => controller.abort()
  }, [run, runId])

  // Reset guard when runId changes (navigating between runs)
  useEffect(() => {
    hasTriggeredClassify.current = false
    setClassification(null)
    setClassifying(false)
    setStreamSteps([])
  }, [runId])

  // ── Panel state ───────────────────────────────────────────────────────────
  const [intelOpen, setIntelOpen] = useState(false)
  const [verdictOpen, setVerdictOpen] = useState(false)
  const current = displaySteps.length - 1

  const versionLabel = run
    ? `RUN ${runId.slice(0, 8)}`
    : `${agent.name} ${agent.version}`

  return (
    <div className="trace-app">
      <header className="trace-topbar">
        <div className="brand-mark">
          <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#22D3EE', marginRight: 8, boxShadow: '0 0 10px #22D3EE' }} />
          TRACE//LAB
        </div>
        <div className="top-context">
          <code>{runId ? `RUN ${runId.slice(0, 8)}` : 'NO RUN'}</code>
          <span style={{ margin: '0 8px', color: '#55556A' }}>·</span>
          <span style={{ fontSize: 10, color: '#8B8B9E', fontFamily: 'var(--font-mono)' }}>{versionLabel}</span>
          {isStreaming && (
            <>
              <span className="live-dot" style={{ width: 5, height: 5, background: '#34D399', boxShadow: '0 0 8px #34D399', marginLeft: 8 }} />
              {' '}LIVE
            </>
          )}
        </div>
        {runError && <span style={{ color: '#F43F5E', fontSize: 11 }}>{runError}</span>}
        <button className="menu-button" onClick={() => setIntelOpen(!intelOpen)} aria-label="Open scenario intel">
          <Menu size={18} />
        </button>
      </header>

      <div className="mobile-drawers">
        <button onClick={() => setIntelOpen(true)}>Scenario intel</button>
        <button onClick={() => setVerdictOpen(true)}>Verdict</button>
      </div>

      <div className="workspace">
        <Intel open={intelOpen} setOpen={setIntelOpen} run={run} classification={classification} />
        <Timeline steps={displaySteps} current={current} autoScroll={false} streaming={isStreaming} />
        <VerdictPanel open={verdictOpen} setOpen={setVerdictOpen} classification={classification} classifying={classifying} />
      </div>
    </div>
  )
}
