'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend,
  Line, PolarAngleAxis, PolarGrid, Radar, RadarChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts'
import { ChevronDown, ChevronRight, Eye, Shield, TrendingUp, Zap } from 'lucide-react'
import { useAgent } from '@/lib/agent-context'
import {
  TREND_DATA, RADAR_DATA, SCORECARD_RUNS, SEVERITY_HEATMAP,
  type HeatmapRow
} from '@/lib/mock-data'
import { getScorecardTrend, listRuns, ApiError } from '@/lib/api'
import type { ScorecardTrendEntry, RunRead } from '@/lib/api-types'

const cyan = '#22D3EE'
const emerald = '#34D399'
const violet = '#8B5CF6'
const rose = '#F43F5E'
const amber = '#FBBF24'
const orange = '#F97316'

const SEVERITY_COLS = ['critical', 'high', 'medium', 'low'] as const
const SEVERITY_COLORS: Record<string, string> = {
  critical: rose,
  high: orange,
  medium: amber,
  low: '#6B7280',
}

// Compute max value for heatmap color scaling
function maxVal(rows: HeatmapRow[], key: keyof HeatmapRow) {
  return Math.max(...rows.map(r => r[key] as number), 1)
}

function heatColor(value: number, max: number, severityKey: string): string {
  const ratio = value / max
  const base = SEVERITY_COLORS[severityKey]
  if (ratio === 0) return 'rgba(255,255,255,0.02)'
  const opacity = 0.1 + ratio * 0.75
  return `${base}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`
}

