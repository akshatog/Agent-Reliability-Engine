<div align="center">

# 🛡️ Agent Reliability Engine

### *Adversarial CI/CD for Autonomous AI Agents*

[![CI](https://github.com/akshatog/Agent-Reliability-Engine/actions/workflows/ci.yml/badge.svg)](https://github.com/akshatog/Agent-Reliability-Engine/actions/workflows/ci.yml)
![Tests](https://img.shields.io/badge/tests-216%20passing-brightgreen)
![Python](https://img.shields.io/badge/python-3.11%2B-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi)
![LangGraph](https://img.shields.io/badge/LangGraph-0.3+-blueviolet)
![Gemini](https://img.shields.io/badge/Gemini-2.5%20Flash%20%7C%20Pro-orange?logo=google)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql)
![License](https://img.shields.io/badge/license-MIT-green)

**Built for OOSC 4.0 Hackathon (Problem Statement 4) · IIIT Allahabad**

*Automatically generate adversarial scenarios, execute agents in a sandboxed environment, classify failures using an LLM judge, and track reliability trends — with full OWASP LLM Top 10 mapping.*

</div>

---

## 📋 Table of Contents

- [What Is This?](#-what-is-this)
- [Architecture](#-architecture)
- [Module Breakdown](#-module-breakdown)
- [OWASP LLM Top 10 Coverage](#-owasp-llm-top-10-coverage)
- [API Reference](#-api-reference)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Setup & Installation](#-setup--installation)
- [Running Tests](#-running-tests)
- [Development Progress](#-development-progress)
- [Key Design Decisions](#-key-design-decisions)

---

## 🎯 What Is This?

The **Agent Reliability Engine** is a CI/CD framework specifically designed for autonomous AI agents. Just as traditional software has unit tests and integration tests, AI agents need a way to be continuously evaluated for **safety, reliability, and correct behavior**.

This engine solves a critical problem: *how do you know if your AI agent will behave safely when it encounters adversarial inputs, unexpected tool responses, or high-stakes decisions?*

### The Core Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    FULL PIPELINE FLOW                       │
│                                                             │
│  1. GENERATE ──► 2. EXECUTE ──► 3. GUARD ──► 4. CLASSIFY  │
│                                                             │
│  Gemini Flash      Sandbox        Rule-based   Gemini Pro  │
│  generates         runs agent     checks for   judges the  │
│  adversarial       against        high-risk    trace and   │
│  scenarios         mocked tools   tool calls   classifies  │
│  per category      with trace     without      with OWASP  │
│                    capture        confirmation  mapping     │
│                         │                                   │
│                         ▼                                   │
│               5. SCORECARD (Wilson CI)                      │
│               Aggregate reliability metrics                 │
│               per-version + trend tracking                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AGENT RELIABILITY ENGINE                            │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        FRONTEND (Coming: Task 9)                      │  │
│  │              Next.js Dashboard · Dark Mode · Real-time                │  │
│  │          Trace Viewer · Scorecard Charts · Red Team Chat              │  │
│  └────────────────────────────┬─────────────────────────────────────────┘  │
│                               │ REST + WebSocket                           │
│  ┌────────────────────────────▼─────────────────────────────────────────┐  │
│  │                      FASTAPI BACKEND (Port 8000)                      │  │
│  │                                                                       │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────┐  │  │
│  │  │  REST Router  │  │  WebSocket   │  │      Dependency Injection  │  │  │
│  │  │  /api/*       │  │  /ws/traces  │  │      (DB Session, Settings)│  │  │
│  │  └──────┬───────┘  └──────┬───────┘  └────────────────────────────┘  │  │
│  │         │                 │                                           │  │
│  │  ┌──────▼─────────────────▼──────────────────────────────────────┐   │  │
│  │  │                    CORE MODULES                                │   │  │
│  │  │                                                                │   │  │
│  │  │  ┌─────────────────┐   ┌─────────────────┐                    │   │  │
│  │  │  │ Module 1        │   │ Module 2         │                    │   │  │
│  │  │  │ SCENARIO GEN    │   │ SANDBOX HARNESS  │                    │   │  │
│  │  │  │                 │   │                  │                    │   │  │
│  │  │  │ Gemini Flash +  │   │ LangGraph Agent  │                    │   │  │
│  │  │  │ 7 category      │   │ Mocked Tools     │                    │   │  │
│  │  │  │ prompt templates│   │ Trace Capture    │                    │   │  │
│  │  │  │ Structured JSON │   │ Timeout (60s)    │                    │   │  │
│  │  │  └────────┬────────┘   └────────┬─────────┘                   │   │  │
│  │  │           │                     │                              │   │  │
│  │  │  ┌────────▼────────┐   ┌────────▼─────────┐                   │   │  │
│  │  │  │ Module 4        │   │ Module 3          │                   │   │  │
│  │  │  │ GUARDRAIL TESTER│   │ FAILURE CLASSIFIER│                   │   │  │
│  │  │  │                 │   │                   │                   │   │  │
│  │  │  │ Rule-based      │   │ Gemini Pro Judge  │                   │   │  │
│  │  │  │ High-risk tool  │   │ Anti-sycophancy   │                   │   │  │
│  │  │  │ detection       │   │ Rubric + OWASP    │                   │   │  │
│  │  │  │ HELD/BYPASSED   │   │ LLM Top 10 Map    │                   │   │  │
│  │  │  └─────────────────┘   └────────┬──────────┘                  │   │  │
│  │  │                                 │                              │   │  │
│  │  │  ┌──────────────────────────────▼──────────────────────────┐  │   │  │
│  │  │  │ Module 5: SCORECARD & STATISTICS                         │  │   │  │
│  │  │  │ Overall Score · Per-category Breakdown · Wilson CI       │  │   │  │
│  │  │  │ Severity Distribution · OWASP Risk Profile · Trend       │  │   │  │
│  │  │  └─────────────────────────────────────────────────────────┘  │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  │                                                                    │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │               DEVOPS ASSISTANT AGENT                         │  │  │
│  │  │           (LangGraph · 3 Personas · 5 Tools)                 │  │  │
│  │  │   check_service_health  ·  rollback_deployment              │  │  │
│  │  │   restart_service       ·  delete_deployment                │  │  │
│  │  │   get_deployment_logs                                        │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                               │                                           │
│  ┌────────────────────────────▼─────────────────────────────────────────┐ │
│  │              NEON POSTGRESQL (Async · asyncpg · Alembic)              │ │
│  │                                                                       │ │
│  │  agent_versions  ·  scenarios  ·  runs  ·  classifications            │ │
│  │                  ·  guardrail_results                                 │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🧩 Module Breakdown

### Module 1 — Scenario Generation Engine
**File:** `backend/app/modules/scenario_generator.py`

Uses **Gemini 2.5 Flash** to automatically generate adversarial test scenarios across 7 failure categories. Each scenario includes a user message, expected safe behavior, mocked tool responses, and OWASP mapping.

- **Lazy initialization** via `@property` — no `GEMINI_API_KEY` needed at import time (CI-friendly)
- **7 category-specific prompt templates** — each tuned to elicit a specific failure mode
- **Structured JSON output** — Pydantic-validated at the source

### Module 2 — Sandbox Execution Harness
**File:** `backend/app/modules/sandbox_harness.py`

Executes the DevOps agent in a fully controlled environment with mocked tool responses. Captures every LangGraph step (LLM calls, tool calls, agent outputs) as a structured trace.

- **60-second hard timeout** — marks run as `TIMED_OUT`
- **Async `on_step` callback** — enables live WebSocket streaming during execution
- **Risk level annotation** — each trace step tagged with `none|low|high|critical`
- **Graceful error handling** — errors captured as trace steps, never crash the harness

### Module 3 — Failure Mode Classifier (LLM-as-Judge)
**File:** `backend/app/modules/failure_classifier.py`

Uses **Gemini 2.5 Pro** as a strict LLM judge to classify agent execution traces. The anti-sycophancy rubric explicitly instructs the model to err on the side of flagging failures.

- **7-category taxonomy** with detailed negative examples in the rubric
- **Pure `_derive_classification()`** function — fully testable without any LLM mocks
- **Robust normalization** — handles lowercase verdicts, null categories, invalid severities
- **Patchable `_get_client()`** — dependency-injectable Gemini client for clean testing

### Module 4 — Guardrail Tester (Rule-Based)
**File:** `backend/app/modules/guardrail.py`

Deterministic, rule-based detection of high-risk tool calls without user confirmation. 100% reproducible — identical traces always produce identical results.

- **Pattern A (prompt-based):** Checks if agent asked a confirmation question before calling a destructive tool
- **Pattern B (tool-based):** Checks if agent called a dedicated confirmation tool
- **Result:** `HELD` (safe) or `BYPASSED` (unsafe) per high-risk tool call detected

### Module 5 — Scorecard & Statistics
**Files:** `backend/app/modules/scorecard.py`, `backend/app/core/statistics.py`

Aggregates run results into a rich reliability report. Uses the **Wilson score confidence interval** (preferred over naive Wald interval) for statistically sound pass-rate confidence.

- **All 7 categories always pre-seeded** — frontend never receives missing keys
- **OWASP risk profile** — failure counts aggregated by OWASP LLM Top 10 code
- **Wilson score CI** — correct at boundary proportions (0% or 100% pass rate)
- **Trend tracking** — per-version scorecard enables regression detection

---

## 🔒 OWASP LLM Top 10 Coverage

Every failure is automatically mapped to the [OWASP LLM Top 10 (2025)](https://owasp.org/www-project-top-10-for-large-language-model-applications/):

| Failure Category | OWASP Code | OWASP Name |
|---|---|---|
| `PROMPT_INJECTION` | **LLM01** | Prompt Injection |
| `DESTRUCTIVE_ACTION` | **LLM06** | Excessive Agency |
| `GOAL_DRIFT` | **LLM06** | Excessive Agency |
| `WRONG_TOOL` | **LLM06** | Excessive Agency |
| `HALLUCINATED_CONFIDENCE` | **LLM09** | Misinformation |
| `PREMATURE_COMPLETION` | **LLM09** | Misinformation |
| `TOOL_CALL_LOOP` | **LLM10** | Unbounded Consumption |

---

## 📡 API Reference

Base URL: `http://localhost:8000`

### Agent Versions
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/agent-versions` | Create a new agent version |
| `GET` | `/api/agent-versions` | List all agent versions |

### Scenarios
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/scenarios/generate` | Generate adversarial scenarios (Gemini Flash) |
| `GET` | `/api/scenarios` | List all stored scenarios |

### Runs
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/runs/execute` | Execute a scenario against an agent version |
| `GET` | `/api/runs/{run_id}` | Get run with full execution trace |

### Classification & Guardrails
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/classify/{run_id}` | Classify a run with Gemini 2.5 Pro judge |
| `POST` | `/api/guardrail/check/{run_id}` | Run rule-based guardrail check |

### Scorecard
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/scorecard/{agent_version_id}` | Full scorecard for one version |
| `GET` | `/api/scorecard/trend` | Reliability trend across all versions |
| `GET` | `/api/scorecard/compare?version_a=...&version_b=...` | Side-by-side version comparison |

### WebSocket
| Endpoint | Description |
|---|---|
| `ws://localhost:8000/ws/traces` | Live trace streaming during execution |

### Utilities
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check |

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **API Framework** | FastAPI 0.115+ | Async REST + WebSocket |
| **Agent Framework** | LangGraph 0.3+ | Stateful agent execution |
| **LLM — Scenario Gen** | Gemini 2.5 Flash | Fast adversarial scenario generation |
| **LLM — Judge** | Gemini 2.5 Pro | High-quality failure classification |
| **Database** | PostgreSQL (Neon) | Persistent storage via asyncpg |
| **ORM** | SQLAlchemy 2.0 (async) | DB models + async session management |
| **Migrations** | Alembic | Versioned schema migrations |
| **Validation** | Pydantic v2 | Request/response + schema validation |
| **Testing** | pytest + pytest-asyncio | 216 tests, TDD Red-Green-Refactor |
| **CI/CD** | GitHub Actions | Runs full test suite on Python 3.11 + 3.12 |

---

## 📂 Project Structure

```
agent-reliability-engine/
│
├── backend/
│   ├── app/
│   │   ├── agents/
│   │   │   └── devops_agent.py          # LangGraph DevOps agent (3 personas, 5 tools)
│   │   ├── api/
│   │   │   ├── routes.py                # 14 REST API endpoints
│   │   │   └── websocket.py             # ConnectionManager for live trace streaming
│   │   ├── core/
│   │   │   ├── owasp_mapping.py         # D1: Static OWASP LLM Top 10 mapping
│   │   │   └── statistics.py            # D5: Wilson score confidence interval
│   │   ├── models/
│   │   │   └── entities.py              # SQLAlchemy ORM (5 tables)
│   │   ├── modules/
│   │   │   ├── scenario_generator.py    # Module 1: Gemini Flash scenario generation
│   │   │   ├── sandbox_harness.py       # Module 2: Sandboxed agent execution + trace
│   │   │   ├── failure_classifier.py    # Module 3: Gemini Pro LLM-as-judge
│   │   │   ├── guardrail.py             # Module 4: Rule-based guardrail checker
│   │   │   └── scorecard.py             # Module 5: Reliability scorecard aggregation
│   │   ├── schemas/
│   │   │   ├── agent_version.py         # AgentVersionCreate/Read
│   │   │   ├── classification.py        # Verdict, Severity, ClassificationCreate/Read
│   │   │   ├── guardrail.py             # GuardrailResultEnum, GuardrailResultRead
│   │   │   ├── run.py                   # RunCreate, RunRead, TraceStep, RunStatus
│   │   │   └── scenario.py              # FailureCategory, ScenarioCreate/Read
│   │   ├── config.py                    # Pydantic Settings (env vars)
│   │   ├── database.py                  # Async SQLAlchemy engine + session factory
│   │   └── main.py                      # FastAPI app + WebSocket + router wiring
│   ├── alembic/                         # DB migration versions
│   ├── tests/
│   │   ├── test_agent_version.py        # Agent version CRUD tests
│   │   ├── test_api.py                  # 21 API endpoint tests (live Neon DB)
│   │   ├── test_failure_classifier.py   # 27 classifier tests
│   │   ├── test_failure_classifier_edge_cases.py  # 13 edge case tests
│   │   ├── test_guardrail.py            # 20 guardrail determinism tests
│   │   ├── test_models.py               # ORM cascade + constraint tests
│   │   ├── test_sandbox_harness.py      # 27 harness tests
│   │   ├── test_sandbox_harness_edge_cases.py     # 20 edge case tests
│   │   ├── test_scenario_*.py           # Scenario generation tests
│   │   ├── test_scorecard.py            # 16 scorecard tests
│   │   ├── test_scorecard_edge_cases.py # 15 edge case tests
│   │   └── test_statistics.py           # 10 Wilson CI tests
│   ├── requirements.txt
│   └── pyproject.toml
│
├── frontend/                            # ⏳ Coming in Task 9 (Next.js)
│
├── .github/
│   └── workflows/
│       └── ci.yml                       # GitHub Actions (Python 3.11 + 3.12)
│
├── .specify/
│   ├── spec.md                          # Product specification
│   ├── constitution.md                  # Development workflow rules
│   └── task.md                          # Task progress tracker
│
└── docs/superpowers/plans/
    └── 2026-08-21-agent-reliability-engine.md   # Full TDD implementation plan
```

---

## ⚙️ Setup & Installation

### Prerequisites

- Python 3.11+
- PostgreSQL database (e.g., [Neon.tech](https://neon.tech) — free tier works)
- Google Gemini API Key ([Get one here](https://aistudio.google.com/app/apikey))

### 1. Clone the Repository

```bash
git clone https://github.com/akshatog/Agent-Reliability-Engine.git
cd Agent-Reliability-Engine
```

### 2. Backend Setup

```bash
cd backend
pip install -r requirements.txt
```

### 3. Environment Configuration

Create a `.env` file in the `backend/` directory:

```env
# Database — must use asyncpg driver
DATABASE_URL=postgresql+asyncpg://user:password@host/dbname?ssl=require

# Gemini API
GEMINI_API_KEY=your_gemini_api_key_here

# Model selection (defaults)
GEMINI_FLASH_MODEL=gemini-2.5-flash
GEMINI_PRO_MODEL=gemini-2.5-pro
```

### 4. Run Database Migrations

```bash
alembic upgrade head
```

### 5. Start the Backend Server

```bash
uvicorn app.main:app --reload --port 8000
```

The API is now available at `http://localhost:8000`. Visit `http://localhost:8000/docs` for the interactive Swagger UI.

---

## 🧪 Running Tests

### Full Test Suite (216 tests)

```bash
cd backend
python -m pytest tests/ -v
```

### Run Specific Module Tests

```bash
# Failure Classifier (Module 3)
python -m pytest tests/test_failure_classifier.py tests/test_failure_classifier_edge_cases.py -v

# Sandbox Harness (Module 2)
python -m pytest tests/test_sandbox_harness.py tests/test_sandbox_harness_edge_cases.py -v

# Scorecard & Statistics (Module 5)
python -m pytest tests/test_scorecard.py tests/test_scorecard_edge_cases.py tests/test_statistics.py -v

# API Endpoints (live DB — requires .env)
python -m pytest tests/test_api.py -v
```

### Test Architecture

All tests follow strict **Red-Green-Refactor TDD**:
- Tests are written *before* implementation
- Each module has both happy-path and edge-case test files
- API tests use transaction rollback (SAVEPOINT) against the real Neon database — no mocking, no in-memory SQLite
- LLM-dependent tests (`classify_run`, `generate_scenarios`) mock the Gemini client via `patch("..._get_client")`

---

## 📊 Development Progress

| Task | Module | Status | Tests |
|---|---|---|---|
| Task 1: Skeleton + DB Models + Schemas | Foundation | ✅ Done | — |
| Task 2: DevOps Assistant Agent | LangGraph | ✅ Done | — |
| Task 3: Guardrail Tester | Module 4 | ✅ Done | 20 tests |
| Task 4: Scenario Generation Engine | Module 1 | ✅ Done | 22 tests |
| CI/CD + DB Hardening | GitHub Actions + Alembic | ✅ Done | — |
| Task 5: Sandbox Execution Harness | Module 2 | ✅ Done | 47 tests |
| Task 6: Failure Mode Classifier | Module 3 | ✅ Done | 40 tests |
| Task 7: Scorecard & Statistics | Module 5 + D5 | ✅ Done | 41 tests |
| Task 8: REST API + Pipeline Wiring | 14 endpoints | ✅ Done | 21 tests |
| **Total** | | **✅ 216/216 passing** | |
| Task 9: Next.js Dashboard | Frontend | ⏳ Pending | — |
| Task 10: Integration + Demo | Full pipeline | ⏳ Pending | — |

---

## 🎓 Key Design Decisions

### Why Wilson Score Interval?
The naive Wald interval (`p ± z√(p(1-p)/n)`) breaks at boundary proportions — it gives `(0, 0)` for 0% pass rate even with 100 samples. The Wilson score interval is mathematically correct at all proportions and sample sizes, which matters when early-stage agents fail 100% of the time.

### Why Separate `_derive_classification()` from `classify_run()`?
`_derive_classification()` is a pure function (no I/O) that handles all post-processing of the LLM's raw JSON. This means 20+ of the 40 classifier tests run in <1ms without any network calls or mocking. The async `classify_run()` only handles the Gemini API call and JSON parsing — everything else is testable deterministically.

### Why `_get_client()` Instead of Module-Level Gemini Client?
Module-level initialization would crash any test suite that imports `failure_classifier` without a `GEMINI_API_KEY` in the environment. By isolating client creation in `_get_client()`, tests can `patch("app.modules.failure_classifier._get_client")` cleanly. This same pattern is used in `ScenarioGenerator` via the `@property llm` lazy initializer.

### Why Transaction Rollback for API Tests?
Using `SAVEPOINT`-based rollback (instead of a separate test database or in-memory SQLite) means API tests run against the *exact same schema, constraints, and indexes* as production. Tests catch real FK constraint violations, unique constraint violations, and type mismatches that in-memory SQLite would silently ignore.

### Why Pre-Seed All 7 Categories in Scorecard?
The frontend's bar charts and radar charts expect a predictable dict structure. Pre-seeding all 7 categories at `fail_count: 0` eliminates defensive `?.` checks in the dashboard JavaScript and ensures charts render correctly even on the first run with zero failures.

---

## 🔗 Links

- 📖 [Swagger UI (when running)](http://localhost:8000/docs)
- 📊 [ReDoc API Docs (when running)](http://localhost:8000/redoc)
- 🧪 [CI/CD Pipeline](https://github.com/akshatog/Agent-Reliability-Engine/actions)
- 📋 [Implementation Plan](docs/superpowers/plans/2026-08-21-agent-reliability-engine.md)

---

<div align="center">

Built with ❤️ using **Superpowers SDD/TDD** methodology · OOSC 4.0 Hackathon

</div>
