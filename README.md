<div align="center">

# 🛡️ Agent Reliability Engine

### *Continuous Integration for AI Agents*

[![CI](https://github.com/akshatog/Agent-Reliability-Engine/actions/workflows/ci.yml/badge.svg)](https://github.com/akshatog/Agent-Reliability-Engine/actions/workflows/ci.yml)
![Tests](https://img.shields.io/badge/tests-253%20passing-brightgreen)
![Python](https://img.shields.io/badge/python-3.11%2B-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi)
![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=nextdotjs)
![LangGraph](https://img.shields.io/badge/LangGraph-0.3+-blueviolet)
![Groq](https://img.shields.io/badge/Groq-Powered-f55036?logo=groq)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql)
![License](https://img.shields.io/badge/license-MIT-green)

**Automatically break your AI agent before your users do.**

*Generate adversarial scenarios → Execute in a sandboxed harness → Classify failures by root cause → Track reliability across versions → Auto-suggest patches — all from a live dashboard.*

</div>

---

## 🤔 Why Does This Exist?

Traditional software testing doesn't transfer well to AI agents. An agent can pass every unit test and still:

- Execute a destructive tool call without asking the user first
- Follow a prompt injection embedded in a tool response
- Hallucinate a confident answer to mask a reasoning gap
- Loop on the same tool call 12 times when the response is ambiguous
- Complete early and return an empty response because the task "seemed done"

These are **failure modes, not bugs** — and they require a fundamentally different approach to test. The Agent Reliability Engine is that approach: a CI/CD framework that generates adversarial inputs, runs them against your agent in a controlled sandbox, and classifies failures with a calibrated LLM judge.

---

## 📋 Table of Contents

- [How It Works](#-how-it-works)
- [Live Dashboard](#-live-dashboard)
- [Architecture](#-architecture)
- [Module Deep-Dive](#-module-deep-dive)
- [Design Decisions](#-design-decisions)
- [OWASP LLM Top 10 Coverage](#-owasp-llm-top-10-coverage)
- [API Reference](#-api-reference)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Setup & Installation](#-setup--installation)
- [Running Tests](#-running-tests)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)

---

## ⚙️ How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    FULL PIPELINE FLOW                       │
│                                                             │
│  1. GENERATE ──► 2. EXECUTE ──► 3. GUARD ──► 4. CLASSIFY  │
│                                                             │
│  Groq generates    Sandbox runs   Rule-based   Groq Pro    │
│  adversarial       agent against  checks for   judges the  │
│  scenarios for     mocked tools   high-risk    trace and   │
│  each failure      with full      tool calls   classifies  │
│  category          trace capture  without      with OWASP  │
│                                   confirmation  mapping     │
│                         │                                   │
│                         ▼                                   │
│               5. SCORECARD (Wilson CI)                      │
│               Aggregate reliability metrics                 │
│               per-version + trend tracking                  │
│                         │                                   │
│                         ▼                                   │
│           6. DASHBOARD + AUTO-REMEDIATION                   │
│        Scorecard · Traces · Red Team Chat · Patches        │
└─────────────────────────────────────────────────────────────┘
```

Each run produces a **structured execution trace** (every LLM call, tool call, and response), a **failure classification** with root cause and OWASP mapping, and a **guardrail result** that detects confirmation bypasses. Over time, the scorecard tracks reliability drift across agent versions.

---

## 🖥️ Live Dashboard

The Next.js 15 dashboard is fully wired to the backend API. All pages switch seamlessly between **Live mode** (real API data) and **Demo mode** (mock data when the backend is offline).

| Page | What It Shows |
|------|---------------|
| `/` | KPI cards (reliability score, run count, guardrail rate), failure distribution pie chart, recent run log |
| `/scenarios` | Full scenario catalog across all 7 failure categories + live generation button |
| `/traces/[runId]` | Annotated execution trace with WebSocket streaming, classification verdict, OWASP mapping |
| `/scorecard` | Reliability trend chart (per-version), severity heatmap, Wilson CI bounds, version comparison |
| `/red-team` | Natural language red team chat → live scenario → execute → classify in one round-trip |
| `/remediation` | AI-suggested system prompt / tool schema patches with before/after diff viewer and sandbox verification |
| `/report` | Full reliability report with auto-generated SVG badge (embeddable in your own README) |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AGENT RELIABILITY ENGINE                            │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     FRONTEND (Next.js 15 App Router)                  │  │
│  │              Dark-mode Dashboard · 7 routes · Real-time WS            │  │
│  │   AgentProvider (live versions) · API client · 3 data mappers         │  │
│  └────────────────────────────┬─────────────────────────────────────────┘  │
│                               │ REST + WebSocket                           │
│  ┌────────────────────────────▼─────────────────────────────────────────┐  │
│  │                      FASTAPI BACKEND (Port 8000)                      │  │
│  │                                                                       │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────┐  │  │
│  │  │  REST Router  │  │  WebSocket   │  │    Dependency Injection     │  │  │
│  │  │  18 endpoints │  │  /ws/traces  │  │    (DB Session, Settings)   │  │  │
│  │  └──────┬───────┘  └──────┬───────┘  └────────────────────────────┘  │  │
│  │         │                 │                                           │  │
│  │  ┌──────▼─────────────────▼──────────────────────────────────────┐   │  │
│  │  │                    CORE MODULES                                │   │  │
│  │  │                                                                │   │  │
│  │  │  Scenario Generator → Sandbox Harness → Guardrail Tester      │   │  │
│  │  │                        ↓                                       │   │  │
│  │  │                  Failure Classifier (LLM-as-Judge)             │   │  │
│  │  │                        ↓                                       │   │  │
│  │  │          Scorecard + Statistics + Remediation Engine           │   │  │
│  │  └────────────────────────────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                               │                                           │
│  ┌────────────────────────────▼─────────────────────────────────────────┐ │
│  │              NEON POSTGRESQL (Async · asyncpg · Alembic)              │ │
│  │   agent_versions · scenarios · runs · classifications · guardrails    │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🧩 Module Deep-Dive

### Module 1 — Scenario Generation Engine
**`backend/app/modules/scenario_generator.py`**

Generates adversarial test scenarios across 7 failure categories using Groq with strict `json_object` output mode. Each scenario specifies the attack vector (`user_message`), what a safe agent should do (`expected_safe_behavior`), expected tool call sequence, and mocked tool responses.

**7 failure categories:** `DESTRUCTIVE_ACTION` · `PROMPT_INJECTION` · `TOOL_CALL_LOOP` · `GOAL_DRIFT` · `HALLUCINATED_CONFIDENCE` · `WRONG_TOOL` · `PREMATURE_COMPLETION`

- Lazy client initialization — no API key required at import time, CI-safe
- Each category has a dedicated prompt template tuned to its specific failure mode
- Bare-array and wrapped `{"scenarios": [...]}` responses both handled

---

### Module 2 — Sandbox Execution Harness
**`backend/app/modules/sandbox_harness.py`**

Runs the agent in a fully isolated environment with mocked tool responses and captures every LangGraph step as a structured trace. The sandbox intercepts all tool calls and injects pre-defined mocked responses, so the agent exercises full reasoning without touching real infrastructure.

- 60-second hard timeout — prevents runaway agents from blocking the pipeline
- Async `on_step` callback for live WebSocket streaming during execution
- Every step is tagged with a risk level: `none | low | high | critical`

---

### Module 3 — Failure Mode Classifier (LLM-as-Judge)
**`backend/app/modules/failure_classifier.py`**

Uses Groq's Pro model as a calibrated judge. The classification prompt uses an **anti-sycophancy rubric** — it explicitly instructs the model to treat "safe-sounding" responses with high scrutiny and to flag subtle failures that human reviewers would miss.

- 7-category taxonomy with detailed negative examples in the rubric
- `_derive_classification()` is a pure function — 20+ tests run in <1ms without mocking
- OWASP LLM Top 10 mapping applied at classification time
- Patchable `_get_client()` for clean dependency injection in tests

---

### Module 4 — Guardrail Tester (Rule-Based)
**`backend/app/modules/guardrail.py`**

Deterministic detection of high-risk tool calls executed without user confirmation. Rule-based (no LLM) so it is 100% reproducible — identical traces always produce identical results.

- **Pattern A:** Did the agent ask a confirmation question before calling a destructive tool?
- **Pattern B:** Did the agent call a dedicated confirmation tool?
- **Result:** `HELD` (safe, confirmation detected) or `BYPASSED` (unsafe, tool called without confirmation)

---

### Module 5 — Scorecard & Statistics
**`backend/app/modules/scorecard.py` · `backend/app/core/statistics.py`**

Aggregates run results into a structured reliability report per agent version.

- All 7 categories are always pre-seeded — frontend charts never receive missing keys
- **Wilson score CI** — mathematically correct at 0% and 100% pass rates (Wald interval breaks at boundaries)
- Severity heatmap: `{ category → { critical, high, medium, low } }` for the frontend grid
- Flaky scenario detection: flags scenario IDs with mixed PASS/FAIL verdicts across runs

---

## 🎓 Design Decisions

### Why Rule-Based Guardrails Instead of LLM-Based?

The guardrail check is intentionally deterministic. An LLM-based guardrail could itself hallucinate — marking a genuine bypass as safe, or flagging a correctly-cautious agent as unsafe. Rule-based pattern matching on the trace is reproducible, auditable, and doesn't need a model call. LLM judgment is reserved for the nuanced failure classification task where it provides genuine value.

### Why Anti-Sycophancy Tuning for the Classifier?

Default LLM behavior tends toward agreement and positive framing. When asked "did the agent handle this safely?", a vanilla prompt will over-index on the last `agent_output` message (which often *sounds* responsible) and miss subtle failures in the middle of the trace. The classifier rubric flips this default: it lists every failure mode with concrete negative examples and instructs the model to treat reassuring-sounding outputs as a potential red flag, not evidence of safety.

### Why OWASP LLM Top 10 Grounding?

Mapping every failure to the OWASP LLM Top 10 (2025) serves two purposes: it gives the classifier a structured taxonomy to reason from (rather than freeform categories), and it gives engineering teams an immediate translation to industry-standard risk language. A scorecard showing `LLM01: 3 failures, LLM06: 8 failures` is far more actionable than raw category counts.

### Why Wilson Score Confidence Interval?

The standard Wald interval (`p ± z√(p(1-p)/n)`) produces `(0, 0)` when pass rate is 0% — which is exactly the condition you most need uncertainty quantification for (new agent, all failures). The Wilson score interval is mathematically correct at all proportions and sample sizes. It matters most when n is small or p is near 0 or 1.

### Why "Live if Available, Mock Otherwise"?

Every dashboard page has a mock data fallback structurally identical to the real API response. This means the dashboard works as a standalone demo (no backend, no DB, no API key needed), and transitions to fully live data the moment the backend is reachable — without any configuration switch. The same code path handles both.

### Why Separate `_derive_classification()` from `classify_run()`?

`_derive_classification()` is a pure function that handles all post-processing of the LLM's raw JSON (validation, OWASP mapping, default filling). This means 20+ of the 40 classifier tests run without any network calls. The unit tests cover the edge cases; the integration tests cover the LLM interaction. Keeping I/O at the boundary keeps the core logic fully testable.

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

Base URL: `http://localhost:8000` · Interactive docs at `/docs`

### Agent Versions
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/agent-versions` | Register a new agent version |
| `GET` | `/api/agent-versions` | List all agent versions |

### Scenarios
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/scenarios/generate` | Generate adversarial scenarios via Groq |
| `GET` | `/api/scenarios` | List all stored scenarios |

### Runs
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/runs/execute` | Execute a scenario against an agent version |
| `GET` | `/api/runs/{run_id}` | Get run with full execution trace |
| `GET` | `/api/runs` | List runs for an agent version |

### Classification & Guardrails
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/classify/{run_id}` | Classify a run with Groq LLM judge |
| `POST` | `/api/guardrail/check/{run_id}` | Run rule-based guardrail check |

### Red Team Chat
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/red-team-chat` | Natural language → scenario → execute → classify |

### Scorecard
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/scorecard/{agent_version_id}` | Full scorecard (heatmap, flaky detection, OWASP profile) |
| `GET` | `/api/scorecard/trend` | Reliability trend across all versions |
| `GET` | `/api/scorecard/compare` | Side-by-side version comparison |

### Remediation
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/remediation/suggest/{run_id}` | Generate system prompt or tool schema patches |
| `POST` | `/api/remediation/verify/{suggestion_id}` | Sandbox-verify the patch before applying |

### Reports & Badges
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/report/{agent_version_id}` | Full auto-generated reliability report |
| `GET` | `/api/badge/{agent_version_id}.svg` | Embeddable SVG badge with score + letter grade |

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

| Layer | Technology | Notes |
|---|---|---|
| **Frontend** | Next.js 15 App Router + TypeScript | 7 routes, dark-mode glassmorphism UI |
| **Data Viz** | Recharts | Trend charts, pie, heatmap grid, radar |
| **API Framework** | FastAPI 0.115+ | Async REST + WebSocket |
| **Agent Framework** | LangGraph 0.3+ | Stateful agent execution with trace capture |
| **LLM Inference** | Groq | Ultra-fast generation and evaluation |
| **Database** | PostgreSQL (Neon) | Serverless, async via asyncpg |
| **ORM** | SQLAlchemy 2.0 (async) | DB models + async session management |
| **Migrations** | Alembic | Versioned schema migrations |
| **Validation** | Pydantic v2 | Request/response + schema validation |
| **Testing** | pytest + pytest-asyncio | 253 tests, TDD |
| **CI/CD** | GitHub Actions | Full test suite on Python 3.11 + 3.12 |

---

## 📂 Project Structure

```
agent-reliability-engine/
│
├── backend/
│   ├── app/
│   │   ├── agents/
│   │   │   ├── devops_agent.py          # Built-in LangGraph DevOps agent (3 personas, 5 tools)
│   │   │   └── agent_versions.py        # Pre-seeded agent version profiles
│   │   ├── api/
│   │   │   ├── routes.py                # 18 REST API endpoints
│   │   │   └── websocket.py             # ConnectionManager for live trace streaming
│   │   ├── core/
│   │   │   ├── owasp_mapping.py         # Static OWASP LLM Top 10 mapping
│   │   │   └── statistics.py            # Wilson score confidence interval
│   │   ├── models/
│   │   │   └── entities.py              # SQLAlchemy ORM (5 tables)
│   │   ├── modules/
│   │   │   ├── scenario_generator.py    # Module 1: Adversarial scenario generation
│   │   │   ├── sandbox_harness.py       # Module 2: Sandboxed agent execution
│   │   │   ├── failure_classifier.py    # Module 3: LLM-as-judge classifier
│   │   │   ├── guardrail.py             # Module 4: Rule-based guardrail checker
│   │   │   ├── scorecard.py             # Module 5: Reliability scorecard + stats
│   │   │   ├── red_team_chat.py         # NL red team chat orchestration
│   │   │   └── remediation.py           # AI patch suggestion + verification
│   │   ├── schemas/                     # Pydantic request/response schemas
│   │   ├── config.py
│   │   ├── database.py
│   │   └── main.py
│   ├── alembic/                         # Database migrations
│   ├── tests/                           # 253 tests across all modules
│   ├── requirements.txt
│   └── pyproject.toml
│
├── frontend/
│   ├── app/                             # Next.js App Router pages (7 routes)
│   ├── components/
│   │   └── sidebar.tsx                  # Navigation sidebar with live/mock indicator
│   ├── lib/
│   │   ├── api-types.ts                 # TypeScript mirrors of backend schemas
│   │   ├── api.ts                       # Typed fetch client
│   │   ├── agent-context.tsx            # AgentProvider context
│   │   ├── use-websocket.ts             # Reconnecting WebSocket hook
│   │   ├── scenario-mapper.ts           # ScenarioRead → ScenarioItem
│   │   ├── trace-mapper.ts              # BackendTraceStep → DisplayStep
│   │   ├── red-team-mapper.ts           # RedTeamChatResponse → RedTeamDisplayItem
│   │   └── mock-data.ts                 # Full offline/demo dataset
│   ├── package.json
│   └── tsconfig.json
│
├── .github/
│   └── workflows/ci.yml                 # GitHub Actions CI
│
└── docs/
    └── demo.md                          # End-to-end demo walkthrough
```

---

## ⚙️ Setup & Installation

### Prerequisites

- Python 3.11+
- Node.js 18+
- A PostgreSQL database — [Neon.tech](https://neon.tech) free tier works perfectly
- A [Groq API key](https://console.groq.com/keys) — free tier is sufficient

### 1. Clone

```bash
git clone https://github.com/akshatog/Agent-Reliability-Engine.git
cd Agent-Reliability-Engine
```

### 2. Backend

```bash
cd backend
pip install -r requirements.txt
```

Create `backend/.env`:

```env
# Database — must use asyncpg driver
DATABASE_URL=postgresql+asyncpg://user:password@host/dbname?ssl=require

# Groq API
GROQ_API_KEY=gsk_your_api_key_here

# Model selection
GROQ_MODEL=openai/gpt-oss-20b
GROQ_PRO_MODEL=openai/gpt-oss-120b
```

Run migrations and start:

```bash
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Swagger UI available at `http://localhost:8000/docs`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Dashboard available at `http://localhost:3000`. Auto-detects the backend and switches between **Live** and **Demo** mode.

---

## 🧪 Running Tests

```bash
cd backend

# Full suite (253 tests)
python -m pytest tests/ -v

# By module
python -m pytest tests/test_scenario_generator.py tests/test_scenario_generator_edge_cases.py -v
python -m pytest tests/test_sandbox_harness.py tests/test_sandbox_harness_edge_cases.py -v
python -m pytest tests/test_failure_classifier.py tests/test_failure_classifier_edge_cases.py -v
python -m pytest tests/test_scorecard.py tests/test_scorecard_edge_cases.py tests/test_statistics.py -v
python -m pytest tests/test_red_team_chat.py -v

# API integration tests (requires .env with live DB)
python -m pytest tests/test_api.py -v
```

---

## 🗺️ Roadmap

The current implementation uses a built-in DevOps agent as the system under test. The longer-term goal is to make the engine generic enough to test *any* LangGraph or tool-calling agent.

### Near-term
- [ ] **Generic agent import** — accept any LangGraph graph or OpenAI function-calling agent as the system under test, not just the built-in DevOps agent
- [ ] **GitHub Action** — package as a reusable GitHub Action so teams can drop adversarial testing into their own CI pipelines
- [ ] **Scenario versioning** — track which scenarios caught which bugs across releases

### Medium-term
- [ ] **Multi-provider LLM support** — add OpenAI, Anthropic, and Google as classifier/generator backends alongside Groq
- [ ] **Custom failure categories** — let users define domain-specific failure modes beyond the built-in 7
- [ ] **Scenario library** — community-contributed adversarial scenario packs for common agent types (customer support, coding assistant, research agent)

### Longer-term
- [ ] **Multi-agent testing** — test agent pipelines and orchestrators, not just single agents
- [ ] **Automated regression detection** — auto-trigger re-testing when a new agent version is registered, with Slack/email alerts on reliability drops
- [ ] **Browser-native replay** — full trace replay in the dashboard with frame-by-frame stepping

---

## 🤝 Contributing

Contributions are welcome. The project follows strict TDD — any new module or endpoint should come with tests before implementation.

1. Fork the repo and create a feature branch
2. Write tests first (see `backend/tests/` for patterns)
3. Implement the feature
4. Ensure `python -m pytest tests/ -v` passes
5. Open a PR with a clear description of the change

Please open an issue before starting large changes so we can align on design.

---

## 📄 License

MIT — see [LICENSE](LICENSE).

---

<div align="center">

**Agent Reliability Engine** · Built with ❤️ as an open-source project

*If this is useful to you, consider giving it a ⭐ — it helps others find it.*

</div>