function SeverityHeatmap({ rows }: { rows: HeatmapRow[] }) {
  const maxes = {
    critical: maxVal(rows, 'critical'),
    high: maxVal(rows, 'high'),
    medium: maxVal(rows, 'medium'),
    low: maxVal(rows, 'low'),
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '0 12px 10px 0', color: '#55556A', fontSize: 9, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
              CATEGORY
            </th>
            {SEVERITY_COLS.map(col => (
              <th key={col} style={{
                padding: '0 6px 10px',
                color: SEVERITY_COLORS[col],
                fontSize: 9,
                fontFamily: 'var(--font-mono)',
                textAlign: 'center',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={row.category} style={{ animation: `rise 0.4s ${ri * 60}ms both` }}>
              <td style={{
                padding: '5px 12px 5px 0',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                color: '#8B8B9E',
                whiteSpace: 'nowrap',
                maxWidth: 160,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {row.category}
              </td>
              {SEVERITY_COLS.map(col => {
                const val = row[col] as number
                const bg = heatColor(val, maxes[col], col)
                return (
                  <td key={col} style={{
                    padding: '4px 6px',
                    textAlign: 'center',
                  }}>
                    <div style={{
                      background: bg,
                      border: `1px solid ${val > 0 ? SEVERITY_COLORS[col] + '30' : 'rgba(255,255,255,0.03)'}`,
                      borderRadius: 6,
                      padding: '6px 4px',
                      minWidth: 44,
                      fontFamily: 'var(--font-mono)',
                      fontSize: val > 0 ? 13 : 11,
                      fontWeight: val > 0 ? 700 : 400,
                      color: val > 0 ? SEVERITY_COLORS[col] : '#55556A',
                      transition: '0.2s',
                    }}>
                      {val > 0 ? val : '—'}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        {SEVERITY_COLS.map(col => (
          <div key={col} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: SEVERITY_COLORS[col],
              opacity: 0.7,
            }} />
            <span style={{ fontSize: 10, color: '#55556A', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
              {col}
            </span>
          </div>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#55556A' }}>cell = failure count</span>
      </div>
    </div>
  )
}

function ChartCard({ title, subtitle, children, className = '' }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return <section className={`chart-card ${className}`}><div className="panel-head"><div><div className="eyebrow">{title}</div>{subtitle && <div className="subtitle">{subtitle}</div>}</div></div>{children}</section>
}

function CountUp({ target }: { target: number }) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let start = 0
    const timer = setInterval(() => {
      start += target / 40
      if (start >= target) { setValue(target); clearInterval(timer) }
      else setValue(start)
    }, 50)
    return () => clearInterval(timer)
  }, [target])
  return <>{value.toFixed(1)}</>
}

function ScoreRing({ score }: { score: number }) {
  const r = 71
  const circumference = 2 * Math.PI * r
  return (
    <svg className="score-ring" viewBox="0 0 160 160" aria-hidden="true">
      <defs>
        <linearGradient id="ring-grad" x1="0" x2="1">
          <stop stopColor={cyan}/><stop offset="1" stopColor={violet}/>
        </linearGradient>
      </defs>
      <circle className="ring-track" cx="80" cy="80" r={r}/>
      <circle className="ring-fill" cx="80" cy="80" r={r}
        stroke="url(#ring-grad)"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - score / 100)}/>
    </svg>
  )
}

export default function ScorecardPage() {
  const { agentId, agent, activeVersionId, activeScorecard, versions: liveVersions } = useAgent()

  const mockTrend = TREND_DATA[agentId]
  const radarData = RADAR_DATA[agentId]
  const runs = SCORECARD_RUNS[agentId]
  const mockHeatmap = SEVERITY_HEATMAP[agentId]

  // ── Live trend data ────────────────────────────────────────────────────────
  const [liveTrend, setLiveTrend] = useState<ScorecardTrendEntry[] | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    getScorecardTrend(controller.signal)
      .then(setLiveTrend)
      .catch((err) => { if ((err as Error).name !== 'AbortError') setLiveTrend(null) })
    return () => controller.abort()
  }, [])

  // ── Live runs list ─────────────────────────────────────────────────────────
  const [liveRuns, setLiveRuns] = useState<RunRead[] | null>(null)
  useEffect(() => {
    if (!activeVersionId) return
    const controller = new AbortController()
    listRuns(activeVersionId, controller.signal)
      .then(setLiveRuns)
      .catch((err) => { if ((err as Error).name !== 'AbortError') setLiveRuns(null) })
    return () => controller.abort()
  }, [activeVersionId])

  // ── Convert live trend to chart shape ──────────────────────────────────────
  const trend = useMemo(() => {
    if (liveTrend && liveTrend.length > 0) {
      return liveTrend.map((t) => ({
        version: t.name,
        reliability: t.overall_reliability_score,
        guardrail: t.guardrail_hold_rate,
        confidence: 85, // not in trend response — use placeholder
      }))
    }
    return mockTrend
  }, [liveTrend, mockTrend])

  // ── Versions for tabs ──────────────────────────────────────────────────────
  const versions = liveTrend && liveTrend.length > 0
    ? liveTrend.map((t) => t.name)
    : trend.map((t) => t.version)

  const [version, setVersion] = useState(versions[versions.length - 1])
  const [metrics, setMetrics] = useState({ reliability: true, guardrail: true, confidence: false })
  const [expanded, setExpanded] = useState(true)
  const [filter, setFilter] = useState('All')
  const [a, setA] = useState(versions[versions.length - 1])
  const [b, setB] = useState(versions[versions.length - 3] ?? versions[0])

  // Reset version tabs when agent changes
  useEffect(() => {
    setVersion(versions[versions.length - 1])
    setA(versions[versions.length - 1])
    setB(versions[versions.length - 3] ?? versions[0])
  }, [agentId, versions.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Convert severity_heatmap dict to HeatmapRow[] ─────────────────────────
  const heatmapRows: HeatmapRow[] = useMemo(() => {
    if (activeScorecard?.severity_heatmap) {
      return Object.entries(activeScorecard.severity_heatmap).map(([category, vals]) => ({
        category,
        critical: vals.critical ?? 0,
        high: vals.high ?? 0,
        medium: vals.medium ?? 0,
        low: vals.low ?? 0,
      }))
    }
    return mockHeatmap
  }, [activeScorecard, mockHeatmap])

  // ── KPI values: prefer live scorecard, fall back to mock agent ─────────────
  const score = activeScorecard?.overall_reliability_score ?? agent.score
  const guardrailRate = activeScorecard?.guardrail_hold_rate ?? agent.guardRailRate
  const totalRuns = activeScorecard?.total_runs ?? agent.totalRuns
  const criticalCount = activeScorecard?.severity_distribution?.CRITICAL ?? agent.criticalCount
  const ciLower = activeScorecard ? (activeScorecard.confidence_interval[0] * 100).toFixed(1) : '74.2'
  const ciUpper = activeScorecard ? (activeScorecard.confidence_interval[1] * 100).toFixed(1) : '82.1'

  // ── Runs table ─────────────────────────────────────────────────────────────
  // Use live run rows when available, otherwise fall back to SCORECARD_RUNS mock
  const filteredRuns = useMemo(() => {
    if (liveRuns && liveRuns.length > 0) {
      const mapped = liveRuns.map((r) => [
        r.id.slice(0, 8),
        new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        r.status,
        'UNKNOWN', // classification not joined here — would need classify endpoint
        r.duration_ms ? `${r.duration_ms}ms` : '—',
      ] as const)
      if (filter === 'All') return mapped
      return mapped.filter((row) => row[3] === filter.toUpperCase())
    }
    return filter === 'All' ? runs : runs.filter((r) => r[3] === filter.toUpperCase())
  }, [filter, runs, liveRuns])

  // ── Severity distribution ──────────────────────────────────────────────────
  const severity = useMemo(() => [
    { name: 'CRITICAL', count: activeScorecard?.severity_distribution?.CRITICAL ?? agent.criticalCount, color: rose },
    { name: 'HIGH', count: activeScorecard?.severity_distribution?.HIGH ?? agent.highCount, color: orange },
    { name: 'MEDIUM', count: activeScorecard?.severity_distribution?.MEDIUM ?? Math.round(agent.activeFailures * 0.6), color: amber },
    { name: 'LOW', count: activeScorecard?.severity_distribution?.LOW ?? Math.round(agent.activeFailures * 0.2), color: '#6B7280' },
  ], [activeScorecard, agent])

  // ── OWASP risk profile ─────────────────────────────────────────────────────
  const owasp = useMemo(() => {
    if (activeScorecard?.owasp_risk_profile && Object.keys(activeScorecard.owasp_risk_profile).length > 0) {
      return Object.entries(activeScorecard.owasp_risk_profile).map(([id, count]) => ({
        id, name: id, count, pct: `${count}`, color: violet, icon: Shield,
      }))
    }
    return [
      { id: 'LLM01', name: 'Prompt Injection', count: 14, pct: '31%', color: violet, icon: Shield },
      { id: 'LLM06', name: 'Excessive Agency', count: 28, pct: '62%', color: rose, icon: Zap },
      { id: 'LLM09', name: 'Overreliance', count: 11, pct: '24%', color: amber, icon: Eye },
      { id: 'LLM10', name: 'Unbounded Consumption', count: 6, pct: '13%', color: orange, icon: TrendingUp },
    ]
  }, [activeScorecard])

  return (
    <div className="scorecard-page">
      <header className="scorecard-topbar">
        <div className="scorecard-brand">
          <span className="scorecard-brand-mark">◈</span>
          <span>RELIABILITY<span className="brand-muted">/</span>SCORECARD</span>
        </div>
        <div className="top-meta">
          <span className="live-dot"/> LIVE EVALUATION
          <span className="divider"/>
          {activeScorecard ? `${agent.name} · Live` : `${agent.name} ${agent.version}`}
          <button className="icon-btn" aria-label="View notifications">•••</button>
        </div>
      </header>

      <nav className="version-tabs" aria-label="Agent versions">
        {versions.map(v => (
          <button key={v} className={version === v ? 'active' : ''} onClick={() => setVersion(v)}>{v}</button>
        ))}
      </nav>

      <div className="scorecard-content">
        <section className="hero panel">
          <div className="score-side">
            <div className="eyebrow">OVERALL RELIABILITY <span className="live-pill">{activeScorecard ? 'LIVE' : 'STABLE'}</span></div>
            <div className="score-wrap">
              <ScoreRing score={score}/>
              <div className="score"><CountUp target={score}/><span>%</span></div>
            </div>
            <div className="score-grade">{agent.grade}</div>
            <div className="interval">
              <div className="eyebrow">95% CONFIDENCE INTERVAL</div>
              <div className="interval-track"><div className="interval-range"/><i/></div>
              <div className="interval-labels"><span>{ciLower}%</span><span>{ciUpper}%</span></div>
            </div>
          </div>
          <div className="stat-grid">
            {[
              ['PASS RATE', `${score.toFixed(1)}%`, `${Math.round(totalRuns * score / 100)}/${totalRuns} passed`, 'cyan'],
              ['GUARDRAIL HOLD', `${guardrailRate.toFixed(1)}%`, '◈ guardrail enforcement', 'good'],
              ['AVG CONFIDENCE', '0.89', 'judge certainty', ''],
              ['CRITICAL FAILURES', String(criticalCount), 'requires remediation', 'bad'],
            ].map(([label, val, sub, color]) => (
              <div className="stat" key={label}>
                <div className="eyebrow">{label}</div>
                <strong className={color || undefined}>{val}</strong>
                <small>{sub}</small>
              </div>
            ))}
          </div>
        </section>

        <div className="chart-grid">
          <ChartCard title="RELIABILITY TREND" subtitle={`Score progression — ${agent.name}`} className="trend-card">
            <div className="toggles">
              {Object.entries(metrics).map(([key, on]) => (
                <button key={key} className={on ? 'on' : ''} onClick={() => setMetrics({...metrics, [key]: !on})}>
                  <span>{on ? '☑' : '☐'}</span> {key[0].toUpperCase()+key.slice(1)}
                </button>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trend} margin={{top:20,right:8,left:-20,bottom:0}}>
                <defs>
                  <linearGradient id="scCyanFill" x1="0" y1="0" x2="0" y2="1">
                    <stop stopColor={cyan} stopOpacity={.18}/><stop offset="1" stopColor={cyan} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,.04)" strokeDasharray="3 3"/>
                <XAxis dataKey="version" tick={{fill:'#55556A',fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis domain={[0,100]} tick={{fill:'#55556A',fontSize:11}} axisLine={false} tickLine={false}/>
                <ReferenceLine y={80} stroke={amber} strokeDasharray="8 4" label={{value:'Target',fill:amber,fontSize:10}}/>
                <Tooltip contentStyle={{background:'#131320',border:'1px solid rgba(255,255,255,.1)',borderRadius:10,fontSize:12}}/>
                <Area hide={!metrics.reliability} type="monotone" dataKey="reliability" stroke={cyan} strokeWidth={2.5} fill="url(#scCyanFill)"/>
                <Line hide={!metrics.guardrail} type="monotone" dataKey="guardrail" stroke={emerald} strokeWidth={2} strokeDasharray="6 4" dot={{r:4,fill:emerald,strokeWidth:0}}/>
                <Line hide={!metrics.confidence} type="monotone" dataKey="confidence" stroke={violet} strokeWidth={2} dot={{r:4,fill:violet,strokeWidth:0}}/>
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="PER-CATEGORY BREAKDOWN" subtitle="Pass rate by failure taxonomy">
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="68%">
                <PolarGrid stroke="rgba(255,255,255,.06)"/>
                <PolarAngleAxis dataKey="category" tick={{fill:'#8B8B9E',fontSize:10}}/>
                <Radar name={`${version} (current)`} dataKey="current" stroke={cyan} fill={cyan} fillOpacity={.15} strokeWidth={2}/>
                <Radar name="previous" dataKey="previous" stroke={violet} fill="none" strokeDasharray="4 3"/>
                <Legend wrapperStyle={{fontSize:11,color:'#8B8B9E'}}/>
                <Tooltip contentStyle={{background:'#131320',border:'1px solid rgba(255,255,255,.1)',borderRadius:10,fontSize:12}}/>
              </RadarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', fontSize: 9, fontFamily: 'var(--font-mono)', color: '#55556A', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, marginTop: 4 }}>
              <span><b>DESTR.</b>: Destructive</span>
              <span><b>INJECT.</b>: Injection</span>
              <span><b>DRIFT</b>: Goal Drift</span>
              <span><b>LOOP</b>: Tool Loop</span>
              <span><b>WRONG</b>: Wrong Tool</span>
              <span><b>HALLUC.</b>: Hallucination</span>
              <span><b>PREMATURE</b>: Premature</span>
            </div>
          </ChartCard>

        </div>

        {/* ── Severity Heatmap (new) ─────────────────────────────── */}
        <ChartCard title="SEVERITY HEATMAP" subtitle="Failure count per category × severity — deeper color = higher count" className="heatmap-card">
          <SeverityHeatmap rows={heatmapRows} />
        </ChartCard>

        <div className="scorecard-bottom-grid">
          <ChartCard title="SEVERITY DISTRIBUTION">
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={severity} layout="vertical" margin={{left:0,right:25,top:6,bottom:0}}>
                <XAxis type="number" hide/>
                <YAxis type="category" dataKey="name" tick={{fill:'#8B8B9E',fontSize:10}} axisLine={false} tickLine={false} width={70}/>
                <Bar dataKey="count" radius={[0,4,4,0]}>
                  {severity.map(s=><Cell key={s.name} fill={s.color}/>)}
                </Bar>
                <Tooltip cursor={false} contentStyle={{background:'#131320',border:'1px solid rgba(255,255,255,.1)',borderRadius:10}}/>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="OWASP RISK PROFILE" subtitle="LLM Top 10 (2025)">
            <div className="risk-list">
              {owasp.map(item => {
                const Icon = item.icon
                return (
                  <div className="risk-row" key={item.id}>
                    <Icon size={14} color={item.color}/>
                    <span className="risk-id">{item.id}</span>
                    <span className="risk-name">{item.name}</span>
                    <div className="risk-bar"><i style={{width:`${item.count/28*100}%`,background:item.color}}/></div>
                    <b>{item.count}</b>
                    <small>{item.pct}</small>
                  </div>
                )
              })}
            </div>
          </ChartCard>

          <ChartCard title="VERSION COMPARE">
            <div className="selects">
              <label>VERSION A<select value={a} onChange={e=>setA(e.target.value)}>
                {versions.map(x=><option key={x}>{x}</option>)}
              </select></label>
              <span>↔</span>
              <label>VERSION B<select value={b} onChange={e=>setB(e.target.value)}>
                {versions.map(x=><option key={x}>{x}</option>)}
              </select></label>
            </div>
            <div className="delta-list">
              {[
                ['Overall','78.4% vs 67.0%','+11.4% ↑'],
                ['Guardrail',`${agent.guardRailRate}% vs prev`,'+8.3% ↑'],
                ['Critical',`${agent.criticalCount} vs prev`,'-2 ↓'],
                ['New passes','15 scenarios',''],
                ['New failures','3 scenarios',''],
              ].map(([x,y,z])=>(
                <div key={x}>
                  <span>{x}</span>
                  <b>{y}</b>
                  <em className={String(z).startsWith('-') || x==='New passes' ? 'good' : x==='New failures' ? 'bad' : 'good'}>{z}</em>
                </div>
              ))}
            </div>
            <Link className="comparison-link" href="/scorecard">
              <span>Full Comparison</span> <ChevronRight size={14}/>
            </Link>
          </ChartCard>
        </div>

        <section id="runs" className="runs">
          <div className="runs-head" onClick={()=>setExpanded(!expanded)}>
            <div>
              <div className="eyebrow">
                <ChevronDown className={expanded?'rotate':''} size={15}/>
                ALL RUNS <span className="count">{agent.totalRuns} runs</span>
              </div>
            </div>
            <div className="filters" onClick={e=>e.stopPropagation()}>
              {['All','Pass','Fail'].map(x=>(
                <button key={x} className={filter===x?'selected':''} onClick={()=>setFilter(x)}>{x}</button>
              ))}
              <select aria-label="Category"><option>All categories</option><option>Injection</option></select>
              <select aria-label="Severity"><option>All severities</option><option>Critical</option></select>
            </div>
          </div>
          {expanded && <>
            <div className="table-scroll">
              <table>
                <thead><tr>
                  {['RUN ID','SCENARIO','CATEGORY','VERDICT','SEVERITY','OWASP','CONFIDENCE','DURATION',''].map(x=><th key={x}>{x}</th>)}
                </tr></thead>
                <tbody>
                  {filteredRuns.map(r=>(
                    <tr key={r[0]}>
                      {r.map((cell,i)=>(
                        <td key={i} className={
                          i===0?'mono':i===3?'scorecard-verdict '+cell.toLowerCase():
                          i===4?'scorecard-severity '+cell.toLowerCase():i===5?'owasp':''
                        }>{cell}</td>
                      ))}
                      <td><Link href={`/traces/${r[0]}`} aria-label={`Open trace ${r[0]}`}><ChevronRight size={15}/></Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>Showing 1-{filteredRuns.length} of {agent.totalRuns}</span>
              <div>
                <button disabled>Previous</button>
                <button>Next <ChevronRight size={14}/></button>
              </div>
            </div>
          </>}
        </section>
      </div>
    </div>
  )
}
