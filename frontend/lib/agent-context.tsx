'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AgentId } from '@/lib/mock-data'
import { AGENTS } from '@/lib/mock-data'
import { getAgentVersions, getScorecard, ApiError } from '@/lib/api'
import type { AgentVersionRead, ScorecardData } from '@/lib/api-types'

// ── Legacy agent shape (kept for backward compat during migration) ──────────
// Pages that haven't been migrated yet still read from `agent.*`.
// Once every page is wired to real API data, this type and AGENTS import
// will be removed along with the legacy `agentId` field.
type LegacyAgent = typeof AGENTS[AgentId]

// ── Context shape ───────────────────────────────────────────────────────────

type AgentContextType = {
  // ── Legacy fields (used by pages not yet migrated to live API) ────────────
  /** Legacy string key: 'devops' | 'support' */
  agentId: AgentId
  /** Full legacy agent object — score/grade/etc. from mock-data */
  agent: LegacyAgent
  setAgentId: (id: AgentId) => void

  // ── Live API fields ───────────────────────────────────────────────────────
  /** UUID string of the currently active agent version */
  activeVersionId: string | null
  setActiveVersionId: (id: string) => void
  /** All agent versions fetched from the backend */
  versions: AgentVersionRead[]
  /** Scorecard for the active version (null while loading or no data yet) */
  activeScorecard: ScorecardData | null
  /** True while the initial version list is being fetched */
  versionsLoading: boolean
  /** Error message if the version fetch failed */
  versionsError: string | null
}

const AgentContext = createContext<AgentContextType>({
  agentId: 'devops',
  agent: AGENTS.devops,
  setAgentId: () => {},
  activeVersionId: null,
  setActiveVersionId: () => {},
  versions: [],
  activeScorecard: null,
  versionsLoading: false,
  versionsError: null,
})

// ── Provider ────────────────────────────────────────────────────────────────

export function AgentProvider({ children }: { children: ReactNode }) {
  // ── Legacy state ────────────────────────────────────────────────────────
  const [agentId, setAgentIdState] = useState<AgentId>('devops')

  useEffect(() => {
    const saved = localStorage.getItem('are_agent_id') as AgentId
    if (saved && (saved === 'devops' || saved === 'support')) {
      setAgentIdState(saved)
    }
  }, [])

  const setAgentId = (id: AgentId) => {
    setAgentIdState(id)
    if (typeof window !== 'undefined') localStorage.setItem('are_agent_id', id)
  }

  // ── Live API state ──────────────────────────────────────────────────────
  const [versions, setVersions] = useState<AgentVersionRead[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [versionsError, setVersionsError] = useState<string | null>(null)

  // Active version UUID: persisted in localStorage under a separate key
  // so it survives page reloads without polluting the legacy key.
  const [activeVersionId, setActiveVersionIdState] = useState<string | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('are_version_id')
    if (saved) {
      setActiveVersionIdState(saved)
    }
  }, [])

  const [scorecards, setScorecards] = useState<Record<string, ScorecardData>>({})

  const setActiveVersionId = useCallback((id: string) => {
    setActiveVersionIdState(id)
    if (typeof window !== 'undefined') localStorage.setItem('are_version_id', id)
  }, [])

  // ── Fetch version list on mount ─────────────────────────────────────────
  // UUID lookups always resolve through the live response — never stale
  // localStorage UUIDs are matched against the fresh list.
  const fetchedRef = useRef(false)
  useEffect(() => {
    // Strict Mode guard: only fire once per real mount
    if (fetchedRef.current) return
    fetchedRef.current = true

    const controller = new AbortController()
    setVersionsLoading(true)

    getAgentVersions(controller.signal)
      .then((list) => {
        setVersions(list)

        // Validate persisted activeVersionId against the live list
        const savedId = localStorage.getItem('are_version_id')
        const stillValid = savedId && list.some((v) => v.id === savedId)
        if (!stillValid && list.length > 0) {
          // Default to the most recently created version
          setActiveVersionId(list[list.length - 1].id)
        }
      })
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return
        const msg = err instanceof ApiError
          ? `Backend error ${err.status}`
          : 'Could not reach backend'
        setVersionsError(msg)
      })
      .finally(() => setVersionsLoading(false))

    return () => controller.abort()
  }, [setActiveVersionId])

  // ── Fetch scorecard when active version changes ─────────────────────────
  useEffect(() => {
    if (!activeVersionId) return
    // Already cached — skip
    if (scorecards[activeVersionId]) return

    const controller = new AbortController()
    getScorecard(activeVersionId, controller.signal)
      .then((sc) => {
        setScorecards((prev) => ({ ...prev, [activeVersionId]: sc }))
      })
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return
        // Non-fatal: scorecard may not exist yet for a fresh agent version
      })

    return () => controller.abort()
  }, [activeVersionId, scorecards])

  const activeScorecard = activeVersionId ? (scorecards[activeVersionId] ?? null) : null

  return (
    <AgentContext.Provider
      value={{
        // Legacy
        agentId,
        agent: AGENTS[agentId],
        setAgentId,
        // Live
        activeVersionId,
        setActiveVersionId,
        versions,
        activeScorecard,
        versionsLoading,
        versionsError,
      }}
    >
      {children}
    </AgentContext.Provider>
  )
}

export function useAgent() {
  return useContext(AgentContext)
}
