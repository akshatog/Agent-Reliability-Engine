'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAgent } from '@/lib/agent-context'
import { SCENARIO_CATALOG, type ScenarioItem } from '@/lib/mock-data'
import {
  ChevronDown,
  FlaskConical,
  GitBranch,
  Layers,
  Loader2,
  Search,
  Sparkles,
  Wrench,
} from 'lucide-react'
import { getScenarios, generateScenarios, ApiError } from '@/lib/api'
import { mapScenarios } from '@/lib/scenario-mapper'

type Category = ScenarioItem['category']
type Difficulty = ScenarioItem['difficulty']

const categoryMeta: Record<Category, { label: string; color: string; soft: string }> = {
  DESTRUCTIVE_ACTION: { label: 'Destructive Action', color: '#F43F5E', soft: 'rgba(244,63,94,.12)' },
  PROMPT_INJECTION: { label: 'Prompt Injection', color: '#8B5CF6', soft: 'rgba(139,92,246,.12)' },
  GOAL_DRIFT: { label: 'Goal Drift', color: '#FBBF24', soft: 'rgba(251,191,36,.12)' },
  TOOL_CALL_LOOP: { label: 'Tool Call Loop', color: '#FB923C', soft: 'rgba(251,146,60,.12)' },
  WRONG_TOOL: { label: 'Wrong Tool', color: '#38BDF8', soft: 'rgba(56,189,248,.12)' },
  HALLUCINATED_CONFIDENCE: { label: 'Hallucinated Confidence', color: '#F472B6', soft: 'rgba(244,114,182,.12)' },
  PREMATURE_COMPLETION: { label: 'Premature Completion', color: '#A1A1AA', soft: 'rgba(161,161,170,.12)' },
}

const allCategories = Object.keys(categoryMeta) as Category[]

function Stat({ icon: Icon, children, color }: { icon: typeof FlaskConical; children: React.ReactNode; color: string }) {
  return <span className="stat" style={{ color }}><Icon size={14} strokeWidth={1.8} />{children}</span>
}

function ScenarioCard({ scenario, index }: { scenario: ScenarioItem; index: number }) {
  const meta = categoryMeta[scenario.category]
  return (
    <article className="scenario-card" style={{ '--accent': meta.color, '--accent-soft': meta.soft, animationDelay: `${Math.min(index, 11) * 40}ms` } as React.CSSProperties}>
      <div className="card-tags"><span className="cat-badge">{meta.label}</span><span className="owasp">{scenario.owasp}</span><span className={`diff ${scenario.difficulty}`}>{scenario.difficulty}</span></div>
      <blockquote>{scenario.message}</blockquote>
      <div className="behavior"><span>Expected Safe Behavior</span><p>{scenario.behavior}</p></div>
      <div className="card-footer"><span className="tool-count"><Wrench size={12} />{scenario.tools} mocked tools</span><div className="card-actions"><button className="run">Run</button><button className="details">Details</button></div></div>
    </article>
  )
}

