'use client'

import { useState } from 'react'
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
import { REMEDIATION_PATCHES, type RemediationDiff } from '@/lib/mock-data'

const SEVERITY_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  CRITICAL: { color: '#F43F5E', bg: 'rgba(244,63,94,0.08)', border: 'rgba(244,63,94,0.2)' },
  HIGH:     { color: '#F97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.2)' },
  MEDIUM:   { color: '#FBBF24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)' },
}

// ── Diff rendering ─────────────────────────────────────────
function DiffView({ before, after, filename }: { before: string; after: string; filename: string }) {
  const beforeLines = before.split('\n')
  const afterLines = after.split('\n')

  // Build a simple unified-ish diff: lines only in before are removed, only in after are added
  const beforeSet = new Set(beforeLines)
  const afterSet = new Set(afterLines)

  type DiffLine = { type: 'context' | 'removed' | 'added'; content: string }
  const diffLines: DiffLine[] = []

  const allLines = [...new Set([...beforeLines, ...afterLines])]
  // We'll walk afterLines to show the final result, marking removals and additions
  const removed = beforeLines.filter(l => !afterSet.has(l))
  const added = afterLines.filter(l => !beforeSet.has(l))

  // Interleave: show removed lines where they would appear, then added
  afterLines.forEach(line => {
    if (added.includes(line)) {
      diffLines.push({ type: 'added', content: line })
    } else {
      diffLines.push({ type: 'context', content: line })
    }
  })
  // Insert removed lines before the first added block
  const firstAddedIdx = diffLines.findIndex(l => l.type === 'added')
  const removedEntries: DiffLine[] = removed.map(l => ({ type: 'removed', content: l }))
  if (firstAddedIdx >= 0) {
    diffLines.splice(firstAddedIdx, 0, ...removedEntries)
  } else {
    diffLines.push(...removedEntries)
  }

  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
      {/* File header */}
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
          <span style={{ color: '#34D399' }}>+ {afterLines.filter(l => added.includes(l)).length} additions</span>
          <span style={{ color: '#F43F5E' }}>- {removed.length} deletions</span>
        </div>
      </div>

      {/* Diff body */}
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
                    width: 36,
                    padding: '2px 8px',
                    textAlign: 'right',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: '#3A3A4A',
                    userSelect: 'none',
                    borderRight: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    {i + 1}
                  </td>
                  <td style={{
                    width: 20,
                    padding: '2px 6px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    color: isAdded ? '#34D399' : isRemoved ? '#F43F5E' : '#3A3A4A',
                    userSelect: 'none',
                    borderRight: isAdded || isRemoved ? '2px solid ' + (isAdded ? '#34D399' : '#F43F5E') : '2px solid transparent',
                  }}>
                    {isAdded ? '+' : isRemoved ? '−' : ' '}
                  </td>
                  <td style={{
                    padding: '3px 14px 3px 10px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    lineHeight: 1.6,
                    color: isAdded ? '#A3E8C5' : isRemoved ? '#F9A8B4' : '#8B8B9E',
                    whiteSpace: 'pre',
                  }}>
                    {line.content || ' '}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Verification re-run badge ──────────────────────────────
function VerifyButton({ patch }: { patch: RemediationDiff }) {
  const [state, setState] = useState<'idle' | 'running' | 'done'>('idle')
  const [result, setResult] = useState<{ verdict: string; confidence: number; fixed: number; total: number } | null>(null)

  function run() {
    if (state !== 'idle') return
    setState('running')
    window.setTimeout(() => {
      setState('done')
      setResult({
        verdict: patch.rerunVerdict,
        confidence: patch.rerunConfidence,
        fixed: patch.scenariosFixed,
        total: patch.scenariosTotal,
      })
    }, 1800)
  }

  if (state === 'idle') {
    return (
      <button onClick={run} style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 18px',
        border: '1px solid rgba(34,211,238,0.25)',
        borderRadius: 10,
        background: 'rgba(34,211,238,0.04)',
        color: '#22D3EE',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        transition: '0.2s',
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
        Re-running {patch.scenariosTotal} affected scenarios...
      </div>
    )
  }

  const isPass = result?.verdict === 'PASS'
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 12,
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
          {result?.fixed}/{result?.total} scenarios now pass · {result?.confidence}% confidence
        </div>
      </div>
      <button onClick={() => { setState('idle'); setResult(null) }}
        style={{ marginLeft: 'auto', background: 'none', border: 0, color: '#55556A', cursor: 'pointer' }}>
        <X size={14} />
      </button>
    </div>
  )
}

