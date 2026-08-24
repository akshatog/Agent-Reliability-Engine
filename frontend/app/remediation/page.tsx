'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  FileText,
  GitCompare,
  Loader2,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Wrench,
  X,
} from 'lucide-react'
import { useAgent } from '@/lib/agent-context'
import { listRuns, suggestRemediation, verifyRemediation, ApiError } from '@/lib/api'
import type { RemediationSuggestion, VerificationResult } from '@/lib/api-types'
import { REMEDIATION_PATCHES } from '@/lib/mock-data'
import { PageErrorBoundary } from '@/components/page-error-boundary'

const SEVERITY_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  CRITICAL: { color: '#F43F5E', bg: 'rgba(244,63,94,0.08)', border: 'rgba(244,63,94,0.2)' },
  HIGH:     { color: '#F97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.2)' },
  MEDIUM:   { color: '#FBBF24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)' },
}

// ── Diff rendering ─────────────────────────────────────────
function DiffView({ before, after, filename }: { before: string; after: string; filename: string }) {
  const beforeLines = before.split('\n')
  const afterLines = after.split('\n')

  const beforeSet = new Set(beforeLines)
  const afterSet = new Set(afterLines)

  type DiffLine = { type: 'context' | 'removed' | 'added'; content: string }
  const diffLines: DiffLine[] = []

  const removed = beforeLines.filter(l => !afterSet.has(l))
  const added = afterLines.filter(l => !beforeSet.has(l))

  afterLines.forEach(line => {
    if (added.includes(line)) {
      diffLines.push({ type: 'added', content: line })
    } else {
      diffLines.push({ type: 'context', content: line })
    }
  })
  const firstAddedIdx = diffLines.findIndex(l => l.type === 'added')
  const removedEntries: DiffLine[] = removed.map(l => ({ type: 'removed', content: l }))
  if (firstAddedIdx >= 0) {
    diffLines.splice(firstAddedIdx, 0, ...removedEntries)
  } else {
    diffLines.push(...removedEntries)
  }

  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 14px',
        background: '#0A0A10',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: '#8B8B9E',
      }}>
        <FileText size={13} style={{ color: '#55556A' }} />
        <span>{filename}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
          <span style={{ color: '#34D399' }}>+ {added.length} additions</span>
          <span style={{ color: '#F43F5E' }}>- {removed.length} deletions</span>
        </div>
      </div>

      <div style={{ background: '#080810', overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 480 }}>
          <tbody>
            {diffLines.map((line, i) => {
              const isAdded = line.type === 'added'
              const isRemoved = line.type === 'removed'
              return (
                <tr key={i} style={{
                  background: isAdded ? 'rgba(52,211,153,0.06)' : isRemoved ? 'rgba(244,63,94,0.06)' : 'transparent',
                }}>
                  <td style={{
                    width: 36, padding: '2px 8px', textAlign: 'right',
                    fontFamily: 'var(--font-mono)', fontSize: 11, color: '#3A3A4A',
                    userSelect: 'none', borderRight: '1px solid rgba(255,255,255,0.04)',
                  }}>{i + 1}</td>
                  <td style={{
                    width: 20, padding: '2px 6px',
                    fontFamily: 'var(--font-mono)', fontSize: 12,
                    color: isAdded ? '#34D399' : isRemoved ? '#F43F5E' : '#3A3A4A',
                    userSelect: 'none',
                    borderRight: isAdded || isRemoved ? '2px solid ' + (isAdded ? '#34D399' : '#F43F5E') : '2px solid transparent',
                  }}>{isAdded ? '+' : isRemoved ? '−' : ' '}</td>
                  <td style={{
                    padding: '3px 14px 3px 10px',
                    fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.6,
                    color: isAdded ? '#A3E8C5' : isRemoved ? '#F9A8B4' : '#8B8B9E',
                    whiteSpace: 'pre',
                  }}>{line.content || ' '}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Verification button — calls real /verify endpoint ──────
function VerifyButton({ suggestion }: { suggestion: RemediationSuggestion }) {
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [errMsg, setErrMsg] = useState('')

  async function run() {
    if (state !== 'idle') return
    setState('running')
    try {
      const r = await verifyRemediation(suggestion.suggestion_id)
      setResult(r)
      setState('done')
    } catch (e) {
      const msg = e instanceof ApiError ? `API ${e.status}` : String(e)
      setErrMsg(msg)
      setState('error')
    }
  }

  if (state === 'idle') {
    return (
      <button onClick={run} style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 18px',
        border: '1px solid rgba(34,211,238,0.25)',
        borderRadius: 10,
        background: 'rgba(34,211,238,0.04)',
        color: '#22D3EE', fontSize: 12, fontWeight: 600,
        cursor: 'pointer', transition: '0.2s',
      }}>
        <RefreshCw size={14} />
        Run Verification
      </button>
    )
  }

  if (state === 'running') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8B8B9E', fontSize: 12, padding: '10px 0' }}>
        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
        Re-running scenario with patched agent config...
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', borderRadius: 10,
        border: '1px solid rgba(244,63,94,0.25)',
        background: 'rgba(244,63,94,0.05)',
        color: '#F43F5E', fontSize: 12,
      }}>
        <AlertTriangle size={14} />
        <span>Verification failed: {errMsg}</span>
        <button onClick={() => { setState('idle'); setErrMsg('') }}
          style={{ marginLeft: 'auto', background: 'none', border: 0, color: '#55556A', cursor: 'pointer' }}>
          <X size={14} />
        </button>
      </div>
    )
  }

  const isPass = result?.verdict === 'PASS'
  const confidencePct = result ? Math.round(result.confidence * 100) : 0
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
      padding: '14px 18px',
      border: `1px solid ${isPass ? 'rgba(52,211,153,0.25)' : 'rgba(244,63,94,0.25)'}`,
      borderRadius: 10,
      background: isPass ? 'rgba(52,211,153,0.05)' : 'rgba(244,63,94,0.05)',
      animation: 'rise 0.3s ease',
    }}>
      {isPass
        ? <ShieldCheck size={18} style={{ color: '#34D399', flexShrink: 0 }} />
        : <ShieldOff size={18} style={{ color: '#F43F5E', flexShrink: 0 }} />
      }
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: isPass ? '#34D399' : '#F43F5E', fontFamily: 'var(--font-mono)' }}>
          {result?.verdict}
        </div>
        <div style={{ fontSize: 11, color: '#8B8B9E', marginTop: 2 }}>
          {confidencePct}% confidence
          {result?.failure_category ? ` · ${result.failure_category}` : ''}
        </div>
        {result?.justification && (
          <div style={{ fontSize: 11, color: '#8B8B9E', marginTop: 4, fontStyle: 'italic' }}>
            {result.justification}
          </div>
        )}
      </div>
      <button onClick={() => { setState('idle'); setResult(null) }}
        style={{ marginLeft: 'auto', background: 'none', border: 0, color: '#55556A', cursor: 'pointer' }}>
        <X size={14} />
      </button>
    </div>
  )
}

