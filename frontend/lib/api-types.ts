/**
 * TypeScript mirrors of FastAPI backend response schemas.
 * Keep these in sync with the Pydantic models in backend/app/schemas/.
 */

// ── Agent Version ──────────────────────────────────────────────────────────

export interface AgentVersionRead {
  id: string
  name: string
  description: string
  system_prompt: string
  tool_schemas: Record<string, unknown>
  created_at: string
}

// ── Scenario ───────────────────────────────────────────────────────────────

export type FailureCategory =
  | 'TOOL_CALL_LOOP'
  | 'HALLUCINATED_CONFIDENCE'
  | 'DESTRUCTIVE_ACTION'
  | 'GOAL_DRIFT'
  | 'PROMPT_INJECTION'
  | 'WRONG_TOOL'
  | 'PREMATURE_COMPLETION'
  | 'UNCATEGORIZED'

export interface ScenarioRead {
  id: string
  category: FailureCategory
  setup: string
  user_message: string
  expected_safe_behavior: string
  expected_tool_sequence: string[]
  mocked_tool_responses: Record<string, unknown>
  difficulty: string
  owasp_mapping: string | null
  generation_batch_id: string | null
  created_at: string
}

// ── Run ────────────────────────────────────────────────────────────────────

export interface BackendTraceStep {
  step_number: number
  step_type: 'user_input' | 'agent_output' | 'tool_call' | 'tool_response' | 'error'
  content: Record<string, unknown>
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null
  timestamp: string
}

export interface RunRead {
  id: string
  agent_version_id: string
  scenario_id: string | null
  trace: BackendTraceStep[]
  status: string
  duration_ms: number | null
  started_at: string
  completed_at: string | null
  created_at: string
}

export interface ExecuteRunResponse {
  status: string
  trace: BackendTraceStep[]
  duration_ms: number | null
}

// ── Classification ─────────────────────────────────────────────────────────

export interface ClassificationRead {
  verdict: 'PASS' | 'FAIL'
  failure_category: string | null
  severity: string | null
  confidence: number          // 0.0 – 1.0 float
  justification: string
  owasp_mapping: string | null
}

// ── Guardrail ──────────────────────────────────────────────────────────────

export interface GuardrailResultRead {
  high_risk_tool_called: string | null
  step_number: number
  confirmation_detected: boolean
  result: 'HELD' | 'BYPASSED' | 'NOT_APPLICABLE'
}

// ── Red Team Chat ──────────────────────────────────────────────────────────

export interface RedTeamChatResponse {
  scenario: ScenarioRead
  run_id: string
  classification: ClassificationRead
  guardrail_results: GuardrailResultRead[]
}

/**
 * Display-ready item produced by mapRedTeamResponse().
 * This is the shape the red-team page components consume.
 */
export interface RedTeamDisplayItem {
  /** The original user natural-language message */
  prompt: string
  category: string
  severity: string
  /** Already formatted as percentage string, e.g. "94%" */
  confidence: string
  verdict: 'PASS' | 'FAIL'
  /** Localised time string */
  time: string
  runId: string
  guardrailResults: GuardrailResultRead[]
  justification: string
}

// ── Scorecard ──────────────────────────────────────────────────────────────

export interface CategoryBreakdown {
  fail_count: number
  owasp: string
  pass_rate_pct?: number
  total?: number
  passes?: number
  fails?: number
}

export interface FlakeyScenario {
  scenario_id: string
  pass_count: number
  fail_count: number
  total_runs: number
}

/** Shape returned by GET /api/scorecard/{agent_version_id} */
export interface ScorecardData {
  overall_reliability_score: number
  total_runs: number
  passes: number
  failures: number
  per_category_breakdown: Record<string, CategoryBreakdown>
  guardrail_hold_rate: number
  severity_distribution: Record<string, number>
  owasp_risk_profile: Record<string, number>
  confidence_interval: [number, number]
  flaky_scenarios: FlakeyScenario[]
  /** { DESTRUCTIVE_ACTION: { critical: n, high: n, medium: n, low: n }, ... } */
  severity_heatmap: Record<string, Record<string, number>>
}

/** Single entry in GET /api/scorecard/trend response */
export interface ScorecardTrendEntry {
  agent_version_id: string
  agent_version_name: string
  created_at: string
  overall_reliability_score: number
  guardrail_hold_rate: number
  total_runs: number
}

// ── Report ─────────────────────────────────────────────────────────────────

export interface TopFailure {
  run_id: string
  failure_category: string
  severity: string | null
  justification: string
  owasp_mapping: string | null
}

export interface ReportRead {
  agent_version_id: string
  agent_name: string
  agent_description: string | null
  system_prompt: string
  test_date: string
  overall_reliability_score: number
  letter_grade: string
  total_runs: number
  passes: number
  failures: number
  per_category_breakdown: Record<string, CategoryBreakdown>
  guardrail_hold_rate: number
  severity_distribution: Record<string, number>
  owasp_risk_profile: Record<string, number>
  confidence_interval: [number, number]
  flaky_scenarios: FlakeyScenario[]
  top_failures: TopFailure[]
}

// ── Remediation ────────────────────────────────────────────────────────────

/** Returned by POST /api/remediation/suggest/{run_id} */
export interface RemediationSuggestion {
  suggestion_id: string
  run_id: string
  category: string
  severity: string
  title: string
  description: string
  patch_type: 'system_prompt' | 'tool_schema'
  before: string
  after: string
  filename: string
}

/** Returned by POST /api/remediation/verify/{suggestion_id} */
export interface VerificationResult {
  suggestion_id: string
  verdict: 'PASS' | 'FAIL'
  confidence: number   // 0.0 – 1.0
  justification: string
  failure_category: string | null
  new_run_status: string
  new_run_trace: Record<string, unknown>[]
}
