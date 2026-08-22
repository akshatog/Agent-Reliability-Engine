"""Module 5: Reliability Scorecard & Regression Tracker — aggregation logic.

Takes a list of run classification dicts and produces a rich aggregate
reliability report: overall score, per-category breakdown, guardrail hold
rate, severity distribution, OWASP risk profile, and a Wilson-score
confidence interval.

This module is intentionally pure (no database calls, no async) so it
can be called from both the REST API layer and integration tests with
equal ease.
"""
from __future__ import annotations

from app.schemas.scenario import FailureCategory
from app.schemas.classification import Severity
from app.core.owasp_mapping import get_owasp_mapping
from app.core.statistics import wilson_score_interval

# All non-UNCATEGORIZED categories, used to pre-populate the breakdown dict
_SCOREABLE_CATEGORIES: list[FailureCategory] = [
    c for c in FailureCategory if c != FailureCategory.UNCATEGORIZED
]


def compute_scorecard(runs_data: list[dict]) -> dict:
    """Compute aggregate reliability metrics from run classification data.

    Accepts a flat list of run dicts (typically joined from the `runs` and
    `classifications` tables). Each dict must have these keys:
        - ``verdict``: "PASS" or "FAIL"
        - ``failure_category``: one of the 7 FailureCategory values, or None
        - ``severity``: one of "LOW", "MEDIUM", "HIGH", "CRITICAL", or None
        - ``guardrail_result``: "HELD", "BYPASSED", or None

    Returns a dict with:
        - ``overall_reliability_score``: float, 0–100 (% of PASS verdicts)
        - ``total_runs``: int
        - ``passes``: int — number of PASS runs
        - ``failures``: int — number of FAIL runs
        - ``per_category_breakdown``: dict[category_str, {fail_count, owasp}]
        - ``guardrail_hold_rate``: float 0–100 (% of guardrail hits that were HELD)
        - ``severity_distribution``: dict[severity_str, int]
        - ``owasp_risk_profile``: dict[owasp_code, int] — failure count per OWASP code
        - ``confidence_interval``: (lower, upper) Wilson score interval (0–1)
    """
    total = len(runs_data)

    # ── Empty case ────────────────────────────────────────────────────────────
    if total == 0:
        return {
            "overall_reliability_score": 0.0,
            "total_runs": 0,
            "passes": 0,
            "failures": 0,
            "per_category_breakdown": {
                cat.value: {"fail_count": 0, "owasp": get_owasp_mapping(cat)}
                for cat in _SCOREABLE_CATEGORIES
            },
            "guardrail_hold_rate": 0.0,
            "severity_distribution": {s.value: 0 for s in Severity},
            "owasp_risk_profile": {},
            "confidence_interval": (0.0, 0.0),
        }

    # ── Overall reliability score ─────────────────────────────────────────────
    passes = sum(1 for r in runs_data if r.get("verdict") == "PASS")
    failures = total - passes
    score = round((passes / total) * 100, 1)

    # ── Per-category breakdown (pre-seeded with all 7 categories at 0) ────────
    cat_breakdown: dict[str, dict] = {
        cat.value: {"fail_count": 0, "owasp": get_owasp_mapping(cat)}
        for cat in _SCOREABLE_CATEGORIES
    }
    for r in runs_data:
        cat_str = r.get("failure_category")
        if cat_str and cat_str in cat_breakdown:
            cat_breakdown[cat_str]["fail_count"] += 1

    # ── Guardrail hold rate ───────────────────────────────────────────────────
    guardrail_runs = [r for r in runs_data if r.get("guardrail_result") is not None]
    guardrail_held = sum(1 for r in guardrail_runs if r.get("guardrail_result") == "HELD")
    guardrail_rate = (
        round((guardrail_held / len(guardrail_runs)) * 100, 1)
        if guardrail_runs
        else 0.0
    )

    # ── Severity distribution (pre-seeded with all severities at 0) ──────────
    sev_dist: dict[str, int] = {s.value: 0 for s in Severity}
    for r in runs_data:
        sev = r.get("severity")
        if sev and sev in sev_dist:
            sev_dist[sev] += 1

    # ── OWASP risk profile ────────────────────────────────────────────────────
    owasp_profile: dict[str, int] = {}
    for r in runs_data:
        cat_str = r.get("failure_category")
        if cat_str:
            try:
                cat = FailureCategory(cat_str)
                owasp = get_owasp_mapping(cat)
                if owasp:
                    owasp_profile[owasp] = owasp_profile.get(owasp, 0) + 1
            except ValueError:
                pass  # Unknown/UNCATEGORIZED — skip from OWASP profile

    # ── Wilson-score confidence interval (D5) ─────────────────────────────────
    ci = wilson_score_interval(passes, total)

    return {
        "overall_reliability_score": score,
        "total_runs": total,
        "passes": passes,
        "failures": failures,
        "per_category_breakdown": cat_breakdown,
        "guardrail_hold_rate": guardrail_rate,
        "severity_distribution": sev_dist,
        "owasp_risk_profile": owasp_profile,
        "confidence_interval": ci,
    }
