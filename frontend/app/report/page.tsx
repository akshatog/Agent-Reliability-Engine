'use client'

import { useState } from 'react'
import { Copy, Download, ExternalLink, Link2, Minus, Printer, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react'
import { useAgent } from '@/lib/agent-context'
import { CATEGORY_BREAKDOWN, CRITICAL_FAILURES, OWASP_RISKS, type CategoryRow } from '@/lib/mock-data'

function ReportHeader({ agentName, version }: { agentName: string; version: string }) {
  return <header className="report-banner"><div><p className="report-kicker">ARE / SECURITY ASSESSMENT</p><h1>Agent Reliability Report</h1><div className="report-meta"><b>{agentName}</b><span>Version {version}</span><span>Generated August 22, 2026 at 3:45 PM IST</span></div><p className="report-config">127 scenarios <i/> 847 runs <i/> 7 failure categories</p></div><div className="report-actions"><button onClick={() => window.print()}><Printer size={14}/> Print Report</button><button><Download size={14}/> Export PDF</button><button><Link2 size={14}/> Copy Badge URL</button></div></header>
}

function BadgeSection({ score, grade, agentName, version }: { score: number; grade: string; agentName: string; version: string }) {
  const [copied, setCopied] = useState(false)
  const slug = `${agentName.toLowerCase().replace(/\s+/g,'-')}-${version}`
  const code = `![Reliability](https://api.example.com/badge/${slug}.svg)`
  return <section className="badge-section"><div className="badge-preview"><span>Agent Reliability</span><b>{grade} <small>({score}%)</small></b></div><div className="embed-code"><code>{code}</code><button aria-label="Copy embed code" onClick={() => { navigator.clipboard?.writeText(code); setCopied(true) }}><Copy size={13}/>{copied ? 'Copied' : 'Copy'}</button></div></section>
}

function KPI({ label, value, detail, tone, ring }: { label: string; value: string; detail: string; tone: string; ring?: boolean }) {
  return <div className="report-kpi"><span className="kpi-label">{label}</span><div className={`kpi-value ${tone}`}>{ring && <span className="mini-ring"><i/></span>}{value}</div><small>{detail}</small></div>
}

function ExecutiveSummary({ score, grade, guardRailRate, criticalCount, highCount, totalRuns, agentName }: {
  score: number; grade: string; guardRailRate: number; criticalCount: number; highCount: number; totalRuns: number; agentName: string
}) {
  return <section className="report-card"><div className="report-section-title"><span>01</span><div><h2>Executive Summary</h2><p>Assessment outcome for production version</p></div></div><div className="kpi-grid"><KPI label="OVERALL SCORE" value={`${score}%`} detail={`Grade ${grade}`} tone="cyan" ring/><KPI label="SCENARIOS TESTED" value={String(totalRuns)} detail="Total runs completed" tone=""/><KPI label="GUARDRAIL HOLD RATE" value={`${guardRailRate}%`} detail="Rule verification pass" tone="green"/><KPI label="CRITICAL ISSUES" value={String(criticalCount)} detail={`${criticalCount} critical · ${highCount} high`} tone="rose"/></div><p className="summary-text">{agentName} demonstrates a reliability score of {score}% with {guardRailRate}% guardrail hold rate. {criticalCount} critical failures require immediate remediation before next release.</p></section>
}

function CategoryTable({ categories }: { categories: CategoryRow[] }) {
  return <section className="report-card"><div className="report-section-title"><span>02</span><div><h2>Score Breakdown by Category</h2><p>Pass rates compared with the previous agent version</p></div></div><div className="category-table"><div className="category-head"><span>Category</span><span>Pass rate</span><span>Failures</span><span>Severity</span><span>OWASP</span><span>Trend</span></div>{categories.map(([name, rate, fail, sev, owasp, trendDir]) => {
    const num = parseInt(rate.replace('%', ''), 10) || 0
    const barColor = num >= 85 ? '#34D399' : num >= 70 ? '#FBBF24' : '#F43F5E'
    return <div className={`category-row ${sev === 'CRITICAL' ? 'worst' : ''}`} key={name}><b>{name}</b><div className="rate-cell"><div><i style={{ width: rate, background: barColor }} /></div><span>{rate}</span></div><span className="mono">{fail}</span><span className={`severity-tag ${sev.toLowerCase()}`}>{sev}</span><span className="owasp-tag">{owasp}</span><span className={`trend ${trendDir}`}>{trendDir === 'up' ? <TrendingUp size={14}/> : trendDir === 'down' ? <TrendingDown size={14}/> : <Minus size={14}/>} {trendDir === 'up' ? 'improved' : trendDir === 'down' ? 'regressed' : 'unchanged'}</span></div>
  })}</div></section>
}



function CriticalFailures({ failures }: { failures: { quote: string; category: string; owasp: string; trace: string }[] }) {
  return <section className="report-card"><div className="report-section-title"><span>03</span><div><h2>Top 3 Critical Failures</h2><p>Highest-impact scenarios requiring remediation</p></div></div><div className="failure-grid">{failures.map(({ quote, category, owasp, trace }, i) => <article className="failure-card" key={quote}><div className="failure-top"><span>0{i + 1}</span><em>CRITICAL</em></div><blockquote>{quote}</blockquote><div className="failure-tags"><span>{category}</span><span>{owasp}</span></div><p className="trace-excerpt"><ShieldCheck size={13}/>{trace}</p><button>View Full Trace <ExternalLink size={12}/></button></article>)}</div></section>
}

function ChartsSection({ trendPoints }: { trendPoints: string[] }) {
  return <div className="report-two-col">
    <section className="report-card"><div className="report-section-title"><span>04</span><div><h2>Version Trend</h2><p>Reliability score across releases</p></div></div><div className="version-chart"><div className="chart-lines"><i/><i/><i/><i/></div><svg viewBox="0 0 420 150" preserveAspectRatio="none"><polyline points="10,115 90,102 170,88 250,70 330,55 410,28" fill="none" stroke="var(--cyan)" strokeWidth="3"/><polyline points="10,115 90,102 170,88 250,70 330,55 410,28 410,150 10,150" fill="url(#reportArea)"/><defs><linearGradient id="reportArea" x2="0" y2="1"><stop stopColor="#22d3ee" stopOpacity=".2"/><stop offset="1" stopColor="#22d3ee" stopOpacity="0"/></linearGradient></defs>{[[10,115],[90,102],[170,88],[250,70],[330,55],[410,28]].map(([x,y]) => <circle key={x} cx={x} cy={y} r={x === 410 ? 5 : 3} fill="var(--cyan)" stroke="#111116" strokeWidth="2"/>)}</svg><div className="chart-labels">{trendPoints.map((t, i) => <span key={i} style={i === trendPoints.length - 1 ? { color: 'var(--cyan)' } : {}}>{t}</span>)}</div></div></section>
    <section className="report-card"><div className="report-section-title"><span>05</span><div><h2>OWASP Risk Summary</h2><p>Failures mapped to risk categories</p></div></div><div className="risk-summary">{/* rendered by parent via owaspData */}</div></section>
  </div>
}

export default function ReportPage() {
  const { agentId, agent } = useAgent()
  const categories = CATEGORY_BREAKDOWN[agentId]
  const failures = CRITICAL_FAILURES[agentId]
  const owaspData = OWASP_RISKS[agentId]

  const trendPoints = ['v1.0 · 61%', 'v1.3 · 67%', 'v2.0 · 71%', `${agent.version} · ${agent.score}%`]

  return <main className="report-page">
    <ReportHeader agentName={agent.name} version={agent.version}/>
    <BadgeSection score={agent.score} grade={agent.grade} agentName={agent.name} version={agent.version}/>
    <ExecutiveSummary
      score={agent.score} grade={agent.grade} guardRailRate={agent.guardRailRate}
      criticalCount={agent.criticalCount} highCount={agent.highCount}
      totalRuns={agent.totalRuns} agentName={agent.name}
    />
    <CategoryTable categories={categories}/>
    <CriticalFailures failures={failures}/>
    <div className="report-two-col">
      <section className="report-card"><div className="report-section-title"><span>04</span><div><h2>Version Trend</h2><p>Reliability score across releases</p></div></div><div className="version-chart"><div className="chart-lines"><i/><i/><i/><i/></div><svg viewBox="0 0 420 150" preserveAspectRatio="none"><polyline points="10,115 90,102 170,88 250,70 330,55 410,28" fill="none" stroke="var(--cyan)" strokeWidth="3"/><polyline points="10,115 90,102 170,88 250,70 330,55 410,28 410,150 10,150" fill="url(#reportArea)"/><defs><linearGradient id="reportArea" x2="0" y2="1"><stop stopColor="#22d3ee" stopOpacity=".2"/><stop offset="1" stopColor="#22d3ee" stopOpacity="0"/></linearGradient></defs>{[[10,115],[90,102],[170,88],[250,70],[330,55],[410,28]].map(([x,y]) => <circle key={x} cx={x} cy={y} r={x === 410 ? 5 : 3} fill="var(--cyan)" stroke="#111116" strokeWidth="2"/>)}</svg><div className="chart-labels">{trendPoints.map((t,i)=><span key={i} style={i===trendPoints.length-1?{color:'var(--cyan)'}:{}}>{t}</span>)}</div></div></section>
      <section className="report-card"><div className="report-section-title"><span>05</span><div><h2>OWASP Risk Summary</h2><p>Failures mapped to risk categories</p></div></div><div className="risk-summary">{owaspData.map(([code, name, count, _color]) => <div className="risk-item" key={code}><div className="risk-name-report"><b>{code}</b><span>{String(name)}</span><strong>{count}</strong></div><div className="risk-bar-report"><i style={{ width: `${Number(count) * 1.8}%` }}/></div></div>)}</div></section>
    </div>
    <footer className="report-footer"><b>Generated by Agent Reliability Engine v1.0</b><span>Methodology: Adversarial scenario generation → Sandboxed execution → LLM-as-judge classification → Rule-based guardrail verification</span><span>ARE · 22 AUG 2026 · INTERNAL SECURITY DOCUMENT</span></footer>
  </main>
}
