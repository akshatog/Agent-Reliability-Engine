"""DevOps Assistant Agent built with LangGraph."""
from typing import TypedDict, Annotated, Sequence
import json
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, ToolMessage
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages


# -----------------------------------------------------------------------------
# Tool Definitions
# -----------------------------------------------------------------------------

TOOL_DEFINITIONS = [
    {
        "name": "get_service_status",
        "description": "Check the current health and status of a deployment or service.",
        "parameters": {
            "type": "object",
            "properties": {
                "service_name": {"type": "string"},
                "environment": {"type": "string", "enum": ["prod", "staging", "dev"]}
            },
            "required": ["service_name"]
        }
    },
    {
        "name": "query_logs",
        "description": "Query recent logs for a specific service.",
        "parameters": {
            "type": "object",
            "properties": {
                "service_name": {"type": "string"},
                "duration_minutes": {"type": "integer"}
            },
            "required": ["service_name"]
        }
    },
    {
        "name": "restart_service",
        "description": "Restart a running service. HIGH RISK.",
        "parameters": {
            "type": "object",
            "properties": {
                "service_name": {"type": "string"},
                "environment": {"type": "string"}
            },
            "required": ["service_name", "environment"]
        }
    },
    {
        "name": "delete_deployment",
        "description": "Completely remove a deployment and all its resources. CRITICAL RISK.",
        "parameters": {
            "type": "object",
            "properties": {
                "deployment_id": {"type": "string"},
                "force": {"type": "boolean"}
            },
            "required": ["deployment_id"]
        }
    },
    {
        "name": "send_alert",
        "description": "Page the on-call engineer.",
        "parameters": {
            "type": "object",
            "properties": {
                "severity": {"type": "string", "enum": ["low", "high", "critical"]},
                "message": {"type": "string"}
            },
            "required": ["severity", "message"]
        }
    }
]

HIGH_RISK_TOOLS = {"restart_service", "delete_deployment", "send_alert"}


# -----------------------------------------------------------------------------
# Agent State and Sandbox Graph
# -----------------------------------------------------------------------------

class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]


def create_devops_agent(system_prompt: str, mock_responses: dict):
    """
    Create a LangGraph agent that uses a mocked tool executor.
    
    Args:
        system_prompt: The instructions for the LLM.
        mock_responses: Dictionary mapping tool_name -> mocked JSON response.
    """
    
    # We will use Google Gemini Flash via LangChain
    from langchain_google_genai import ChatGoogleGenerativeAI
    from app.config import settings
    
    llm = ChatGoogleGenerativeAI(
        model=settings.gemini_flash_model,
        google_api_key=settings.gemini_api_key,
        temperature=0.0
    )
    
    # Bind the tool schemas to the LLM
    llm_with_tools = llm.bind_tools(TOOL_DEFINITIONS)

    def agent_node(state: AgentState):
        """Invoke the LLM."""
        messages = state["messages"]
        # Prepend system prompt if it's the first message
        if not any(getattr(m, "type", "") == "system" for m in messages):
            # Langchain handles SystemMessage natively, but we can also just inject it
            pass 
        
        response = llm_with_tools.invoke(messages)
        return {"messages": [response]}

    def mock_tool_node(state: AgentState):
        """Execute tools using the predefined mock responses (Sandbox execution)."""
        messages = state["messages"]
        last_message = messages[-1]
        
        tool_outputs = []
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            for tool_call in last_message.tool_calls:
                tool_name = tool_call["name"]
                # Look up mock response, fallback to generic success
                response_data = mock_responses.get(tool_name, {"status": "success", "mocked": True})
                
                tool_outputs.append(
                    ToolMessage(
                        content=json.dumps(response_data),
                        name=tool_name,
                        tool_call_id=tool_call["id"]
                    )
                )
        return {"messages": tool_outputs}

    def should_continue(state: AgentState):
        """Route conditionally based on whether the LLM decided to call a tool."""
        messages = state["messages"]
        last_message = messages[-1]
        
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            return "tools"
        return END

    # Build the graph
    workflow = StateGraph(AgentState)
    
    workflow.add_node("agent", agent_node)
    workflow.add_node("tools", mock_tool_node)
    
    workflow.set_entry_point("agent")
    
    workflow.add_conditional_edges(
        "agent",
        should_continue,
        {
            "tools": "tools",
            END: END
        }
    )
    
    workflow.add_edge("tools", "agent")
    
    return workflow.compile()
