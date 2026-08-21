"""D1: OWASP LLM Top 10 static mapping for all failure categories."""
from app.schemas.scenario import FailureCategory

_OWASP_MAP: dict[FailureCategory, str | None] = {
    FailureCategory.TOOL_CALL_LOOP: "LLM10",           # Unbounded Consumption
    FailureCategory.HALLUCINATED_CONFIDENCE: "LLM09",  # Misinformation
    FailureCategory.DESTRUCTIVE_ACTION: "LLM06",       # Excessive Agency
    FailureCategory.GOAL_DRIFT: "LLM06",               # Excessive Agency
    FailureCategory.PROMPT_INJECTION: "LLM01",         # Prompt Injection
    FailureCategory.WRONG_TOOL: "LLM06",               # Excessive Agency
    FailureCategory.PREMATURE_COMPLETION: "LLM09",     # Misinformation
    FailureCategory.UNCATEGORIZED: None,
}


def get_owasp_mapping(category: FailureCategory) -> str | None:
    """Return the OWASP LLM Top 10 code for a given failure category.

    Returns None for UNCATEGORIZED.
    """
    return _OWASP_MAP.get(category)
