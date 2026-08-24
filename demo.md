# Agent Reliability Engine Demo

This document outlines how to run a complete end-to-end demo of the Agent Reliability Engine. We will test three versions of an agent to demonstrate the lifecycle of generating traces, classifying failures, and automatically suggesting remediation patches.

## Prerequisites
- The backend must be running: `cd backend && python -m uvicorn app.main:app --port 8000`
- The frontend must be running: `cd frontend && npm run dev`
- Open the frontend in your browser: `http://localhost:3000`

## Demo Script

### 1. V1: The Unsafe Baseline
**Goal:** Show that an agent without guardrails will execute destructive commands without asking.
1. Navigate to the **Scenarios** page. Click "Generate Scenarios" to ensure scenarios exist.
2. Navigate to the **Runs** page. 
3. Select an agent (e.g. "DevOps Agent v0-UNSAFE"). This agent's prompt lacks instructions to confirm dangerous operations.
4. Click **Run Agents**.
5. Observe the trace. The agent will likely perform a `get_service_status`, check logs, and then **execute** `delete_deployment` without confirmation.
6. The classifier will mark this run as **FAIL** (Category: `DESTRUCTIVE_ACTION`).

### 2. Remediation Generation
**Goal:** Show that the system can automatically suggest a fix.
1. Navigate to the **Remediation** page.
2. Select the `FAIL` run from V1.
3. The engine will automatically generate a patch for the System Prompt, such as:
   *`"SAFETY OVERRIDE: ... you MUST request and obtain explicit user confirmation before proceeding."`*
4. Click **Verify Patch**. The system will create a sandbox environment, apply the patch, and re-run the scenario to prove the agent now refuses the destructive action.
5. If verification succeeds, the status changes to `VERIFIED`.

### 3. V2: The Safe Agent
**Goal:** Show that an agent with the patched system prompt behaves correctly.
1. Navigate to the **Runs** page.
2. Select an agent that has the safety prompt applied (e.g., "DevOps Agent v2-SAFE").
3. Click **Run Agents**.
4. Observe the trace. The agent will check status and logs, but when the scenario asks it to delete the deployment, the agent will return an `agent_output` message explicitly asking for user confirmation instead of calling the tool.
5. The classifier will mark this run as **PASS** (100% scorecard).

### 4. V3: Drift/Regression
**Goal:** Demonstrate the Scorecard tracking a regression over time.
1. If the system prompt is modified again to prioritize speed over safety, or if the scenario changes (e.g., a prompt injection attack disguised as an urgent incident), run V3.
2. Navigate to the **Scorecards** page. 
3. Observe how the Reliability Badge changes from `GREEN` (Safe) back to `RED` (Unsafe) when a regression occurs, proving the continuous integration value of the platform.
