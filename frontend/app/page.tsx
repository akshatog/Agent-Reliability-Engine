'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAgent } from '@/lib/agent-context'
import { TREND_DATA, FAILURE_DISTRIBUTION, RECENT_RUNS, OWASP_RISKS } from '@/lib/mock-data'
import { listRuns } from '@/lib/api'
import type { RunRead } from '@/lib/api-types'

function Counter({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [current, setCurrent] = useState(0)
  useEffect(() => {
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min((now - start) / 1500, 1)
      setCurrent(value * (1 - Math.pow(1 - progress, 3)))
      if (progress < 1) requestAnimationFrame(tick)
    }
    const id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [value])
  return <>{current.toFixed(decimals)}</>
}

function MetricCard({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <section className={`metric-card ${className}`}>{children}</section>
}
function Header({ title, subtitle, children }: { title: string; subtitle: string; children?: React.ReactNode }) {
  return <div className="section-header"><div><h2>{title}</h2><p>{subtitle}</p></div>{children}</div>
}

export default function DashboardPage() {
  const [range, setRange] = useState('30 days')
  const { agentId, agent, activeVersionId, activeScorecard } = useAgent()

  const mockTrend = TREND_DATA[agentId]
  const failures = FAILURE_DISTRIBUTION[agentId]
  const mockRuns = RECENT_RUNS[agentId]
  const owaspRisks = OWASP_RISKS[agentId]

  // ── Live runs for recent runs table ───────────────────────────────────
  const [liveRuns, setLiveRuns] = useState<RunRead[] | null>(null)
  useEffect(() => {
    if (!activeVersionId) return
    const controller = new AbortController()
    listRuns(activeVersionId, controller.signal)
      .then(setLiveRuns)
      .catch((err) => { if ((err as Error).name !== 'AbortError') setLiveRuns(null) })
    return () => controller.abort()
  }, [activeVersionId])

  // ── KPI: prefer live scorecard, fall back to mock agent ────────────────
  const score = activeScorecard?.overall_reliability_score ?? agent.score
  const totalRuns = activeScorecard?.total_runs ?? agent.totalRuns
  const guardrailRate = activeScorecard?.guardrail_hold_rate ?? agent.guardRailRate
  const criticalCount = activeScorecard?.severity_distribution?.CRITICAL ?? agent.criticalCount
  const highCount = activeScorecard?.severity_distribution?.HIGH ?? agent.highCount
  const activeFailures = activeScorecard?.failures ?? agent.activeFailures

  // ── Trend data: fall back to mock (trend is from scorecard page, dashboard keeps mock) ──
  const trendData = mockTrend

  // ── Failure distribution from scorecard when live ───────────────────────
  const CATEGORY_COLORS: Record<string, string> = {
    DESTRUCTIVE_ACTION: '#F43F5E',
    PROMPT_INJECTION: '#8B5CF6',
    GOAL_DRIFT: '#FBBF24',
    TOOL_CALL_LOOP: '#FB923C',
    WRONG_TOOL: '#38BDF8',
    HALLUCINATED_CONFIDENCE: '#F472B6',
    PREMATURE_COMPLETION: '#A1A1AA',
  }
  const liveFailures = useMemo(() => {
    if (!activeScorecard?.per_category_breakdown) return null
    return Object.entries(activeScorecard.per_category_breakdown).map(([cat, bd]) => ({
      name: cat.replace(/_/g, ' '),
      value: bd.fails ?? bd.fail_count ?? 0,
      count: bd.fails ?? bd.fail_count ?? 0,
      color: CATEGORY_COLORS[cat] ?? '#6B7280',
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScorecard])

  const failuresData = liveFailures ?? failures

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">MISSION CONTROL / OVERVIEW</p>
          <h1>Agent security overview</h1>
          <p className="lede">{agent.name} {agent.version} — {agent.description}</p>
        </div>
        <div className="live-indicator"><span /> LIVE MONITORING</div>
      </div>
      <div className="metric-grid">
        <MetricCard className="cyan-card">
          <p className="metric-label">RELIABILITY SCORE</p>
          <div className="metric-number cyan"><Counter value={score} decimals={1}/><small>%</small></div>
          <div className="metric-meta"><b className="grade">{agent.grade}</b><span className="positive">vs prev: +{(score - (trendData[trendData.length - 2]?.reliability ?? score - 5)).toFixed(1)}%</span></div>
        </MetricCard>
        <MetricCard>
          <p className="metric-label">TOTAL RUNS</p>
          <div className="metric-number"><Counter value={totalRuns}/></div>
          <div className="metric-meta"><span>Total executions</span><span className="positive"><TrendingUp size={14}/> {activeScorecard ? 'Live' : '+23 today'}</span></div>
        </MetricCard>
        <MetricCard className="emerald-card">
          <p className="metric-label">GUARDRAIL HOLD RATE</p>
          <div className="metric-number emerald"><Counter value={guardrailRate} decimals={1}/><small>%</small></div>
          <div className="metric-meta"><span>Rule enforcement</span><span className="positive"><ShieldCheck size={14}/> {guardrailRate.toFixed(1)}%</span></div>
        </MetricCard>
        <MetricCard className="failure-card">
          <p className="metric-label">ACTIVE FAILURES</p>
          <div className="metric-number rose"><Counter value={activeFailures}/></div>
          <div className="metric-meta"><span>{criticalCount} critical · {highCount} high</span><span className="positive"><TrendingDown size={14}/> ↓2</span></div>
        </MetricCard>
      </div>

      <div className="middle-grid">
        <section className="panel" style={{ padding: 22 }}>
          <Header title="Reliability Trend" subtitle={`Score progression — ${agent.name}`}>
            <div className="range-pills">
              {['7 days','30 days','All time'].map(item => (
                <button key={item} className={range === item ? 'active' : ''} onClick={() => setRange(item)}>{item}</button>
              ))}
            </div>
          </Header>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{top: 15, right: 10, left: -18, bottom: 0}}>
                <defs>
                  <linearGradient id="cyanFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22D3EE" stopOpacity={0.2}/>
                    <stop offset="100%" stopColor="#22D3EE" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)"/>
                <XAxis dataKey="version" tick={{fill:'#55556A',fontSize:11}} tickLine={false} axisLine={{stroke:'rgba(255,255,255,.04)'}}/>
                <YAxis domain={[0,100]} tickCount={5} tick={{fill:'#55556A',fontSize:11}} tickLine={false} axisLine={false}/>
                <ReferenceLine y={80} stroke="#FBBF24" strokeDasharray="8 4" label={{value:'Target',fill:'#FBBF24',fontSize:10,position:'insideTopRight'}}/>
                <Tooltip contentStyle={{background:'#131320',border:'1px solid rgba(255,255,255,.08)',borderRadius:10,color:'#F0F0F5'}} formatter={(value: number) => [`${value}%`, 'Reliability']}/>
                <Area type="monotone" dataKey="reliability" stroke="#22D3EE" strokeWidth={2.5} fill="url(#cyanFill)" dot={{r:5,fill:'#22D3EE',stroke:'#0C0C12',strokeWidth:3}} activeDot={{r:8,fill:'#22D3EE',stroke:'#0C0C12',strokeWidth:3}}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel" style={{ padding: 22 }}>
          <Header title="Failure Distribution" subtitle="Breakdown by category"/>
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={failuresData} dataKey="value" innerRadius={75} outerRadius={108} paddingAngle={2} stroke="#0C0C12" strokeWidth={3} isAnimationActive>
                  {failuresData.map((entry) => <Cell key={entry.name} fill={entry.color}/>)}
                </Pie>
                <Tooltip contentStyle={{background:'#131320',border:'1px solid rgba(255,255,255,.08)',borderRadius:10}} formatter={(value: number) => [`${value}`, 'Count']}/>
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center"><strong>{failuresData.reduce((a, b) => a + b.count, 0)}</strong><span>failures</span></div>
          </div>
          <div className="legend">
            {failuresData.map(f => (
              <div key={f.name}><i style={{background:f.color}}/><span>{f.name}</span><b>{f.count}</b></div>
            ))}
          </div>
        </section>
      </div>
      <div className="bottom-grid">
        <section className="panel" style={{ padding: 22 }}>
          <Header title="Recent Runs" subtitle="Latest scenario executions"/>
          <div className="run-table">
            <div className="table-head">
              <span>SCENARIO</span><span>CATEGORY</span><span>VERDICT</span><span>SEVERITY</span><span>DURATION</span>
            </div>
            {liveRuns && liveRuns.length > 0
              ? liveRuns.slice(0, 8).map((run) => (
                  <Link className="run-row" href={`/traces/${run.id}`} key={run.id}>
                    <span>{run.id.slice(0, 8)}</span>
                    <em className="tag">RUN</em>
                    <em className={`verdict ${run.status.toLowerCase()}`}>{run.status}</em>
                    <b className="severity">—</b>
                    <code>{run.duration_ms ? `${run.duration_ms}ms` : '—'}</code>
                  </Link>
                ))
              : mockRuns.map((run, i) => (
                  <Link className="run-row" href={`/traces/run-${i+1}`} key={run[0]}>
                    <span>{run[0]}</span>
                    <em className={`tag ${run[5]}`}>{run[1]}</em>
                    <em className={`verdict ${run[2].toLowerCase()}`}>{run[2]}</em>
                    <b className={`severity ${run[3].toLowerCase()}`}>{run[3]}</b>
                    <code>{run[4]}</code>
                  </Link>
                ))
            }
          </div>
          <Link className="view-all" href="/scorecard">View all runs <span>→</span></Link>
        </section>
        <section className="panel" style={{ padding: 22 }}>
          <Header title="OWASP Risk Profile" subtitle="OWASP LLM Top 10 (2025) mapping"/>
          <div className="risks">
            {owaspRisks.map(([code, name, width, color], i) => (
              <div className="risk" key={code}>
                <div className="risk-label"><span><b>{code}</b><small>{name as string}</small></span><strong>{width}</strong></div>
                <div className="risk-track"><i className={String(color)} style={{'--bar-width':`${width}%`,animationDelay:`${400+i*100}ms`} as React.CSSProperties}/></div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
