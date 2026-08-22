# Agent Reliability Engine (OOSC 4.0 Hackathon)

![Reliability Engine](https://img.shields.io/badge/Status-In%20Development-yellow)
![Superpowers Framework](https://img.shields.io/badge/Workflow-Superpowers%20SDD%2FTDD-blue)

A CI/CD engine for autonomous agents. This system automatically generates adversarial scenarios, tests AI agents in a sandboxed environment, and evaluates their failure modes (e.g., prompt injection, destructive actions, tool call loops) using a combination of deterministic guardrails and LLM-as-a-judge.

Built for the **OOSC 4.0 Hackathon (Problem Statement 4)** at IIIT Allahabad.

## Project Structure

This project follows a strict backend/frontend split:

*   **`backend/`**: FastAPI application, PostgreSQL database (via SQLAlchemy async), and LangChain/LangGraph agent definitions.
*   **`frontend/`**: (Coming Soon) Next.js React dashboard for viewing metrics and run traces.
*   **`.specify/` & `docs/superpowers/`**: Superpowers framework planning, specs, and ledger artifacts.

## Current Progress

We are actively developing the backend following strict Test-Driven Development (TDD). You can track progress in `.specify/task.md` or `.superpowers/sdd/2026-08-21-agent-reliability-engine/progress.md`.

*   ✅ **Task 1:** Project Skeleton + DB Models + Pydantic Schemas
*   ✅ **Task 2:** DevOps Assistant Agent (LangGraph)
*   ✅ **Task 3:** Guardrail Tester (Module 4, rule-based)
*   ✅ **Task 4:** Scenario Generation Engine (Module 1)
*   ✅ **CI/CD & DB Hardening:** Automated testing, Phase 2 migration
*   ✅ **Task 5:** Sandbox Execution Harness (Module 2)
*   ✅ **Task 6:** Failure Mode Classifier (Module 3)
*   ✅ **Task 7:** Scorecard & Statistics (Module 5 + D5)
*   ✅ **Task 8:** REST API + Full Pipeline Wiring (14 endpoints, WebSocket, Alembic migration)
*   ⏳ **Task 9:** Next.js Dashboard Foundation
*   ⏳ **Task 10:** Integration Test + Demo Scripting

## Setup & Installation

### Prerequisites
*   Python 3.11+
*   PostgreSQL database (e.g., Neon.tech)
*   Google Gemini API Key

### Backend Setup
1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
3.  Configure environment variables:
    *   Copy `.env.example` to `.env`
    *   Add your `DATABASE_URL` (ensure it starts with `postgresql+asyncpg://`)
    *   Add your `GEMINI_API_KEY`
4.  Run database migrations:
    ```bash
    alembic upgrade head
    ```
5.  Run the test suite to verify everything works:
    ```bash
    python -m pytest tests/ -v
    ```
