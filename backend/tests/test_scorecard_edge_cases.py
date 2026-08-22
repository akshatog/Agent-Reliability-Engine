"""Edge-case tests for Scorecard (Module 5) and Wilson statistics (D5)."""
import pytest
from app.modules.scorecard import compute_scorecard
from app.core.statistics import wilson_score_interval


class TestWilsonEdgeCases:

    def test_all_pass_lower_bound_never_zero(self):
        """With all successes, lower bound should be > 0 (Wilson avoids naive 0)."""
        lower, upper = wilson_score_interval(100, 100)
        assert lower > 0.0

    def test_all_fail_upper_bound_never_one(self):
        """With all failures, upper bound should be < 1 (Wilson avoids naive 1)."""
        lower, upper = wilson_score_interval(0, 100)
        assert upper < 1.0

    def test_monotonic_with_increasing_successes(self):
        """More successes → higher lower bound (monotonicity check)."""
        totals = 20
        lowers = [wilson_score_interval(s, totals)[0] for s in range(totals + 1)]
        assert lowers == sorted(lowers)

    def test_symmetry_around_50_percent(self):
        """The interval for p=k/n and p=(n-k)/n should be symmetric around 0.5."""
        lo_low, _ = wilson_score_interval(3, 10)
        _, hi_high = wilson_score_interval(7, 10)
        # lower bound of 30% ≈ 1 - upper bound of 70%
        assert abs(lo_low - (1.0 - hi_high)) < 0.01

    def test_99_confidence_wider_than_90(self):
        lo90, hi90 = wilson_score_interval(5, 10, confidence=0.90)
        lo99, hi99 = wilson_score_interval(5, 10, confidence=0.99)
        assert (hi99 - lo99) > (hi90 - lo90)

    def test_unknown_confidence_defaults_to_95(self):
        """Unknown confidence level should default to z=1.96 (95% CI)."""
        lo_unknown, hi_unknown = wilson_score_interval(5, 10, confidence=0.42)
        lo_95, hi_95 = wilson_score_interval(5, 10, confidence=0.95)
        assert abs(lo_unknown - lo_95) < 1e-6
        assert abs(hi_unknown - hi_95) < 1e-6


class TestScorecardEdgeCases:

    def test_single_pass_run(self):
        sc = compute_scorecard([
            {"verdict": "PASS", "failure_category": None, "severity": None, "guardrail_result": None}
        ])
        assert sc["overall_reliability_score"] == 100.0
        assert sc["total_runs"] == 1
        assert sc["passes"] == 1
        assert sc["failures"] == 0

    def test_single_fail_run(self):
        sc = compute_scorecard([
            {"verdict": "FAIL", "failure_category": "WRONG_TOOL", "severity": "HIGH", "guardrail_result": None}
        ])
        assert sc["overall_reliability_score"] == 0.0
        assert sc["failures"] == 1

    def test_unknown_failure_category_not_in_owasp_profile(self):
        """Unknown/UNCATEGORIZED categories should be excluded from OWASP profile."""
        sc = compute_scorecard([
            {"verdict": "FAIL", "failure_category": "SOMETHING_RANDOM", "severity": "LOW", "guardrail_result": None}
        ])
        # Should not crash, and should produce an empty OWASP profile
        assert "SOMETHING_RANDOM" not in sc["owasp_risk_profile"]

    def test_all_severities_present_in_distribution_even_when_zero(self):
        """Severity distribution should always have all 4 keys, even if count is 0."""
        sc = compute_scorecard([
            {"verdict": "PASS", "failure_category": None, "severity": None, "guardrail_result": None}
        ])
        assert set(sc["severity_distribution"].keys()) == {"LOW", "MEDIUM", "HIGH", "CRITICAL"}

    def test_none_severity_not_counted_in_distribution(self):
        """A run with severity=None (PASS run) should not increment any severity bucket."""
        sc = compute_scorecard([
            {"verdict": "PASS", "failure_category": None, "severity": None, "guardrail_result": None}
        ])
        assert sum(sc["severity_distribution"].values()) == 0

    def test_category_breakdown_has_owasp_codes(self):
        """Each category in the breakdown should include its OWASP code."""
        sc = compute_scorecard([])
        for cat_name, cat_data in sc["per_category_breakdown"].items():
            assert "owasp" in cat_data
            # UNCATEGORIZED should not be in breakdown
            assert cat_name != "UNCATEGORIZED"

    def test_confidence_interval_lower_lte_upper_always(self):
        """CI bounds must be ordered for all kinds of inputs."""
        test_cases = [
            [],
            [{"verdict": "PASS", "failure_category": None, "severity": None, "guardrail_result": None}],
            [{"verdict": "FAIL", "failure_category": "GOAL_DRIFT", "severity": "HIGH", "guardrail_result": None}] * 5,
        ]
        for runs in test_cases:
            sc = compute_scorecard(runs)
            lo, hi = sc["confidence_interval"]
            assert lo <= hi

    def test_large_batch_score_precision(self):
        """With 75 passes out of 100, score should be exactly 75.0."""
        runs = (
            [{"verdict": "PASS", "failure_category": None, "severity": None, "guardrail_result": None}] * 75
            + [{"verdict": "FAIL", "failure_category": "WRONG_TOOL", "severity": "LOW", "guardrail_result": None}] * 25
        )
        sc = compute_scorecard(runs)
        assert sc["overall_reliability_score"] == 75.0

    def test_mixed_guardrail_held_and_bypassed_50_50(self):
        """2 HELD + 2 BYPASSED → hold rate 50.0."""
        runs = [
            {"verdict": "FAIL", "failure_category": "DESTRUCTIVE_ACTION", "severity": "CRITICAL", "guardrail_result": "HELD"},
            {"verdict": "FAIL", "failure_category": "DESTRUCTIVE_ACTION", "severity": "CRITICAL", "guardrail_result": "HELD"},
            {"verdict": "FAIL", "failure_category": "DESTRUCTIVE_ACTION", "severity": "CRITICAL", "guardrail_result": "BYPASSED"},
            {"verdict": "FAIL", "failure_category": "DESTRUCTIVE_ACTION", "severity": "CRITICAL", "guardrail_result": "BYPASSED"},
        ]
        sc = compute_scorecard(runs)
        assert sc["guardrail_hold_rate"] == 50.0
