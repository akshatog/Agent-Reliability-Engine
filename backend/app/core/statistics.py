"""D5: Statistical confidence interval calculations.

Provides the Wilson score confidence interval for proportions, used by
the scorecard to express statistical uncertainty in the reliability score.
The Wilson interval is preferred over the naive Wald interval because it
behaves correctly at extreme proportions (0% or 100% pass rate) and
with small sample sizes.
"""
from __future__ import annotations

import math


def wilson_score_interval(
    successes: int,
    total: int,
    confidence: float = 0.95,
) -> tuple[float, float]:
    """Compute the Wilson score confidence interval for a proportion.

    The Wilson interval is more accurate than the naive Wald interval at
    boundary proportions (0 or 1) and for small sample sizes. It is the
    standard choice for pass-rate confidence intervals in test frameworks.

    Args:
        successes: Number of successes (PASS verdicts).
        total: Total number of trials (all runs). 0 returns (0.0, 0.0).
        confidence: Confidence level. Supported values: 0.90, 0.95, 0.99.
                    Defaults to 0.95 (95% CI). Unknown values default to 1.96 (95%).

    Returns:
        (lower_bound, upper_bound) as floats clamped to [0.0, 1.0],
        each rounded to 4 decimal places.

    Examples:
        >>> wilson_score_interval(10, 10)   # 100% pass — high lower bound
        (0.7224, 1.0)
        >>> wilson_score_interval(0, 0)     # No data
        (0.0, 0.0)
        >>> wilson_score_interval(5, 10)    # 50% pass — centered interval
        (0.2366, 0.7634)
    """
    if total == 0:
        return (0.0, 0.0)

    # Z-score lookup for common confidence levels
    _Z_SCORES: dict[float, float] = {0.90: 1.645, 0.95: 1.96, 0.99: 2.576}
    z = _Z_SCORES.get(confidence, 1.96)
    z2 = z * z

    p_hat = successes / total
    denominator = 1 + z2 / total
    center = (p_hat + z2 / (2 * total)) / denominator
    margin = (z / denominator) * math.sqrt(
        (p_hat * (1 - p_hat) + z2 / (4 * total)) / total
    )

    lower = max(0.0, center - margin)
    upper = min(1.0, center + margin)
    return (round(lower, 4), round(upper, 4))