export default function ScenariosPage() {
  const { agentId, agent, activeVersionId } = useAgent()
  const mockScenarios = SCENARIO_CATALOG[agentId]

  const [liveScenarios, setLiveScenarios] = useState<ScenarioItem[] | null>(null)
  const [scenariosLoading, setScenariosLoading] = useState(false)
  const [scenariosError, setScenariosError] = useState<string | null>(null)

  // Fetch real scenarios on mount
  useEffect(() => {
    const controller = new AbortController()
    setScenariosLoading(true)
    setScenariosError(null)
    getScenarios(controller.signal)
      .then((data) => setLiveScenarios(mapScenarios(data)))
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return
        setScenariosError(
          err instanceof ApiError ? `Backend error ${err.status}` : 'Backend offline'
        )
      })
      .finally(() => setScenariosLoading(false))
    return () => controller.abort()
  }, [])

  // Use live data when available, fall back to mock
  const scenarios = liveScenarios ?? mockScenarios
  const isLive = liveScenarios !== null

  const [category, setCategory] = useState<Category | 'ALL'>('ALL')
  const [difficulty, setDifficulty] = useState<Difficulty | 'ALL'>('ALL')
  const [query, setQuery] = useState('')
  const [count, setCount] = useState(5)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [visible, setVisible] = useState(12)

  const filtered = useMemo(() => scenarios.filter((s) =>
    (category === 'ALL' || s.category === category) &&
    (difficulty === 'ALL' || s.difficulty === difficulty) &&
    `${s.message} ${s.behavior} ${s.category}`.toLowerCase().includes(query.toLowerCase())
  ), [scenarios, category, difficulty, query])

  const generate = useCallback(async () => {
    if (generating) return
    setGenerating(true)
    setGenerateError(null)
    try {
      const cat = category === 'ALL' ? 'DESTRUCTIVE_ACTION' : category
      const generated = await generateScenarios(cat, count, activeVersionId ?? '')
      if (generated.length === 0) {
        setGenerateError('Backend returned 0 scenarios — check server logs and restart backend if needed')
      } else {
        const offset = Date.now() // unique offset to prevent key collisions
        setLiveScenarios((prev) => [
          ...(prev ?? []),
          ...mapScenarios(generated).map((s, i) => ({ ...s, id: offset + i })),
        ])
      }
    } catch (err) {
      setGenerateError(
        err instanceof ApiError
          ? `Backend error ${err.status}: ${err.message}`
          : `Generate failed — is the backend running? (${(err as Error).message})`
      )
    } finally {
      setGenerating(false)
    }
  }, [generating, activeVersionId, category, count])

  return <div className="catalog-shell">
    <div className="catalog-inner">
      <header className="hero">
        <div className="hero-content">
          <p className="sc-eyebrow">THREAT LIBRARY / {agent.name.toUpperCase()}</p>
          <h1>Adversarial Scenarios</h1>
          <p className="sc-subtitle">
            {isLive
              ? `Live data · ${scenarios.length} scenarios from backend`
              : `Curated attack scenarios for ${agent.name} ${agent.version}`}
            {scenariosLoading && <span style={{ color: '#55556A', marginLeft: 8, fontSize: 11 }}>Loading…</span>}
          </p>
          <div className="stats">
            <Stat icon={FlaskConical} color="#22D3EE">{scenarios.length} scenarios</Stat>
            <b>•</b>
            <Stat icon={Layers} color="#8B5CF6">7 categories</Stat>
            <b>•</b>
            <Stat icon={GitBranch} color="#FBBF24">{scenarios.filter(s => s.difficulty === 'hard').length} hard</Stat>
          </div>
          {scenariosError && (
            <p style={{ margin: '8px 0 0', color: '#F43F5E', fontSize: 11 }}>
              ⚠ {scenariosError} — showing mock data
            </p>
          )}
        </div>
        <div className="generate-box">
          <div className="generate-label"><Sparkles size={15} /> GENERATE SCENARIOS</div>
          <div className="generate-controls">
            <label>
              <span className="sr-only">Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value as Category | 'ALL')}>
                <option value="ALL">All Categories</option>
                {allCategories.map((c) => <option key={c} value={c}>{categoryMeta[c].label}</option>)}
              </select>
              <ChevronDown size={15} />
            </label>
            <label>
              <span className="sr-only">Count</span>
              <input type="number" min={1} max={10} value={count} onChange={(e) => setCount(Math.min(10, Math.max(1, Number(e.target.value))))} />
            </label>
            <button className="generate" onClick={generate} disabled={generating}>
              {generating ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
              {generating ? 'Generating...' : `Generate ${count}`}
            </button>
          </div>
          {generateError && <p style={{ margin: '4px 0 0', color: '#F43F5E', fontSize: 11 }}>{generateError}</p>}
        </div>
      </header>

      <section className="filter-bar" aria-label="Scenario filters"><div className="chips"><button className={category === 'ALL' ? 'active all' : ''} onClick={() => setCategory('ALL')}>ALL</button>{allCategories.map((c) => <button key={c} className={category === c ? 'active' : ''} style={category === c ? { '--chip': categoryMeta[c].color, '--chip-soft': categoryMeta[c].soft } as React.CSSProperties : undefined} onClick={() => setCategory(c)}>{categoryMeta[c].label.toUpperCase()}</button>)}</div><div className="difficulty-filters">{(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => <button key={d} className={difficulty === d ? `selected ${d}` : ''} onClick={() => setDifficulty(difficulty === d ? 'ALL' : d)}>{d[0].toUpperCase() + d.slice(1)}</button>)}</div><label className="search"><Search size={14} /><span className="sr-only">Search scenarios</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search scenarios..." /></label></section>
      {filtered.length ? <><div className="result-line"><span>Showing {Math.min(visible, filtered.length)} of {filtered.length} scenarios</span><span className="mono">SORT: RELEVANCE <ChevronDown size={13} /></span></div><section className="scenario-grid">{filtered.slice(0, visible).map((scenario, index) => <ScenarioCard key={scenario.id} scenario={scenario} index={index} />)}</section>{visible < filtered.length && <button className="show-more" onClick={() => setVisible((v) => v + 6)}>Show More Scenarios</button>}</> : <div className="empty"><FlaskConical size={64} /><h2>No scenarios found</h2><p>Try adjusting your filters or generate a new batch of adversarial scenarios.</p><button className="generate" onClick={generate}><Sparkles size={14} /> Generate Scenarios</button></div>}
    </div>
    <style jsx>{scenarioStyles}</style>
  </div>
}

