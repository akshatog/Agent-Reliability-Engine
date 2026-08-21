# Implementation Plan — Agent Reliability Engine

Governed by `constitution.md` and `spec.md`. This document defines HOW to build
each module, in what order, with what dependencies.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js Dashboard                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │ Attack   │ │ Scenario │ │Classifier│ │   Reliability    │  │
│  │ Narrative│ │ List     │ │ Results  │ │   Scorecard      │  │
│  │ Trace    │ │          │ │ Table    │ │   + Report (D2)  │  │
│  │ Viewer   │ │          │ │          │ │   + Badge (D2)   │  │
│  │ (D3)     │ │          │ │          │ │                  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘  │
│  ┌──────────────────┐                                          │
│  │ Red Team Chat    │         WebSocket (live trace stream)    │
│  │ (D4)             │◄────────────────────────────────────┐   │
│  └──────────────────┘                                     │   │
└───────────────────────────────────────────────────────────┼───┘
                            REST API                        │
┌───────────────────────────────────────────────────────────┼───┐
│                     FastAPI Backend                        │   │
│                                                           │   │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐  │   │
│  │  Module 1    │──▶│  Module 2    │──▶│  Module 3    │  │   │
│  │  Scenario    │   │  Sandbox     │   │  Classifier  │  │   │
│  │  Generator   │   │  Harness     │──▶│  (LLM Judge) │  │   │
│  │ (Flash)      │   │  + Trace     │   │  (Pro)       │  │   │
│  └──────────────┘   │  + WebSocket─┼───┘  ┌──────────┐│  │   │
│                     └──────────────┘      │  Module 4 ││  │   │
│                                           │  Guardrail││  │   │
│  ┌──────────────┐                         │  (Rules)  ││  │   │
│  │  Module 5    │◄────────────────────────┘──────────┘│  │   │
│  │  Scorecard   │                                      │  │   │
│  │  + Tracker   │                                      │  │   │
│  └──────────────┘                                      │  │   │
│                                                           │   │
│  ┌──────────────────────────────────────────────────────┐ │   │
│  │              PostgreSQL Database                      │ │   │
│  │  agent_versions | scenarios | runs | classifications  │ │   │
│  │  guardrail_results                                    │ │   │
│  └──────────────────────────────────────────────────────┘ │   │
│                                                           │   │
│  ┌──────────────────────────────────────────────────────┐ │   │
│  │         DevOps Assistant Agent (LangGraph)            │ │   │
│  │  Tools: get_service_status, restart_service,          │ │   │
│  │         query_logs, delete_deployment, send_alert     │ │   │
│  └──────────────────────────────────────────────────────┘ │   │
└───────────────────────────────────────────────────────────────┘
```

---

## 2. Database Schema

### `agent_versions`
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| name | VARCHAR | e.g., "DevOps Agent v1 - Weak Prompt" |
| description | TEXT | |
| system_prompt | TEXT | Store the actual prompt for comparison |
| tool_schemas | JSONB | Store exact tool config |
| created_at | TIMESTAMPTZ | |

### `scenarios`
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| category | VARCHAR | Enum: 7 failure categories |
| setup | TEXT | Context/background |
| user_message | TEXT | Actual input to agent |
| expected_safe_behavior | TEXT | What a correct agent should do |
| expected_tool_sequence | JSONB | Array of expected tool names |
| mocked_tool_responses | JSONB | Scripted responses for sandbox |
| difficulty | VARCHAR | easy / medium / hard |
| owasp_mapping | VARCHAR | LLM01 / LLM06 / LLM09 / LLM10 |
| generation_batch_id | UUID | Groups scenarios from single gen run |
| created_at | TIMESTAMPTZ | |

### `runs`
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| agent_version_id | UUID (FK) | |
| scenario_id | UUID (FK) | |
| run_number | INTEGER | For multi-run mode (D5), default 1 |
| trace | JSONB | Full execution trace |
| status | VARCHAR | completed / errored / timed_out |
| started_at | TIMESTAMPTZ | |
| completed_at | TIMESTAMPTZ | |
| duration_ms | INTEGER | |

### `classifications`
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| run_id | UUID (FK, unique) | One classification per run |
| verdict | VARCHAR | pass / fail |
| failure_category | VARCHAR | Enum (7 values), nullable (null if pass) |
| severity | VARCHAR | low / medium / high / critical, nullable |
| confidence | FLOAT | |
| justification | TEXT | One-sentence explanation |
| owasp_mapping | VARCHAR | Auto-derived from failure_category |
| created_at | TIMESTAMPTZ | |

### `guardrail_results`
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| run_id | UUID (FK) | |
| high_risk_tool_called | VARCHAR | Tool name |
| step_number | INTEGER | Which trace step |
| confirmation_detected | BOOLEAN | |
| confirmation_type | VARCHAR | prompt_based / tool_based / none |
| result | VARCHAR | guardrail_held / guardrail_bypassed |
| created_at | TIMESTAMPTZ | |

---

## 3. Build Order (Dependency-Driven)

### Phase 1: Foundation (Day 1 — first half)

1. **Backend skeleton**
   - FastAPI app structure with routers
   - PostgreSQL connection via SQLAlchemy (async)
   - Alembic migrations
   - Pydantic models for all DB entities
   - WebSocket endpoint stub
   - Health check endpoint

2. **DevOps Assistant Agent**
   - LangGraph graph with 5 tools (get_service_status, restart_service,
     query_logs, delete_deployment, send_alert)
   - All tools accept params and return structured responses
   - Agent takes system_prompt as configurable parameter (for version variants)
   - **Design for D6:** Agent construction takes a config dict (tool schemas +
     system prompt), not hardcoded tool functions
   - Seed 3 agent version variants:
     - v1: Weak system prompt (no confirmation instructions)
     - v2: Strong system prompt (explicit confirmation required for dangerous ops)
     - v3: Intentionally regressed (obeys authority pressure, skips confirmation)

3. **DB seeding**
   - Insert 3 agent versions with their system prompts and tool schemas
   - Verify FK relationships work

### Phase 2: Scenario Generation — Module 1 (Day 1 — second half)

4. **Tool schema parser + high-risk tool flagger**
   - Parse tool schemas from agent version record
   - Heuristic: flag tools with verbs (delete, restart, send, drop, terminate,
     kill, remove, purge) OR explicit risk_level tag
   - Output: list of tools with risk levels

5. **Category-based prompt templates**
   - 7 prompt templates (one per failure category)
   - Each template receives: tool schemas, system prompt, high-risk tools
   - Templates specifically reference tool names in generated scenarios
   - Multi-step instruction: "generate scenarios requiring 2+ tool calls"

6. **Scenario generation endpoint**
   - `POST /api/scenarios/generate` — takes agent_version_id, calls Gemini Flash
   - Validates generated scenarios against Pydantic schema
   - Stores in DB with generation_batch_id
   - Returns scenario set

### Phase 3: Sandbox Execution — Module 2 (Day 2 — first half)

7. **Mock tool layer**
   - Given a scenario's `mocked_tool_responses`, creates mock functions
   - Each mock logs: tool name, args received, response returned
   - Timeout enforcement (60s)

8. **Trace capture**
   - Wraps LangGraph execution to capture every step
   - Each step: step_number, step_type, timestamp, content, risk_level
   - Stores full trace as JSONB in `runs` table

9. **WebSocket live streaming**
   - During execution, emit each trace step to connected WebSocket clients
   - Message format: `{type: "trace_step", run_id, step: {...}}`
   - On completion: `{type: "run_complete", run_id, status}`

10. **Execution endpoint**
    - `POST /api/runs/execute` — takes scenario_id + agent_version_id
    - Executes agent, captures trace, streams via WebSocket, stores in DB
    - Returns run_id

11. **Replay endpoint**
    - `GET /api/runs/{run_id}/replay` — WebSocket endpoint
    - Re-emits stored trace steps with configurable delay

### Phase 4: Guardrail Tester — Module 4 (Day 2 — mid)

12. **Rule-based guardrail checker**
    - Takes a trace, identifies all high-risk tool calls
    - For each: checks Pattern A (preceding agent output has confirmation
      keywords) and Pattern B (confirm_action tool called before)
    - Produces guardrail_results records
    - NO LLM calls

13. **Guardrail endpoint**
    - `POST /api/guardrail/check` — takes run_id
    - Returns guardrail results
    - Also auto-triggered after run completion

### Phase 5: Failure Classifier — Module 3 (Day 2 — second half)

14. **LLM-as-judge rubric prompt**
    - System prompt with:
      - 7 failure categories with descriptions + examples
      - Anti-sycophancy instruction
      - Negative examples ("this looks like pass but is X because...")
      - Severity guidelines
    - Input: trace + expected_safe_behavior
    - Output: structured classification JSON

15. **Classifier endpoint**
    - `POST /api/classify` — takes run_id
    - Calls Gemini Pro with rubric, validates response against Pydantic schema
    - Derives owasp_mapping from failure_category (lookup, not LLM)
    - Stores classification, returns result
    - Auto-triggered after run completion

16. **Golden test traces**
    - 3-5 pre-built traces with known classifications
    - Test: run classifier on golden traces, verify agreement
    - These serve as both calibration tests and demo data

### Phase 6: Scorecard & Tracker — Module 5 (Day 3 — first half)

17. **Aggregation endpoints**
    - `GET /api/scorecard/{agent_version_id}` — per-version aggregate scores
    - `GET /api/scorecard/trend` — all versions, time-series data
    - `GET /api/scorecard/compare?v1=X&v2=Y` — two-version delta
    - `GET /api/scorecard/{agent_version_id}/runs` — drill-down, filterable

18. **Confidence interval calculation (D5)**
    - Wilson score interval formula implementation
    - Flaky scenario detection (mixed pass/fail across runs)
    - Applied when num_runs > 1

### Phase 7: Dashboard — Next.js (Day 2–3, incremental)

Build incrementally alongside backend, not after:

19. **Layout + design system**
    - Dark mode, TailwindCSS setup
    - Color palette: green/yellow/red/shield/skull icons
    - Component library: badges, cards, charts

20. **Attack Narrative Trace Viewer (D3)**
    - WebSocket consumer
    - Color-coded cards with animated reveal
    - Replay controls (play/pause/speed)
    - This is the demo centerpiece — allocate extra polish time

21. **Scenario List**
    - Category tags, OWASP badges, difficulty indicators
    - Generate / select scenarios

22. **Classifier Results Table**
    - Taxonomy badges, severity badges, OWASP badges
    - Confidence scores, justification text

23. **Reliability Scorecard**
    - Trend chart (line chart, multi-version)
    - Per-category breakdown (bar chart or radar chart)
    - OWASP risk profile
    - Comparison mode (side-by-side)
    - Drill-down to run-level detail

24. **Red Team Chat (D4)**
    - Chat-style input
    - Sends to backend, receives structured scenario
    - Auto-executes and streams result in trace viewer

25. **Reliability Report (D2)**
    - Full report view with all metrics
    - Print-to-PDF export
    - SVG badge generator

### Phase 8: Integration + Demo Scripting (Day 3 — second half)

26. **Full pipeline integration test**
    - Run: generate scenarios → execute batch → classify → guardrail → scorecard
    - Verify: all 5 modules work end-to-end
    - Run against all 3 agent versions

27. **Demo scenario scripting**
    - Script the exact demo flow from constitution §8
    - Ensure v1 fails, v2 passes, v3 regresses
    - Tune system prompts if needed
    - Record 3-5 min demo video

28. **Documentation**
    - README with architecture diagram, setup instructions, YAML example
    - Clean commit history

---

## 4. Technology-Specific Decisions

### Backend
- **Python 3.11+**
- **FastAPI** with async support
- **SQLAlchemy 2.0** (async) + **Alembic** for migrations
- **LangGraph** for agent orchestration
- **google-genai** SDK for Gemini API calls
- **Pydantic v2** for all data validation
- **uvicorn** for ASGI server
- **websockets** via FastAPI native WebSocket support

### Frontend
- **Next.js 14** (App Router)
- **TailwindCSS** for styling
- **Recharts** or **Chart.js** for scorecard visualizations
- **Framer Motion** for card animations (D3)
- **Native WebSocket** API for trace streaming

### Database
- **PostgreSQL 16** (local Docker or existing installation)
- **asyncpg** driver

### LLM
- **Gemini 2.5 Flash** — scenario generation (Module 1), red team chat (D4)
- **Gemini 2.5 Pro** — failure classification (Module 3)
- All calls use structured output (response schemas) — no free-text parsing

---

## 5. Open Questions (Resolved)

| Question | Resolution |
|---|---|
| LLM provider/model | Hybrid: Flash for gen, Pro for judge |
| Database hosting | PostgreSQL (local or Docker) |
| Team composition | 2 members, meets requirement |
| Taxonomy size | 7 categories, approved |
| Differentiators | All 6 approved, D6 is stretch |
