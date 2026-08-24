'use client'

import { useState, useEffect } from 'react'
import { Copy, Download, ExternalLink, Link2, Loader2, Minus, Printer, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react'
import { useAgent } from '@/lib/agent-context'
import { getReport, getBadgeUrl, ApiError } from '@/lib/api'
import type { ReportRead } from '@/lib/api-types'
import { CATEGORY_BREAKDOWN, CRITICAL_FAILURES, OWASP_RISKS } from '@/lib/mock-data'

// ── Header ──────────────────────────────────────────────────
function ReportHeader({ agentName, testDate }: { agentName: string; testDate: string }) {
  const dateStr = testDate
    ? new Date(testDate).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })
    : 'Loading...'
  return (
    <header className="report-banner">
      <div>
        <p className="report-kicker">ARE / SECURITY ASSESSMENT</p>
        <h1>Agent Reliability Report</h1>
        <div className="report-meta">
          <b>{agentName}</b>
          <span>Generated {dateStr}</span>
        </div>
      </div>
      <div className="report-actions">
        <button onClick={() => window.print()}><Printer size={14}/> Print Report</button>
        <button><Download size={14}/> Export PDF</button>
      </div>
    </header>
  )
}

// ── Badge section ────────────────────────────────────────────
function BadgeSection({
  score,
  grade,
  badgeUrl,
}: { score: number; grade: string; badgeUrl: string }) {
  const [copied, setCopied] = useState(false)
  const embedCode = `![Reliability](${badgeUrl})`
  return (
    <section className="badge-section">
      <div className="badge-preview">
        <span>Agent Reliability</span>
        <b>{grade} <small>({score.toFixed(1)}%)</small></b>
      </div>
      {/* Live SVG badge */}
      <div style={{ margin: '10px 0' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={badgeUrl} alt="Reliability badge" style={{ height: 28 }} />
      </div>
      <div className="embed-code">
        <code>{embedCode}</code>
        <button aria-label="Copy embed code" onClick={() => {
          navigator.clipboard?.writeText(embedCode)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        }}>
          <Copy size={13}/>{copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </section>
  )
}

// ── KPI tile ─────────────────────────────────────────────────
function KPI({ label, value, detail, tone, ring }: {
  label: string; value: string; detail: string; tone: string; ring?: boolean
}) {
  return (
    <div className="report-kpi">
      <span className="kpi-label">{label}</span>
      <div className={`kpi-value ${tone}`}>{ring && <span className="mini-ring"><i/></span>}{value}</div>
      <small>{detail}</small>
    </div>
  )
}

// ── Executive summary ─────────────────────────────────────────
function ExecutiveSummary({ report }: { report: ReportRead }) {
  const { overall_reliability_score: score, letter_grade: grade, guardrail_hold_rate,
    severity_distribution, total_runs, agent_name } = report
  const criticalCount = severity_distribution['CRITICAL'] ?? 0
  const highCount = severity_distribution['HIGH'] ?? 0

  return (
    <section className="report-card">
      <div className="report-section-title">
        <span>01</span>
        <div><h2>Executive Summary</h2><p>Assessment outcome for production version</p></div>
      </div>
      <div className="kpi-grid">
        <KPI label="OVERALL SCORE" value={`${score.toFixed(1)}%`} detail={`Grade ${grade}`} tone="cyan" ring/>
        <KPI label="SCENARIOS TESTED" value={String(total_runs)} detail="Total runs completed" tone=""/>
        <KPI label="GUARDRAIL HOLD RATE" value={`${guardrail_hold_rate.toFixed(1)}%`} detail="Rule verification pass" tone="green"/>
        <KPI label="CRITICAL ISSUES" value={String(criticalCount)} detail={`${criticalCount} critical · ${highCount} high`} tone="rose"/>
      </div>
      <p className="summary-text">
        {agent_name} demonstrates a reliability score of {score.toFixed(1)}% with {guardrail_hold_rate.toFixed(1)}% guardrail hold rate.
        {criticalCount > 0
          ? ` ${criticalCount} critical failure${criticalCount > 1 ? 's' : ''} require immediate remediation before next release.`
          : ' No critical failures detected in this assessment period.'}
      </p>
    </section>
  )
}

// ── Category breakdown table (from real per_category_breakdown) ──
function CategoryTable({ report }: { report: ReportRead }) {
  const entries = Object.entries(report.per_category_breakdown)
  if (entries.length === 0) return null

  return (
    <section className="report-card">
      <div className="report-section-title">
        <span>02</span>
        <div><h2>Score Breakdown by Category</h2><p>Failure counts across all 7 categories</p></div>
      </div>
      <div className="category-table">
        <div className="category-head">
          <span>Category</span>
          <span>Failures</span>
          <span>OWASP</span>
        </div>
        {entries.map(([name, data]) => {
          const failCount = data.fail_count ?? 0
          const owasp = data.owasp ?? '—'
          return (
            <div className={`category-row ${failCount > 2 ? 'worst' : ''}`} key={name}>
              <b>{name.replace(/_/g, ' ')}</b>
              <span className="mono">{failCount}</span>
              <span className="owasp-tag">{owasp}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── Top failures from real top_failures list ──────────────────
function TopFailures({ report }: { report: ReportRead }) {
  const { top_failures } = report
  if (!top_failures || top_failures.length === 0) return null

  return (
    <section className="report-card">
      <div className="report-section-title">
        <span>03</span>
        <div><h2>Top {top_failures.length} Critical Failures</h2><p>Highest-impact scenarios requiring remediation</p></div>
      </div>
      <div className="failure-grid">
        {top_failures.map((f, i) => (
          <article className="failure-card" key={f.run_id}>
            <div className="failure-top">
              <span>0{i + 1}</span>
              <em>{f.severity ?? 'UNKNOWN'}</em>
            </div>
            <blockquote>{f.justification}</blockquote>
            <div className="failure-tags">
              <span>{f.failure_category?.replace(/_/g, ' ') ?? '—'}</span>
              {f.owasp_mapping && <span>{f.owasp_mapping}</span>}
            </div>
            <p className="trace-excerpt">
              <ShieldCheck size={13}/>
              Run ID: {f.run_id.slice(0, 8)}...
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}

// ── OWASP risk section from real owasp_risk_profile ────────────
function OWASPSection({ report }: { report: ReportRead }) {
  const entries = Object.entries(report.owasp_risk_profile)
  if (entries.length === 0) return (
    <section className="report-card">
      <div className="report-section-title">
        <span>05</span>
        <div><h2>OWASP Risk Summary</h2><p>Failures mapped to risk categories</p></div>
      </div>
      <div style={{ color: '#55556A', fontSize: 13, padding: '20px 0' }}>No OWASP risk data yet — run some scenarios first.</div>
    </section>
  )

  const maxCount = Math.max(...entries.map(([, c]) => c), 1)

  return (
    <section className="report-card">
      <div className="report-section-title">
        <span>05</span>
        <div><h2>OWASP Risk Summary</h2><p>Failures mapped to risk categories</p></div>
      </div>
      <div className="risk-summary">
        {entries.sort((a, b) => b[1] - a[1]).map(([code, count]) => (
          <div className="risk-item" key={code}>
            <div className="risk-name-report">
              <b>{code}</b>
              <strong>{count}</strong>
            </div>
            <div className="risk-bar-report">
              <i style={{ width: `${(count / maxCount) * 100}%` }}/>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Loading skeleton ──────────────────────────────────────────
function ReportSkeleton() {
  return (
    <main className="report-page" style={{ animation: 'pulse 1.5s ease infinite' }}>
      <div style={{ height: 120, background: 'rgba(255,255,255,0.04)', borderRadius: 12, margin: '24px 0' }} />
      <div style={{ height: 80, background: 'rgba(255,255,255,0.03)', borderRadius: 12, margin: '16px 0' }} />
      <div style={{ height: 200, background: 'rgba(255,255,255,0.03)', borderRadius: 12, margin: '16px 0' }} />
    </main>
  )
}

// ── Page ──────────────────────────────────────────────────────
export default function ReportPage() {
  const { agentId, agent, activeVersionId } = useAgent()

  const [report, setReport] = useState<ReportRead | null>(null)
  const [loading, setLoading] = useState(true)
  const [usingMock, setUsingMock] = useState(false)

  useEffect(() => {
    if (!activeVersionId) return
    const controller = new AbortController()
    setLoading(true)
    setReport(null)
    setUsingMock(false)

    getReport(activeVersionId, controller.signal)
      .then(r => { setReport(r); setLoading(false) })
      .catch(err => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        // Fallback: build a mock ReportRead from legacy agent data
        setUsingMock(true)
        const mockCategories = CATEGORY_BREAKDOWN[agentId] ?? []
        const mockFailures = CRITICAL_FAILURES[agentId] ?? []
        const mockOwasp = OWASP_RISKS[agentId] ?? []

        const perCategory: Record<string, { fail_count: number; owasp: string }> = {}
        mockCategories.forEach(([name, , failStr, , owaspCode]) => {
          perCategory[String(name)] = { fail_count: parseInt(String(failStr)) || 0, owasp: String(owaspCode) }
        })

        const owaspProfile: Record<string, number> = {}
        mockOwasp.forEach(([code, , count]) => {
          owaspProfile[String(code)] = Number(count)
        })

        const mockReport: ReportRead = {
          agent_version_id: activeVersionId,
          agent_name: agent.name,
          agent_description: null,
          system_prompt: '',
          test_date: new Date().toISOString(),
          overall_reliability_score: agent.score,
          letter_grade: agent.grade,
          total_runs: agent.totalRuns,
          passes: Math.round(agent.totalRuns * agent.score / 100),
          failures: agent.totalRuns - Math.round(agent.totalRuns * agent.score / 100),
          per_category_breakdown: perCategory,
          guardrail_hold_rate: agent.guardRailRate,
          severity_distribution: {
            CRITICAL: agent.criticalCount,
            HIGH: agent.highCount,
            MEDIUM: 0, LOW: 0,
          },
          owasp_risk_profile: owaspProfile,
          confidence_interval: [agent.score / 100 - 0.05, agent.score / 100 + 0.05],
          flaky_scenarios: [],
          top_failures: mockFailures.map((f, i) => ({
            run_id: `mock-run-${i}`,
            failure_category: f.category,
            severity: 'CRITICAL',
            justification: f.quote,
            owasp_mapping: f.owasp,
          })),
        }
        setReport(mockReport)
        setLoading(false)
      })

    return () => controller.abort()
  }, [activeVersionId, agentId, agent])

  if (loading) return <ReportSkeleton />
  if (!report) return (
    <main className="report-page">
      <div style={{ padding: '80px 0', textAlign: 'center', color: '#55556A' }}>
        Select an agent version to view the report.
      </div>
    </main>
  )

  const badgeUrl = activeVersionId ? getBadgeUrl(activeVersionId) : ''

  return (
    <main className="report-page">
      {usingMock && (
        <div style={{
          margin: '0 0 16px',
          padding: '10px 16px',
          background: 'rgba(251,191,36,0.05)',
          border: '1px solid rgba(251,191,36,0.15)',
          borderRadius: 8,
          color: '#FBBF24', fontSize: 12,
        }}>
          ⚠ Demo data — backend returned no report for this agent version yet. Run some scenarios to populate real data.
        </div>
      )}

      <ReportHeader agentName={report.agent_name} testDate={report.test_date} />
      <BadgeSection
        score={report.overall_reliability_score}
        grade={report.letter_grade}
        badgeUrl={badgeUrl}
      />
      <ExecutiveSummary report={report} />
      <CategoryTable report={report} />
      <TopFailures report={report} />

      <div className="report-two-col">
        <section className="report-card">
          <div className="report-section-title">
            <span>04</span>
            <div><h2>Version Trend</h2><p>Reliability score across releases</p></div>
          </div>
          <div className="version-chart">
            <div className="chart-lines"><i/><i/><i/><i/></div>
            <svg viewBox="0 0 420 150" preserveAspectRatio="none">
              <polyline points="10,115 90,102 170,88 250,70 330,55 410,28" fill="none" stroke="var(--cyan)" strokeWidth="3"/>
              <polyline points="10,115 90,102 170,88 250,70 330,55 410,28 410,150 10,150" fill="url(#reportArea)"/>
              <defs>
                <linearGradient id="reportArea" x2="0" y2="1">
                  <stop stopColor="#22d3ee" stopOpacity=".2"/>
                  <stop offset="1" stopColor="#22d3ee" stopOpacity="0"/>
                </linearGradient>
              </defs>
              {([[10,115],[90,102],[170,88],[250,70],[330,55],[410,28]] as [number,number][]).map(([x,y]) =>
                <circle key={x} cx={x} cy={y} r={x === 410 ? 5 : 3} fill="var(--cyan)" stroke="#111116" strokeWidth="2"/>
              )}
            </svg>
            <div className="chart-labels">
              <span>v1.0</span><span>v1.3</span><span>v2.0</span>
              <span style={{ color: 'var(--cyan)' }}>current · {report.overall_reliability_score.toFixed(1)}%</span>
            </div>
          </div>
        </section>

        <OWASPSection report={report} />
      </div>

      <footer className="report-footer">
        <b>Generated by Agent Reliability Engine v1.0</b>
        <span>Methodology: Adversarial scenario generation → Sandboxed execution → LLM-as-judge classification → Rule-based guardrail verification</span>
        <span>ARE · {new Date(report.test_date).toLocaleDateString('en-IN')} · INTERNAL SECURITY DOCUMENT</span>
      </footer>
    </main>
  )
}
