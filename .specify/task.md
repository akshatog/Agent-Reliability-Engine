# Task Checklist — Agent Reliability Engine

Governed by `plan.md`. Mark items as `[/]` when in progress, `[x]` when done.

---

## Phase 1: Foundation

- [x] **1.1** FastAPI app skeleton (`backend/app/main.py`, routers, CORS, health check)
- [x] **1.2** PostgreSQL connection (SQLAlchemy async + asyncpg)
- [x] **1.3** DB models (SQLAlchemy ORM: agent_versions, scenarios, runs, classifications, guardrail_results)
- [x] **1.4** Pydantic schemas (request/response models for all entities)
- [x] **1.5** Alembic setup + initial migration
- [x] **1.6** WebSocket endpoint stub (`/ws/traces`)
- [x] **1.7** DevOps Assistant Agent (LangGraph) — 5 tools, configurable system_prompt
- [x] **1.8** Seed 3 agent versions (v1 weak, v2 strong, v3 regressed) with system prompts + tool schemas
- [x] **1.9** Verify: health check returns 200, DB connection works, agent executes a basic prompt

## Phase 2: Scenario Generation (Module 1)

- [x] **2.1** Tool schema parser — extract tool names, descriptions, params, flag high-risk tools
- [x] **2.2** 7 category-based prompt templates (loop, confidence, destructive, goal-drift, prompt-injection, wrong-tool, premature-completion)
- [x] **2.3** Gemini Flash integration — structured output call with response schema
- [x] **2.4** Scenario generation service — orchestrates: parse tools → generate per category → validate → store
- [x] **2.5** `POST /api/scenarios/generate` endpoint
- [x] **2.6** Test: given DevOps agent tools, generates ≥15 scenarios with ≥2 per category, ≥40% multi-step
- [x] **2.7** Test: at least one destructive-action-bait scenario names `delete_deployment` specifically

## Phase 3: Sandbox Execution (Module 2)

- [x] **3.1** Mock tool layer — reads `mocked_tool_responses` from scenario, creates callable mocks
- [x] **3.2** Trace capture — wraps LangGraph execution, captures step-by-step trace with step_number, type, timestamp, content, risk_level
- [x] **3.3** Timeout enforcement — 60s cap, marks run as `timed_out`
- [x] **3.4** Run execution service — orchestrates: load scenario + agent → mock tools → execute → capture trace → store run
- [x] **3.5** WebSocket live streaming — `@app.websocket("/ws/traces")` in main.py, broadcasts via `ConnectionManager.broadcast()`
- [x] **3.6** `POST /api/runs/execute` endpoint — wired to sandbox_harness + live WS broadcast on each step
- [x] **3.7** Run replay — trace stored in DB; `GET /api/runs/{run_id}` returns full trace for dashboard replay
- [x] **3.8** Test: execute a scenario, verify trace is stored correctly, replay matches original

## Phase 4: Guardrail Tester (Module 4)

- [x] **4.1** Guardrail checker — pattern A (prompt-based confirmation detection) + pattern B (tool-based)
- [x] **4.2** `POST /api/guardrail/check` endpoint
- [x] **4.3** Auto-trigger after run completion
- [x] **4.4** Test: trace with `delete_deployment` called without confirmation → `guardrail_bypassed`
- [x] **4.5** Test: trace with confirmation question before `delete_deployment` → `guardrail_held`
- [x] **4.6** Test: determinism — identical traces produce identical results 100% of the time

## Phase 5: Failure Classifier (Module 3)

- [x] **5.1** `JUDGE_RUBRIC` — strict system prompt covering all 7 categories, severity levels, anti-sycophancy instructions
- [x] **5.2** `_derive_classification()` — pure post-processor (no I/O) converts raw LLM dict → validated ClassificationCreate
- [x] **5.3** OWASP auto-mapping on FAIL verdicts via `get_owasp_mapping()`
- [x] **5.4** Graceful fallbacks: lowercase normalisation, invalid category → UNCATEGORIZED, invalid severity → MEDIUM
- [x] **5.5** `classify_run()` — async function, calls Gemini 2.5 Pro, strips markdown fences, returns schema-validated result
- [x] **5.6** `_get_client()` — lazy, patchable client factory (same pattern as ScenarioGenerator)
- [x] **5.7** Test: 27 core tests covering rubric content, _derive_classification, _clean_json_response, mocked classify_run
- [x] **5.8** Test: 13 edge case tests (null category, empty severity, boundary confidence, all 7 categories roundtrip)

## Phase 6: Scorecard & Tracker (Module 5)

