"""Module 2: Sandboxed Execution & Replay Harness.

Executes the DevOps agent against a generated scenario with mocked tools,
captures every step as a structured trace, and enforces a timeout.
"""
from __future__ import annotations

import asyncio
import json
import time
from datetime import datetime, timezone
from typing import Any, Callable

from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage

from app.agents.devops_agent import create_devops_agent, HIGH_RISK_TOOLS
from app.schemas.run import RunCreate, RunStatus


async def execute_scenario(
    scenario: dict,
    system_prompt: str,
    tool_definitions: list[dict],
    timeout_seconds: int | float = 60,
    on_step: Callable[[dict], Any] | None = None,
) -> RunCreate:
    """Execute the DevOps agent against a scenario with fully mocked tools.

    The agent is constructed from `create_devops_agent()` using the provided
    system_prompt and mock_responses from the scenario. Every LangGraph step
    (LLM calls + tool calls) is captured as a structured trace step.

    Args:
        scenario: Dict with 'user_message' and 'mocked_tool_responses'.
        system_prompt: The agent's system prompt (determines persona).
        tool_definitions: Tool schema list (used for risk level lookup).
        timeout_seconds: Hard cap on execution time. Marks run as TIMED_OUT.
        on_step: Optional async callback invoked for each trace step (live streaming).

    Returns:
        RunCreate with full trace, final status, and duration_ms.
    """
    mock_responses: dict = scenario.get("mocked_tool_responses", {})
    user_message: str = scenario.get("user_message", "")

    # Build risk lookup from tool_definitions
    risk_map: dict[str, str] = {
        td["name"]: td.get("risk_level", "none")
        for td in tool_definitions
    }
    # Supplement with global HIGH_RISK_TOOLS set
    for name in HIGH_RISK_TOOLS:
        if name not in risk_map:
            risk_map[name] = "high"

    trace: list[dict] = []
    step_counter = 0
    start_time = time.time()
    status = RunStatus.COMPLETED

    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()

    def _risk(tool_name: str) -> str:
        return risk_map.get(tool_name, "none")

    async def _append(step: dict) -> None:
        nonlocal step_counter
        trace.append(step)
        if on_step is not None:
            await on_step(step)

    async def _run() -> None:
        nonlocal step_counter, status

        graph = create_devops_agent(
            system_prompt=system_prompt,
            mock_responses=mock_responses,
        )

        # Build initial messages
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_message),
        ]

        result = await graph.ainvoke({"messages": messages})

        # Reconstruct trace from final message list
        result_messages = result.get("messages", [])

        for msg in result_messages:
            # Use isinstance so mocks with spec=AIMessage also match correctly
            if isinstance(msg, (SystemMessage, HumanMessage)):
                continue

            elif isinstance(msg, ToolMessage):
                step_counter += 1
                tool_name = getattr(msg, "name", "unknown") or "unknown"
                # Decode the mocked response injected by mock_tool_node
                try:
                    tool_response = json.loads(msg.content)
                except (json.JSONDecodeError, TypeError):
                    tool_response = {"raw": str(msg.content)}

                step: dict = {
                    "step_number": step_counter,
                    "step_type": "tool_call",
                    "timestamp": _now(),
                    "content": {
                        "tool_name": tool_name,
                        "tool_args": {},
                        "tool_response": tool_response,
                    },
                    "risk_level": _risk(tool_name),
                }
                await _append(step)

            else:
                # AIMessage (or mock with spec=AIMessage)
                step_counter += 1
                has_tool_calls = bool(getattr(msg, "tool_calls", None))
                content_text = getattr(msg, "content", "") or ""

                if has_tool_calls:
                    tool_calls_info = [
                        {"name": tc["name"], "args": tc.get("args", {})}
                        for tc in msg.tool_calls
                    ]
                    risk_levels = ["none", "low", "high", "critical"]
                    risks = [_risk(tc["name"]) for tc in msg.tool_calls]
                    best_risk = max(
                        risks,
                        key=lambda r: risk_levels.index(r) if r in risk_levels else 0,
                        default="none",
                    )
                    step = {
                        "step_number": step_counter,
                        "step_type": "llm_call",
                        "timestamp": _now(),
                        "content": {
                            "output": content_text,
                            "tool_calls": tool_calls_info,
                        },
                        "risk_level": best_risk,
                    }
                else:
                    step = {
                        "step_number": step_counter,
                        "step_type": "agent_output",
                        "timestamp": _now(),
                        "content": {"output": content_text},
                        "risk_level": "none",
                    }
                await _append(step)


    try:
        await asyncio.wait_for(_run(), timeout=timeout_seconds)
    except asyncio.TimeoutError:
        status = RunStatus.TIMED_OUT
    except Exception as exc:
        status = RunStatus.ERRORED
        step_counter += 1
        await _append({
            "step_number": step_counter,
            "step_type": "agent_output",
            "timestamp": _now(),
            "content": {"output": f"Error: {exc}"},
            "risk_level": "none",
        })

    elapsed_ms = int((time.time() - start_time) * 1000)

    return RunCreate(
        agent_version_id="00000000-0000-0000-0000-000000000000",
        scenario_id="00000000-0000-0000-0000-000000000000",
        trace=trace,
        status=status,
        duration_ms=elapsed_ms,
    )