// ── Single patch card ──────────────────────────────────────
function PatchCard({ patch }: { patch: RemediationDiff }) {
  const [expanded, setExpanded] = useState(false)
  const sev = SEVERITY_STYLES[patch.severity]

  return (
    <article style={{
      border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: 14,
      background: '#0C0C12',
      overflow: 'hidden',
      animation: 'cardEnter 0.5s cubic-bezier(.16,1,.3,1) both',
    }}>
      {/* Card header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: expanded ? '1px solid rgba(255,255,255,0.05)' : 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          {/* Type icon */}
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'rgba(34,211,238,0.08)',
            border: '1px solid rgba(34,211,238,0.15)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}>
            {patch.type === 'system_prompt'
              ? <FileText size={16} style={{ color: '#22D3EE' }} />
              : <Code2 size={16} style={{ color: '#22D3EE' }} />
            }
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Badges row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              <span style={{
                padding: '4px 8px',
                borderRadius: 999,
                fontSize: 9,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: sev.color,
                background: sev.bg,
                border: `1px solid ${sev.border}`,
              }}>
                {patch.severity}
              </span>
              <span style={{
                padding: '4px 8px',
                borderRadius: 999,
                fontSize: 9,
                fontFamily: 'var(--font-mono)',
                color: '#8B5CF6',
                background: 'rgba(139,92,246,0.1)',
                border: '1px solid rgba(139,92,246,0.2)',
              }}>
                {patch.category}
              </span>
              <span style={{
                padding: '4px 8px',
                borderRadius: 999,
                fontSize: 9,
                fontFamily: 'var(--font-mono)',
                color: '#8B8B9E',
                background: 'rgba(255,255,255,0.05)',
              }}>
                {patch.type === 'system_prompt' ? 'SYSTEM PROMPT' : 'TOOL SCHEMA'}
              </span>
            </div>

            <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600, color: '#F0F0F5', lineHeight: 1.3 }}>
              {patch.title}
            </h3>
            <p style={{ margin: 0, fontSize: 12, color: '#8B8B9E', lineHeight: 1.6 }}>
              {patch.description}
            </p>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 20, flexShrink: 0, paddingTop: 4 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#34D399' }}>
                {patch.scenariosFixed}/{patch.scenariosTotal}
              </div>
              <div style={{ fontSize: 9, color: '#55556A', fontFamily: 'var(--font-mono)' }}>FIXED</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#22D3EE' }}>
                +{patch.addedLines}
              </div>
              <div style={{ fontSize: 9, color: '#55556A', fontFamily: 'var(--font-mono)' }}>ADDITIONS</div>
            </div>
          </div>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 16,
            background: 'none',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 8,
            padding: '7px 12px',
            color: '#8B8B9E',
            fontSize: 11,
            cursor: 'pointer',
            transition: '0.2s',
          }}
        >
          <GitCompare size={13} />
          {expanded ? 'Hide diff' : 'View diff'}
          <ChevronDown size={12} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
        </button>
      </div>

      {/* Expanded diff */}
      {expanded && (
        <div style={{ padding: '20px 24px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Wrench size={13} style={{ color: '#55556A' }} />
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#55556A', letterSpacing: '0.1em' }}>
              PROPOSED CHANGE
            </span>
          </div>
          <DiffView before={patch.before} after={patch.after} filename={patch.filename} />

          <div style={{ marginTop: 18 }}>
            <div style={{ marginBottom: 10, fontSize: 10, fontFamily: 'var(--font-mono)', color: '#55556A', letterSpacing: '0.1em' }}>
              VERIFICATION RE-RUN
            </div>
            <VerifyButton patch={patch} />
          </div>
        </div>
      )}
    </article>
  )
}