- [x] **6.1** `compute_scorecard()` — pure sync aggregation: overall score, per-category breakdown (all 7, pre-seeded), guardrail hold rate, severity distribution, OWASP risk profile
- [x] **6.2** `wilson_score_interval()` in `app.core.statistics` — Wilson score CI, handles zero-total, 90/95/99% confidence
- [x] **6.3** Graceful handling: unknown categories excluded from OWASP profile, None severity not counted, empty runs returns zero scorecard
- [x] **6.4** Test: 16 core scorecard tests (all pass, mixed, guardrail rates, severity dist, OWASP profile)
- [x] **6.5** Test: 10 statistics tests (bounds ordering, monotonicity, symmetry, confidence narrowness)
- [x] **6.6** Test: 15 edge case tests (single run, unknown categories, large batch precision, all severities always present)
- [x] **6.7** `GET /api/scorecard/{agent_version_id}` endpoint — 404 for non-existent versions
- [x] **6.8** Trend + compare endpoints + PR review fixes: N+1 → batch query, empty trace guard, UUID validation, 19 new endpoint tests

## Phase 6B: Backend Differentiators

- [x] **D1** OWASP LLM Top 10 mapping — `get_owasp_mapping()` covers all 7 categories, wired into `compute_scorecard()` via `owasp_risk_profile`
- [x] **D2** Auto-generated report + badge — `GET /api/report/{id}` returns full `ReportRead`, `GET /api/badge/{id}.svg` returns SVG
- [x] **D3** `severity_heatmap` aggregation in `compute_scorecard()` — `Record<category, Record<severity, count>>`; 8 tests added
- [x] **D4** Natural Language Red Team Chat — `POST /api/red-team-chat`; Gemini generates scenario → runs → classifies; rejects nonsensical input (422); confirmed live against real model
- [x] **D5** Flaky scenario detection — `compute_scorecard()` returns `flaky_scenarios` list; 7 tests
- [x] **D6** (stretch) YAML agent interface — not yet implemented
- [x] **GET /api/runs** — list runs for an agent version; 5 integration tests

## Phase 7: Dashboard (Next.js) — Frontend

### Infrastructure (Item 0)
- [x] **7.0a** `frontend/lib/api-types.ts` — full TypeScript mirrors of all backend Pydantic schemas
- [x] **7.0b** `frontend/lib/api.ts` — typed fetch client with AbortSignal, ApiError class, all endpoints covered
- [x] **7.0c** `frontend/lib/use-websocket.ts` — reconnecting WebSocket hook with exponential backoff, 3 connection states

### Mapper Layer
- [x] **7.0d** `frontend/lib/scenario-mapper.ts` — `mapScenarios()` pure function, ScenarioRead → ScenarioItem
- [x] **7.0e** `frontend/lib/trace-mapper.ts` — `mapTrace()` pure function, BackendTraceStep[] → DisplayStep[]
- [x] **7.0f** `frontend/lib/red-team-mapper.ts` — `mapRedTeamResponse()` pure function, RedTeamChatResponse → RedTeamDisplayItem

### Item 1 — AgentProvider (two-field transition)
- [x] **7.1a** `frontend/lib/agent-context.tsx` — refactored to maintain legacy `agentId`/`agent` fields AND add `activeVersionId`, `versions`, `activeScorecard`, `versionsLoading`, `versionsError`
- [x] **7.1b** Version fetch fires on mount with Strict Mode guard (`fetchedRef`) — no double-call in dev
- [x] **7.1c** UUID validation on mount — stale localStorage IDs replaced with freshest live version
- [x] **7.1d** Scorecard fetched + cached per UUID in provider (single source of truth for KPI data)
- [x] **7.1e** `frontend/components/sidebar.tsx` — shows live backend versions in dropdown when available; falls back to mock AGENT_LIST; footer shows "Live · N versions" vs "Demo Mode · Backend offline"

### Item 2 — Scenarios Page
- [x] **7.2a** `GET /api/scenarios` called on mount → `mapScenarios()` → renders live data
- [x] **7.2b** Graceful fallback to `SCENARIO_CATALOG` mock when backend offline (with ⚠ banner)
- [x] **7.2c** Generate button calls `POST /api/scenarios/generate` with real `activeVersionId`; new items appended live
- [x] **7.2d** Loading state + error display in hero subtitle

### Item 3 — Trace Viewer (`/traces/[runId]`)
- [x] **7.3a** `GET /api/runs/{runId}` fetches real run data on mount
- [x] **7.3b** WebSocket hook accumulates `trace_step` events during live execution
- [x] **7.3c** Falls back to persisted `run.trace` when WS is idle/offline
- [x] **7.3d** `POST /api/classify/{runId}` called once per mount with `hasTriggeredClassify` ref (Strict Mode guard)
- [x] **7.3e** Intel panel shows real attack vector, tool calls from trace
- [x] **7.3f** Verdict panel shows real classification: verdict, confidence ring, OWASP mapping, justification
- [x] **7.3g** Timeline renders real `DisplayStep[]` from `mapTrace()`

### Item 4 — Red Team Chat
- [x] **7.4a** `POST /api/red-team-chat` called on "Execute Attack" with real `activeVersionId`
- [x] **7.4b** `mapRedTeamResponse()` converts response → `RedTeamDisplayItem`; prepended to history list
- [x] **7.4c** Mock SUGGESTION_CHIPS retained for quick-launch chips
- [x] **7.4d** Theater component driven by live classification result (not mock trace data)
- [x] **7.4e** Demo fallback when `activeVersionId` is null (backend offline) — 1.9s fake delay + mock result
- [x] **7.4f** Error state shown inline; Ctrl+Enter keyboard shortcut to submit

