/**
 * Typed API client for the Agent Reliability Engine backend.
 *
 * All API calls go through this file — no raw fetch() calls in components.
 * Every function uses AbortController support for cancellable requests.
 */

import type {
  AgentVersionRead,
  ScenarioRead,
  RunRead,
  ExecuteRunResponse,
  ClassificationRead,
  GuardrailResultRead,
  RedTeamChatResponse,
  ScorecardData,
  ScorecardTrendEntry,
  ReportRead,
} from './api-types'

export const BASE_URL = 'http://localhost:8000'

// ── Error handling ─────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message?: string,
  ) {
    super(message ?? `API error ${status}`)
    this.name = 'ApiError'
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    signal,
    ...options,
  })
  if (!res.ok) {
    let body: unknown
    try { body = await res.json() } catch { body = await res.text() }
    throw new ApiError(res.status, body)
  }
  return res.json() as Promise<T>
}

// ── Agent Versions ─────────────────────────────────────────────────────────

export function getAgentVersions(signal?: AbortSignal): Promise<AgentVersionRead[]> {
  return request('/api/agent-versions', {}, signal)
}

export function createAgentVersion(
  data: { name: string; description?: string; system_prompt: string; tool_schemas?: Record<string, unknown> },
  signal?: AbortSignal,
): Promise<AgentVersionRead> {
  return request('/api/agent-versions', { method: 'POST', body: JSON.stringify(data) }, signal)
}

// ── Scenarios ──────────────────────────────────────────────────────────────

export function getScenarios(signal?: AbortSignal): Promise<ScenarioRead[]> {
  return request('/api/scenarios', {}, signal)
}

export function generateScenarios(
  category: string,
  count: number,
  agentVersionId: string,
  signal?: AbortSignal,
): Promise<ScenarioRead[]> {
  return request(
    '/api/scenarios/generate',
    {
      method: 'POST',
      body: JSON.stringify({ category, count, agent_version_id: agentVersionId }),
    },
    signal,
  )
}

// ── Runs ───────────────────────────────────────────────────────────────────

export function executeRun(
  data: {
    agent_version_id: string
    user_message: string
    mocked_tool_responses?: Record<string, unknown>
    expected_safe_behavior?: string
    tool_definitions?: unknown[]
    timeout_seconds?: number
  },
  signal?: AbortSignal,
): Promise<ExecuteRunResponse> {
  return request('/api/runs/execute', { method: 'POST', body: JSON.stringify(data) }, signal)
}

export function getRun(runId: string, signal?: AbortSignal): Promise<RunRead> {
  return request(`/api/runs/${runId}`, {}, signal)
}

export function listRuns(agentVersionId: string, signal?: AbortSignal): Promise<RunRead[]> {
  return request(`/api/runs?agent_version_id=${agentVersionId}`, {}, signal)
}

// ── Classification ─────────────────────────────────────────────────────────

export function classifyRun(runId: string, signal?: AbortSignal): Promise<ClassificationRead> {
  return request(`/api/classify/${runId}`, { method: 'POST' }, signal)
}

// ── Guardrail ──────────────────────────────────────────────────────────────

export function guardrailCheck(runId: string, signal?: AbortSignal): Promise<GuardrailResultRead[]> {
  return request(`/api/guardrail/check/${runId}`, { method: 'POST' }, signal)
}

// ── Red Team Chat ──────────────────────────────────────────────────────────

export function redTeamChat(
  agentVersionId: string,
  message: string,
  signal?: AbortSignal,
): Promise<RedTeamChatResponse> {
  return request(
    '/api/red-team-chat',
    { method: 'POST', body: JSON.stringify({ agent_version_id: agentVersionId, message }) },
    signal,
  )
}

// ── Scorecard ──────────────────────────────────────────────────────────────

export function getScorecard(agentVersionId: string, signal?: AbortSignal): Promise<ScorecardData> {
  return request(`/api/scorecard/${agentVersionId}`, {}, signal)
}

export function getScorecardTrend(signal?: AbortSignal): Promise<ScorecardTrendEntry[]> {
  return request('/api/scorecard/trend', {}, signal)
}

export function getScorecardCompare(
  versionA: string,
  versionB: string,
  signal?: AbortSignal,
): Promise<{ version_a: ScorecardData; version_b: ScorecardData }> {
  return request(
    `/api/scorecard/compare?version_a=${versionA}&version_b=${versionB}`,
    {},
    signal,
  )
}

// ── Report & Badge ─────────────────────────────────────────────────────────

export function getReport(agentVersionId: string, signal?: AbortSignal): Promise<ReportRead> {
  return request(`/api/report/${agentVersionId}`, {}, signal)
}

/**
 * Returns the badge SVG URL — use directly in <img src={getBadgeUrl(id)} />.
 * Not a fetch — the browser loads the SVG itself.
 */
export function getBadgeUrl(agentVersionId: string): string {
  return `${BASE_URL}/api/badge/${agentVersionId}.svg`
}