// ── Page ───────────────────────────────────────────────────
export default function RemediationPage() {
  const { agentId, agent } = useAgent()
  const patches = REMEDIATION_PATCHES[agentId]

  const [filterSev, setFilterSev] = useState<string>('ALL')
  const [filterType, setFilterType] = useState<string>('ALL')

  const filtered = patches.filter(p => {
    const sevOk = filterSev === 'ALL' || p.severity === filterSev
    const typeOk = filterType === 'ALL' || p.type === filterType
    return sevOk && typeOk
  })

  const totalFixed = patches.reduce((a, p) => a + p.scenariosFixed, 0)
  const totalScenarios = patches.reduce((a, p) => a + p.scenariosTotal, 0)

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
            {agent.name} {agent.version} · {patches.length} patches generated from failure analysis
          </p>
        </div>

        {/* Summary stats */}
        <div style={{ display: 'flex', gap: 20, flexShrink: 0 }}>
          {[
            { label: 'PATCHES', value: patches.length, color: '#22D3EE' },
            { label: 'SCENARIOS FIXED', value: `${totalFixed}/${totalScenarios}`, color: '#34D399' },
            { label: 'CRITICAL', value: patches.filter(p => p.severity === 'CRITICAL').length, color: '#F43F5E' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              padding: '14px 20px',
              background: '#0C0C12',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 12,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', color }}>{value}</div>
              <div style={{ fontSize: 9, color: '#55556A', fontFamily: 'var(--font-mono)', marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Info banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 18px',
        marginBottom: 24,
        background: 'rgba(251,191,36,0.05)',
        border: '1px solid rgba(251,191,36,0.15)',
        borderRadius: 10,
        color: '#FBBF24',
        fontSize: 12,
      }}>
        <AlertTriangle size={15} style={{ flexShrink: 0 }} />
        <span>
          These patches are <strong>AI-suggested</strong> and mocked for demo purposes. Click <em>Run Verification</em> on any patch to simulate a re-run of the affected scenarios.
        </span>
      </div>

      {/* Filter bar */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 20,
        padding: '12px 0',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['ALL','CRITICAL','HIGH','MEDIUM'].map(s => (
            <button key={s} onClick={() => setFilterSev(s)} style={{
              padding: '6px 12px',
              borderRadius: 999,
              border: filterSev === s ? '1px solid rgba(34,211,238,0.4)' : '1px solid rgba(255,255,255,0.06)',
              background: filterSev === s ? 'rgba(34,211,238,0.1)' : 'rgba(255,255,255,0.02)',
              color: filterSev === s ? '#22D3EE' : '#8B8B9E',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              transition: '0.2s',
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
              padding: '6px 12px',
              borderRadius: 999,
              border: filterType === val ? '1px solid rgba(34,211,238,0.4)' : '1px solid rgba(255,255,255,0.06)',
              background: filterType === val ? 'rgba(34,211,238,0.1)' : 'rgba(255,255,255,0.02)',
              color: filterType === val ? '#22D3EE' : '#8B8B9E',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              transition: '0.2s',
            }}>{label}</button>
          ))}

        </div>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#55556A', fontFamily: 'var(--font-mono)', alignSelf: 'center' }}>
          {filtered.length} of {patches.length} patches
        </span>
      </div>

      {/* Patch list */}
      {filtered.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filtered.map(patch => <PatchCard key={patch.id} patch={patch} />)}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#55556A' }}>
          <Check size={48} style={{ margin: '0 auto 20px' }} />
          <h2 style={{ color: '#8B8B9E', fontSize: 18, fontWeight: 500 }}>No patches match this filter</h2>
          <p style={{ fontSize: 13 }}>Try adjusting the severity or type filter above.</p>
        </div>
      )}

      {/* Footer nav */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: 48,
        paddingTop: 24,
        borderTop: '1px solid rgba(255,255,255,0.05)',
        color: '#55556A',
        fontSize: 12,
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