const scenarioStyles = `
.catalog-shell{min-height:100vh}.catalog-inner{max-width:1400px;margin:auto;padding:0 32px 72px}.hero{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;padding-top:40px;margin-bottom:32px}.hero-content{flex:1;min-width:0}.sc-eyebrow{margin:0 0 16px;color:#55556A;font:600 10px/1.4 monospace;letter-spacing:.16em}h1{margin:0;font-size:32px;line-height:1.15;font-weight:600;letter-spacing:-.03em;color:#F0F0F5}.sc-subtitle{margin:10px 0 20px;color:#8B8B9E;font-size:14px}.stats{display:flex;align-items:center;gap:14px;color:#55556A;font:11px monospace;white-space:nowrap}.stat{display:flex;gap:7px;align-items:center;padding:6px 12px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);border-radius:8px}.generate-box{flex:none;display:flex;flex-direction:column;gap:16px;padding:20px;border:1px solid rgba(34,211,238,.12);border-radius:14px;background:rgba(34,211,238,.04);box-shadow:inset 0 0 20px rgba(34,211,238,.02)}.generate-label{display:flex;gap:9px;align-items:center;color:#8B8B9E;font:600 10px monospace;letter-spacing:.12em}.generate-label svg{color:#22D3EE}.generate-controls{display:flex;gap:10px;align-items:center}.generate-controls label{position:relative;display:flex}.generate-controls select,.generate-controls input,.search input{height:40px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:#131320;color:#F0F0F5;outline:none}.generate-controls select{width:180px;padding:0 34px 0 14px;appearance:none;font-size:13px}.generate-controls label>svg{position:absolute;right:12px;top:12px;color:#8B8B9E;pointer-events:none}.generate-controls input{width:70px;padding:0 12px;font-size:13px}.generate-controls select:focus,.generate-controls input:focus,.search:focus-within{border-color:rgba(34,211,238,.4);box-shadow:0 0 0 3px rgba(34,211,238,.1)}.generate{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:40px;padding:0 20px;border:0;border-radius:10px;background:linear-gradient(135deg,#22D3EE,#06B6D4);color:#06060A;font-size:13px;font-weight:700;cursor:pointer;transition:.2s;box-shadow:0 4px 14px rgba(34,211,238,.2)}.generate:hover{filter:brightness(1.15);box-shadow:0 6px 20px rgba(34,211,238,.35);transform:translateY(-1px)}.generate:active{transform:scale(.97)}.filter-bar{position:sticky;top:56px;z-index:10;display:flex;align-items:center;gap:14px;padding:16px 0;background:var(--bg-deep);border-bottom:1px solid rgba(255,255,255,.05)}.chips{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none}.chips::-webkit-scrollbar{display:none}.chips button,.difficulty-filters button{flex:none;padding:7px 14px;border:1px solid rgba(255,255,255,.06);border-radius:999px;background:rgba(255,255,255,.03);color:#8B8B9E;font:600 10px monospace;cursor:pointer;transition:.2s}.chips button:hover{background:rgba(255,255,255,.08);color:#F0F0F5}.chips button.active{background:var(--chip-soft);border-color:color-mix(in srgb,var(--chip) 40%,transparent);color:var(--chip)}.chips button.active.all{--chip:#22D3EE;--chip-soft:rgba(34,211,238,.12);border-color:rgba(34,211,238,.3);color:#22D3EE}.difficulty-filters{display:flex;gap:6px;margin-left:auto}.difficulty-filters button{border-color:transparent;background:transparent;color:#55556A;font-family:var(--font-sans);font-size:12px;font-weight:500}.difficulty-filters button.selected.easy{background:rgba(52,211,153,.12);color:#34D399}.difficulty-filters button.selected.medium{background:rgba(251,191,36,.12);color:#FBBF24}.difficulty-filters button.selected.hard{background:rgba(244,63,94,.12);color:#F43F5E}.search{display:flex;align-items:center;gap:10px;width:280px;height:40px;padding:0 14px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:#131320;color:#8B8B9E;transition:.3s}.search:focus-within{width:340px}.search input{width:100%;height:auto;padding:0;border:0;background:transparent;box-shadow:none;font-size:13px;color:#F0F0F5}.search input::placeholder{color:#55556A}.result-line{display:flex;justify-content:space-between;margin:24px 0 16px;color:#55556A;font:600 10px monospace}.mono{display:flex;align-items:center;gap:6px}.scenario-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.scenario-card{min-height:280px;padding:24px;border:1px solid rgba(255,255,255,.05);border-radius:16px;background:#0C0C12;display:flex;flex-direction:column;animation:cardIn .5s cubic-bezier(.16,1,.3,1) both;transition:.35s cubic-bezier(.4,0,.2,1)}.scenario-card:hover{border-color:color-mix(in srgb,var(--accent) 35%,transparent);box-shadow:0 -2px 24px color-mix(in srgb,var(--accent) 10%,transparent), 0 12px 30px rgba(0,0,0,.4);transform:translateY(-4px)}.card-tags{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.cat-badge,.owasp,.diff{padding:5px 10px;border-radius:999px;font:600 9px monospace;letter-spacing:.04em}.cat-badge{background:var(--accent-soft);color:var(--accent)}.owasp{border:1px solid rgba(139,92,246,.25);background:rgba(139,92,246,.12);color:#A78BFA}.diff{font-family:var(--font-sans);text-transform:lowercase;font-size:11px}.diff.hard{background:rgba(244,63,94,.1);color:#F43F5E}.diff.medium{background:rgba(251,191,36,.1);color:#FBBF24}.diff.easy{background:rgba(52,211,153,.1);color:#34D399}blockquote{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;margin:20px 0;color:#D4D4DC;font:italic 14px/1.6 Georgia,serif;border-left:3px solid color-mix(in srgb,var(--accent) 70%,transparent);padding-left:16px;background:linear-gradient(90deg, color-mix(in srgb,var(--accent) 4%,transparent), transparent);padding-top:4px;padding-bottom:4px}.behavior{margin-top:auto}.behavior>span{color:#55556A;font:600 9px monospace;letter-spacing:.12em;text-transform:uppercase}.behavior p{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin:8px 0 20px;color:#8B8B9E;font-size:12px;line-height:1.5}.card-footer{display:flex;align-items:center;justify-content:space-between;padding-top:16px;border-top:1px solid rgba(255,255,255,.05)}.tool-count{display:flex;align-items:center;gap:8px;color:#55556A;font-size:12px}.card-actions{display:flex;gap:8px}.card-actions button,.show-more{padding:7px 16px;border-radius:8px;background:transparent;font-size:12px;font-weight:500;cursor:pointer;transition:.2s}.run{border:1px solid rgba(34,211,238,.3);color:#22D3EE;background:rgba(34,211,238,.04)}.run:hover{background:rgba(34,211,238,.12);border-color:rgba(34,211,238,.5);box-shadow:0 0 16px rgba(34,211,238,.15)}.details{border:1px solid rgba(255,255,255,.08);color:#8B8B9E}.details:hover,.show-more:hover{border-color:rgba(255,255,255,.15);color:#F0F0F5;background:rgba(255,255,255,.03)}.show-more{display:block;margin:32px auto 0;border:1px solid rgba(255,255,255,.08);color:#8B8B9E}.empty{display:flex;flex-direction:column;align-items:center;max-width:400px;margin:90px auto;text-align:center}.empty>svg{color:#55556A;animation:float 4s ease-in-out infinite}.empty h2{margin:25px 0 8px;color:#8B8B9E;font-size:18px;font-weight:500}.empty p{margin:0 0 24px;color:#55556A;font-size:13px;line-height:1.5}.spin{animation:spin 1s linear infinite}@keyframes cardIn{from{opacity:0;transform:translateY(24px)}}@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:1024px){.scenario-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.filter-bar{flex-wrap:wrap}.search{margin-left:auto}}@media(max-width:768px){.catalog-inner{padding:0 24px 52px}.hero{flex-direction:column;align-items:stretch;gap:24px}.generate-box{flex-direction:row;align-items:center;justify-content:space-between;flex-wrap:wrap}}@media(max-width:640px){.catalog-inner{padding:0 16px 52px}.stats{flex-wrap:wrap;white-space:normal}.generate-controls{flex-wrap:wrap;width:100%}.generate-controls select{flex:1;width:auto}.generate{flex:1}.filter-bar{align-items:stretch;gap:12px;top:56px}.chips{order:1;width:100%}.difficulty-filters{order:2;margin-left:0}.search{order:3;width:100%}.search:focus-within{width:100%}.scenario-grid{grid-template-columns:1fr}.result-line{margin-top:20px}}
`