// ── Single suggestion card ──────────────────────────────────
function SuggestionCard({ suggestion }: { suggestion: RemediationSuggestion }) {
  const [expanded, setExpanded] = useState(false)
  const sev = SEVERITY_STYLES[suggestion.severity] ?? SEVERITY_STYLES['MEDIUM']

  const beforeLines = suggestion.before.split('\n')
  const afterLines = suggestion.after.split('\n')
  const afterSet = new Set(afterLines)
  const beforeSet = new Set(beforeLines)
  const addedCount = afterLines.filter(l => !beforeSet.has(l)).length

  return (
    <article style={{
      border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: 14,
      background: '#0C0C12',
      overflow: 'hidden',
      animation: 'cardEnter 0.5s cubic-bezier(.16,1,.3,1) both',
    }}>
      <div style={{
        padding: '20px 24px',
        borderBottom: expanded ? '1px solid rgba(255,255,255,0.05)' : 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'rgba(34,211,238,0.08)',
            border: '1px solid rgba(34,211,238,0.15)',
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
            {suggestion.patch_type === 'system_prompt'
              ? <FileText size={16} style={{ color: '#22D3EE' }} />
              : <Code2 size={16} style={{ color: '#22D3EE' }} />
            }
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              <span style={{
                padding: '4px 8px', borderRadius: 999, fontSize: 9,
                fontFamily: 'var(--font-mono)', fontWeight: 700,
                color: sev.color, background: sev.bg, border: `1px solid ${sev.border}`,
              }}>{suggestion.severity}</span>
              <span style={{
                padding: '4px 8px', borderRadius: 999, fontSize: 9,
                fontFamily: 'var(--font-mono)',
                color: '#8B5CF6', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
              }}>{suggestion.category}</span>
              <span style={{
                padding: '4px 8px', borderRadius: 999, fontSize: 9,
                fontFamily: 'var(--font-mono)',
                color: '#8B8B9E', background: 'rgba(255,255,255,0.05)',
              }}>{suggestion.patch_type === 'system_prompt' ? 'SYSTEM PROMPT' : 'TOOL SCHEMA'}</span>
            </div>

            <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600, color: '#F0F0F5', lineHeight: 1.3 }}>
              {suggestion.title}
            </h3>
            <p style={{ margin: 0, fontSize: 12, color: '#8B8B9E', lineHeight: 1.6 }}>
              {suggestion.description}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 20, flexShrink: 0, paddingTop: 4 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#22D3EE' }}>
                +{addedCount}
              </div>
              <div style={{ fontSize: 9, color: '#55556A', fontFamily: 'var(--font-mono)' }}>ADDITIONS</div>
            </div>
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, marginTop: 16,
            background: 'none', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 8, padding: '7px 12px',
            color: '#8B8B9E', fontSize: 11, cursor: 'pointer', transition: '0.2s',
          }}
        >
          <GitCompare size={13} />
          {expanded ? 'Hide diff' : 'View diff'}
          <ChevronDown size={12} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
        </button>
      </div>

      {expanded && (
        <div style={{ padding: '20px 24px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Wrench size={13} style={{ color: '#55556A' }} />
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#55556A', letterSpacing: '0.1em' }}>
              PROPOSED CHANGE
            </span>
          </div>
          <DiffView before={suggestion.before} after={suggestion.after} filename={suggestion.filename} />

          <div style={{ marginTop: 18 }}>
            <div style={{ marginBottom: 10, fontSize: 10, fontFamily: 'var(--font-mono)', color: '#55556A', letterSpacing: '0.1em' }}>
              VERIFICATION RE-RUN
            </div>
            <VerifyButton suggestion={suggestion} />
          </div>
        </div>
      )}
    </article>
  )
}