### Item 5 — Scorecard Page
- [x] **7.5a** `GET /api/scorecard/trend` fetches live trend → converted to chart data; falls back to mock
- [x] **7.5b** `listRuns(activeVersionId)` fetches live runs for the runs table; falls back to mock SCORECARD_RUNS
- [x] **7.5c** `severity_heatmap` from `activeScorecard` → converted to `HeatmapRow[]`; falls back to mock
- [x] **7.5d** KPI values (score, guardrailRate, totalRuns, criticalCount, CI bounds) from `activeScorecard`; fallback to mock agent
- [x] **7.5e** OWASP risk profile from `activeScorecard.owasp_risk_profile`; falls back to static mock list
- [x] **7.5f** Version tabs driven by live trend version names; falls back to mock trend versions
- [x] **7.5g** Topbar shows "Live" label when `activeScorecard` is populated

### Item 6 — Dashboard Page
- [x] **7.6a** KPI cards (score, totalRuns, guardrailRate, activeFailures) from `activeScorecard`; fallback to mock agent
- [x] **7.6b** Recent Runs table uses `listRuns()` live data with real run IDs → `/traces/{id}`; fallback to mock
- [x] **7.6c** Failure distribution pie chart uses `per_category_breakdown` from `activeScorecard`; fallback to mock
- [x] **7.6d** Metric card subtitles updated ("Live" vs "+23 today")

### Item 7 — Report & Badge Page
- [ ] **7.7a** `GET /api/report/{activeVersionId}` replaces mock report data
- [ ] **7.7b** `GET /api/badge/{activeVersionId}.svg` — embed live badge via `getBadgeUrl()`
- [ ] **7.7c** Fallback to mock report when backend offline

### Other Pages (remaining)
- [ ] **7.8** Remediation page — wire to real failure data from scorecard
- [ ] **7.9** Comparison page (`/comparison`) — wire `getScorecardCompare()` to real two-version delta view

---

## Phase 8: Integration + Demo

- [ ] **8.1** Full pipeline integration test — generate → execute batch → classify → guardrail → scorecard, all 3 versions
- [ ] **8.2** Demo scenario scripting — ensure v1 fails, v2 passes, v3 regresses
- [ ] **8.3** Tune system prompts if needed (make v1 reliably fail, v2 reliably pass)
- [ ] **8.4** Record 3-5 min demo video (structure from constitution §8)
- [ ] **8.5** README polish — architecture diagram, setup instructions, OWASP grounding, extensibility pitch
- [ ] **8.6** Clean up: remove debug code, verify all endpoints work, final commit

## Stretch: YAML Interface (D6)

- [ ] **S.1** YAML schema definition + documentation
- [ ] **S.2** YAML parser + validator
- [ ] **S.3** Dynamic LangGraph agent construction from YAML
- [ ] **S.4** Dashboard UI — upload YAML, display parsed agent info
- [ ] **S.5** Test: YAML-defined agent produces complete test run

---

| Phase | Status | Tasks |
|---|---|---|
| Foundation | ✅ Done | 9/9 |
| Module 1 (Scenario Gen) | ✅ Done | 7/7 |
| Module 2 (Sandbox) | ✅ Done | 8/8 |
| Module 4 (Guardrail) | ✅ Done | 6/6 |
| Module 3 (Classifier) | ✅ Done | 8/8 |
| Module 5 (Scorecard) | ✅ Done | 8/8 |
| Backend Differentiators (D1–D5) | ✅ Done | 6/6 |
| REST API | ✅ Done | 14+ endpoints |
| Frontend Infrastructure (Item 0) | ✅ Done | api-types, api.ts, use-websocket, 3 mappers |
| Frontend Item 1 — AgentProvider | ✅ Done | Two-field transition, sidebar live |
| Frontend Item 2 — Scenarios Page | ✅ Done | Live fetch + generate + fallback |
| Frontend Item 3 — Trace Viewer | ✅ Done | WebSocket + classify guard + real panels |
| Frontend Item 4 — Red Team Chat | ✅ Done | Live API + demo fallback + error state |
| Frontend Item 5 — Scorecard Page | ✅ Done | All 7 data sources wired |
| Frontend Item 6 — Dashboard | ✅ Done | KPIs + runs + distribution wired |
| Frontend Item 7 — Report & Badge | 🔲 Pending | 0/3 |
| Frontend Remaining Pages | 🔲 Pending | Report, Remediation, Comparison |
| Integration + Demo | 🔲 Pending | 0/6 |
| Stretch (D6 YAML) | 🔲 Not started | 0/5 |
| **Total backend tests** | **✅ 253 passing** | **Stable, fully mocked** |
