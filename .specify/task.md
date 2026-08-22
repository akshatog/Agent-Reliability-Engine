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
- [ ] **6.7** `GET /api/scorecard/{agent_version_id}` endpoint (Task 8)
- [ ] **6.8** Trend + compare endpoints (Task 8)

## Phase 7: Dashboard (Next.js) — Build Incrementally

- [ ] **7.1** Next.js project setup (App Router, TailwindCSS, dark mode, Google Fonts)
- [ ] **7.2** Design system — color palette, badges, cards, chart theme
- [ ] **7.3** Layout — sidebar nav, main content area, responsive
- [ ] **7.4** Attack Narrative Trace Viewer (D3) — WebSocket consumer, color-coded cards, animated reveal, replay controls
- [ ] **7.5** Scenario List page — category tags, OWASP badges, difficulty, generate button
- [ ] **7.6** Classifier Results Table — taxonomy badges, severity badges, OWASP badges, confidence, justification
- [ ] **7.7** Reliability Scorecard — trend chart (line), per-category breakdown (bar/radar), OWASP risk profile
- [ ] **7.8** Comparison Mode — two-version side-by-side delta view
- [ ] **7.9** Run Drill-Down — individual scenario pass/fail, filterable by category/severity/OWASP
- [ ] **7.10** Red Team Chat (D4) — chat input, sends to backend, streams result in trace viewer
- [ ] **7.11** Reliability Report (D2) — full report view, print-to-PDF export
- [ ] **7.12** SVG Badge Generator (D2) — dynamic badge with score + grade

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
| Foundation | Done | 9/9 |
| Module 1 (Scenario Gen) | Done | 7/7 |
| Module 2 (Sandbox) | Done | 8/8 |
| Module 4 (Guardrail) | Done | 6/6 |
| Module 3 (Classifier) | Done | 8/8 |
| Module 5 (Scorecard) | Done | 8/8 |
| REST API (Task 8) | Done | 14 endpoints wired |
| Dashboard | Not started | 0/12 |
| Integration + Demo | Not started | 0/6 |
| Stretch (D6) | Not started | 0/5 |
| **Total** | | **49+/68** |
