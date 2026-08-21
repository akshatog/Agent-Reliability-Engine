# Agent Reliability Engine

**OOSC 4.0 Hackathon — Problem Statement 4: AI Agent Evaluation and Reliability Engine**

Continuous integration for autonomous agents — automatically generates adversarial
test scenarios, runs a target agent in a sandbox, classifies failure modes, and
produces a reliability report with a before/after comparison view.

## Spec-driven workflow

This project follows spec-driven development. Read in this order:

1. [`.specify/constitution.md`](.specify/constitution.md) — locked architecture & scope decisions
2. [`.specify/spec.md`](.specify/spec.md) — functional spec for all 5 modules
3. [`.specify/plan.md`](.specify/plan.md) — implementation plan (fill in via Antigravity/Superpowers)

**Do not write code before the constitution and spec are read.** Any deviation from
the constitution needs an explicit amendment logged there first.

## Stack

- Backend: Python + FastAPI + LangGraph
- Frontend: Next.js (App Router) + TailwindCSS
- DB: PostgreSQL
- Realtime: WebSocket (trace streaming)

## Structure

```
agent-reliability-engine/
├── .specify/           # constitution, spec, plan — read these first
├── backend/
│   └── app/
│       ├── agents/     # target demo agent(s) - LangGraph
│       ├── modules/    # scenario_gen, harness, classifier, guardrail, comparison
│       ├── models/     # Pydantic schemas + DB models
│       └── api/        # FastAPI routes + WebSocket
└── frontend/
    ├── app/             # Next.js routes
    └── components/      # trace viewer, scenario list, classifier table, comparison view
```

## Status

Spec locked. Implementation not started — next step: `plan.md` build-out in Antigravity.