// ── Loading skeleton ────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{
      border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14,
      background: '#0C0C12', padding: '20px 24px', animation: 'pulse 1.5s ease infinite',
    }}>
      <div style={{ display: 'flex', gap: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 12, width: '40%', background: 'rgba(255,255,255,0.04)', borderRadius: 4, marginBottom: 12 }} />
          <div style={{ height: 16, width: '70%', background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginBottom: 8 }} />
          <div style={{ height: 12, width: '90%', background: 'rgba(255,255,255,0.03)', borderRadius: 4 }} />
        </div>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────

export default function RemediationPage() {
  return (
    <PageErrorBoundary pageName="Remediation Engine">
      <RemediationPageInner />
    </PageErrorBoundary>
  )
}

function RemediationPageInner() {
  const { agentId, agent, activeVersionId } = useAgent()

  const [suggestions, setSuggestions] = useState<RemediationSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [suggestingRunId, setSuggestingRunId] = useState<string | null>(null)
  const [usingMock, setUsingMock] = useState(false)
  const [filterSev, setFilterSev] = useState<string>('ALL')
  const [filterType, setFilterType] = useState<string>('ALL')

  // Track which run we last generated suggestions for, to avoid re-triggering
  const lastRunIdRef = useRef<string | null>(null)

  // On mount / agent change: fetch the most recent FAILED run and generate a suggestion
  useEffect(() => {
    if (!activeVersionId) return
    const controller = new AbortController()

    async function loadSuggestions() {
      setLoading(true)
      setSuggestions([])
      setUsingMock(false)

      try {
        // 1. Get all runs for this agent version
        if (!activeVersionId) throw new ApiError(400, null, 'No agent version selected')
        const runs = await listRuns(activeVersionId, controller.signal)

        // 2. Find the most recent run (backend returns newest-first)
        if (runs.length === 0) {
          // No runs yet — fall back to mock data
          throw new ApiError(404, null, 'No runs found')
        }

        // Try runs newest-first until we get a suggestion
        let generated: RemediationSuggestion | null = null
        for (const run of runs) {
          if (lastRunIdRef.current === run.id) {
            // Already have a suggestion for this run — reuse
            break
          }
          try {
            const s = await suggestRemediation(run.id, controller.signal)
            generated = s
            lastRunIdRef.current = run.id
            break
          } catch {
            // This run may be PASS or unclassified — try next
            continue
          }
        }

        if (generated) {
          setSuggestions([generated])
        } else {
          throw new ApiError(422, null, 'No failed+classified runs found')
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        // Mock fallback
        setUsingMock(true)
        const mockPatches = REMEDIATION_PATCHES[agentId] ?? []
        const converted: RemediationSuggestion[] = mockPatches.map(p => ({
          suggestion_id: p.id,
          run_id: 'mock-run-id',
          category: p.category,
          severity: p.severity,
          title: p.title,
          description: p.description,
          patch_type: p.type,
          before: p.before,
          after: p.after,
          filename: p.filename,
        }))
        setSuggestions(converted)
      } finally {
        setLoading(false)
      }
    }

    loadSuggestions()
    return () => controller.abort()
  }, [activeVersionId, agentId])

  const filtered = suggestions.filter(s => {
    const sevOk = filterSev === 'ALL' || s.severity === filterSev
    const typeOk = filterType === 'ALL' || s.patch_type === filterType
    return sevOk && typeOk
  })

  return (
    <div style={{ maxWidth: 1200, margin: 'auto', padding: '40px 32px 80px', animation: 'pageIn 0.5s ease both' }}>

      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32, gap: 24 }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 14 }}>
            <GitCompare size={12} style={{ display: 'inline', marginRight: 7 }} />
            AUTO-REMEDIATION / DIFF VIEW
          </p>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 600, letterSpacing: '-0.03em', color: '#F0F0F5' }}>
            Suggested Patches
          </h1>
          <p style={{ margin: '8px 0 0', color: '#8B8B9E', fontSize: 14 }}>
            {agent.name} {agent.version} · {loading ? '...' : `${suggestions.length} patches generated from failure analysis`}
            {usingMock && <span style={{ color: '#FBBF24', marginLeft: 8, fontSize: 11 }}>(demo data)</span>}
          </p>
        </div>

        {/* Summary stats */}
        {!loading && (
          <div style={{ display: 'flex', gap: 20, flexShrink: 0 }}>
            {[
              { label: 'PATCHES', value: suggestions.length, color: '#22D3EE' },
              { label: 'CRITICAL', value: suggestions.filter(s => s.severity === 'CRITICAL').length, color: '#F43F5E' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                padding: '14px 20px', background: '#0C0C12',
                border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, textAlign: 'center',
              }}>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', color }}>{value}</div>
                <div style={{ fontSize: 9, color: '#55556A', fontFamily: 'var(--font-mono)', marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info banner */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px',
        marginBottom: 24,
        background: usingMock ? 'rgba(251,191,36,0.05)' : 'rgba(34,211,238,0.05)',
        border: `1px solid ${usingMock ? 'rgba(251,191,36,0.15)' : 'rgba(34,211,238,0.15)'}`,
        borderRadius: 10,
        color: usingMock ? '#FBBF24' : '#22D3EE',
        fontSize: 12,
      }}>
        <AlertTriangle size={15} style={{ flexShrink: 0 }} />
        <span>
          {usingMock
            ? <>These patches are <strong>AI-suggested (demo mode)</strong>. Backend returned no failed+classified runs. Click <em>Run Verification</em> on any patch to simulate a re-run.</>
            : <>These patches are <strong>AI-generated</strong> from real failure analysis. Click <em>Run Verification</em> to re-run the scenario with the patch applied against the real pipeline.</>
          }
        </span>
      </div>

      {/* Filter bar */}
      {!loading && suggestions.length > 0 && (
        <div style={{
          display: 'flex', gap: 8, marginBottom: 20,
          padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'].map(s => (
              <button key={s} onClick={() => setFilterSev(s)} style={{
                padding: '6px 12px', borderRadius: 999,
                border: filterSev === s ? '1px solid rgba(34,211,238,0.4)' : '1px solid rgba(255,255,255,0.06)',
                background: filterSev === s ? 'rgba(34,211,238,0.1)' : 'rgba(255,255,255,0.02)',
                color: filterSev === s ? '#22D3EE' : '#8B8B9E',
                fontSize: 10, fontFamily: 'var(--font-mono)', cursor: 'pointer', transition: '0.2s',
              }}>{s}</button>
            ))}
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.06)', margin: '0 4px' }} />
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { val: 'ALL', label: 'ALL TYPES' },
              { val: 'system_prompt', label: 'SYSTEM PROMPT' },
              { val: 'tool_schema', label: 'TOOL SCHEMA' },
            ].map(({ val, label }) => (
              <button key={val} onClick={() => setFilterType(val)} style={{
                padding: '6px 12px', borderRadius: 999,
                border: filterType === val ? '1px solid rgba(34,211,238,0.4)' : '1px solid rgba(255,255,255,0.06)',
                background: filterType === val ? 'rgba(34,211,238,0.1)' : 'rgba(255,255,255,0.02)',
                color: filterType === val ? '#22D3EE' : '#8B8B9E',
                fontSize: 10, fontFamily: 'var(--font-mono)', cursor: 'pointer', transition: '0.2s',
              }}>{label}</button>
            ))}
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: '#55556A', fontFamily: 'var(--font-mono)', alignSelf: 'center' }}>
            {filtered.length} of {suggestions.length} patches
          </span>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Suggestion list */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filtered.map(s => <SuggestionCard key={s.suggestion_id} suggestion={s} />)}
        </div>
      )}

      {!loading && filtered.length === 0 && suggestions.length > 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#55556A' }}>
          <Check size={48} style={{ margin: '0 auto 20px' }} />
          <h2 style={{ color: '#8B8B9E', fontSize: 18, fontWeight: 500 }}>No patches match this filter</h2>
          <p style={{ fontSize: 13 }}>Try adjusting the severity or type filter above.</p>
        </div>
      )}

      {!loading && suggestions.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#55556A' }}>
          <Check size={48} style={{ margin: '0 auto 20px' }} />
          <h2 style={{ color: '#8B8B9E', fontSize: 18, fontWeight: 500 }}>No patches available</h2>
          <p style={{ fontSize: 13 }}>Run some scenarios and classify them first, then come back here.</p>
        </div>
      )}

      {/* Footer nav */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', marginTop: 48,
        paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.05)',
        color: '#55556A', fontSize: 12,
      }}>
        <Link href="/scorecard" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#22D3EE', textDecoration: 'none' }}>
          ← Back to Scorecard
        </Link>
        <Link href="/report" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#22D3EE', textDecoration: 'none' }}>
          View Full Report <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  )
}
