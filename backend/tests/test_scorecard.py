"""Tests for the Scorecard aggregation (Module 5)."""
from app.modules.scorecard import compute_scorecard

# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

PASS_RUN = {"verdict": "PASS", "failure_category": None, "severity": None, "guardrail_result": None}
FAIL_DA_CRIT = {"verdict": "FAIL", "failure_category": "DESTRUCTIVE_ACTION", "severity": "CRITICAL", "guardrail_result": "BYPASSED"}
FAIL_DA_HIGH_HELD = {"verdict": "FAIL", "failure_category": "DESTRUCTIVE_ACTION", "severity": "HIGH", "guardrail_result": "HELD"}
FAIL_WRONG_HIGH = {"verdict": "FAIL", "failure_category": "WRONG_TOOL", "severity": "HIGH", "guardrail_result": None}
FAIL_GOAL_MED = {"verdict": "FAIL", "failure_category": "GOAL_DRIFT", "severity": "MEDIUM", "guardrail_result": None}


class TestComputeScorecard:
    def test_all_pass(self):
        sc = compute_scorecard([PASS_RUN, PASS_RUN])
        assert sc["overall_reliability_score"] == 100.0
        assert sc["total_runs"] == 2

    def test_mixed_results(self):
        sc = compute_scorecard([PASS_RUN, FAIL_DA_CRIT])
        assert sc["overall_reliability_score"] == 50.0
        assert sc["per_category_breakdown"]["DESTRUCTIVE_ACTION"]["fail_count"] == 1

    def test_guardrail_hold_rate(self):
        sc = compute_scorecard([FAIL_DA_HIGH_HELD, FAIL_DA_CRIT])
        assert sc["guardrail_hold_rate"] == 50.0

    def test_severity_distribution(self):
        sc = compute_scorecard([FAIL_WRONG_HIGH, FAIL_GOAL_MED, FAIL_DA_CRIT])
        assert sc["severity_distribution"]["CRITICAL"] == 1
        assert sc["severity_distribution"]["HIGH"] == 1
        assert sc["severity_distribution"]["MEDIUM"] == 1

    def test_empty_runs(self):
        sc = compute_scorecard([])
        assert sc["overall_reliability_score"] == 0.0
        assert sc["total_runs"] == 0

    def test_all_fail_gives_zero_score(self):
        sc = compute_scorecard([FAIL_DA_CRIT, FAIL_WRONG_HIGH])
        assert sc["overall_reliability_score"] == 0.0

    def test_total_runs_is_correct(self):
        sc = compute_scorecard([PASS_RUN, PASS_RUN, FAIL_DA_CRIT])
        assert sc["total_runs"] == 3

    def test_passes_and_failures_counts(self):
        sc = compute_scorecard([PASS_RUN, PASS_RUN, FAIL_DA_CRIT])
        assert sc["passes"] == 2
        assert sc["failures"] == 1

    def test_owasp_risk_profile_populated(self):
        """FAIL runs should build an OWASP risk profile dict."""
        sc = compute_scorecard([FAIL_DA_CRIT, FAIL_WRONG_HIGH])
        # Both DESTRUCTIVE_ACTION and WRONG_TOOL map to LLM06
        assert sc["owasp_risk_profile"].get("LLM06", 0) == 2

    def test_owasp_risk_profile_counts_correctly_across_categories(self):
        """TOOL_CALL_LOOP maps to LLM10, DESTRUCTIVE_ACTION to LLM06."""
        runs = [
            {"verdict": "FAIL", "failure_category": "TOOL_CALL_LOOP", "severity": "HIGH", "guardrail_result": None},
            {"verdict": "FAIL", "failure_category": "DESTRUCTIVE_ACTION", "severity": "CRITICAL", "guardrail_result": None},
        ]
        sc = compute_scorecard(runs)
        assert sc["owasp_risk_profile"]["LLM10"] == 1
        assert sc["owasp_risk_profile"]["LLM06"] == 1

    def test_per_category_breakdown_contains_all_seven_categories(self):
        """Breakdown should exist for all 7 non-UNCATEGORIZED categories, even with zero failures."""
        sc = compute_scorecard([PASS_RUN])
        expected_cats = {
            "TOOL_CALL_LOOP", "HALLUCINATED_CONFIDENCE", "DESTRUCTIVE_ACTION",
            "GOAL_DRIFT", "PROMPT_INJECTION", "WRONG_TOOL", "PREMATURE_COMPLETION",
        }
        assert expected_cats.issubset(set(sc["per_category_breakdown"].keys()))

    def test_zero_cat_breakdown_for_all_pass(self):
        """With all-PASS runs, every category's fail_count should be 0."""
        sc = compute_scorecard([PASS_RUN, PASS_RUN])
        for cat_data in sc["per_category_breakdown"].values():
            assert cat_data["fail_count"] == 0

    def test_confidence_interval_present(self):
        """Scorecard must include Wilson score confidence interval."""
        sc = compute_scorecard([PASS_RUN, FAIL_DA_CRIT])
        ci = sc["confidence_interval"]
        assert isinstance(ci, tuple)
        assert len(ci) == 2
        assert 0.0 <= ci[0] <= 1.0
        assert 0.0 <= ci[1] <= 1.0

    def test_guardrail_hold_rate_zero_when_no_guardrail_runs(self):
        """If no run has a guardrail_result, hold rate should be 0.0."""
        runs = [PASS_RUN, PASS_RUN]
        sc = compute_scorecard(runs)
        assert sc["guardrail_hold_rate"] == 0.0

    def test_guardrail_hold_rate_100_when_all_held(self):
        runs = [FAIL_DA_HIGH_HELD, FAIL_DA_HIGH_HELD]
        sc = compute_scorecard(runs)
        assert sc["guardrail_hold_rate"] == 100.0

    def test_reliability_score_75_with_three_passes_one_fail(self):
        sc = compute_scorecard([PASS_RUN, PASS_RUN, PASS_RUN, FAIL_DA_CRIT])
        assert sc["overall_reliability_score"] == 75.0

    def test_flaky_scenario_detected(self):
        """A scenario run twice with mixed PASS/FAIL verdicts is correctly flagged."""
        runs = [
            {"scenario_id": "scen-1", "verdict": "PASS", "failure_category": None, "severity": None, "guardrail_result": None},
            {"scenario_id": "scen-1", "verdict": "FAIL", "failure_category": "GOAL_DRIFT", "severity": "MEDIUM", "guardrail_result": None},
        ]
        sc = compute_scorecard(runs)
        assert len(sc["flaky_scenarios"]) == 1
        flaky = sc["flaky_scenarios"][0]
        assert flaky["scenario_id"] == "scen-1"
        assert flaky["pass_count"] == 1
        assert flaky["fail_count"] == 1
        assert flaky["total_runs"] == 2

    def test_all_same_verdict_scenario_not_flaky(self):
        """A scenario run multiple times with all-same verdicts is NOT flagged."""
        runs = [
            {"scenario_id": "scen-1", "verdict": "PASS", "failure_category": None, "severity": None, "guardrail_result": None},
            {"scenario_id": "scen-1", "verdict": "PASS", "failure_category": None, "severity": None, "guardrail_result": None},
            {"scenario_id": "scen-2", "verdict": "FAIL", "failure_category": "WRONG_TOOL", "severity": "HIGH", "guardrail_result": None},
            {"scenario_id": "scen-2", "verdict": "FAIL", "failure_category": "WRONG_TOOL", "severity": "HIGH", "guardrail_result": None},
        ]
        sc = compute_scorecard(runs)
        assert sc["flaky_scenarios"] == []

    def test_single_run_scenario_not_flaky(self):
        """A scenario run only once never appears in flaky_scenarios."""
        runs = [
            {"scenario_id": "scen-1", "verdict": "PASS", "failure_category": None, "severity": None, "guardrail_result": None},
            {"scenario_id": "scen-2", "verdict": "FAIL", "failure_category": "PROMPT_INJECTION", "severity": "HIGH", "guardrail_result": None},
        ]
        sc = compute_scorecard(runs)
        assert sc["flaky_scenarios"] == []

    def test_empty_runs_data_returns_empty_flaky_list(self):
        """Empty runs_data returns an empty flaky_scenarios list."""
        sc = compute_scorecard([])
        assert sc["flaky_scenarios"] == []


# ---------------------------------------------------------------------------
# severity_heatmap tests
# ---------------------------------------------------------------------------

class TestSeverityHeatmap:
    def test_severity_heatmap_key_present(self):
        """compute_scorecard() always returns a 'severity_heatmap' key."""
        sc = compute_scorecard([])
        assert "severity_heatmap" in sc

    def test_heatmap_has_all_seven_categories(self):
        """Every non-UNCATEGORIZED category appears as a row in severity_heatmap."""
        sc = compute_scorecard([])
        expected = {
            "TOOL_CALL_LOOP", "HALLUCINATED_CONFIDENCE", "DESTRUCTIVE_ACTION",
            "GOAL_DRIFT", "PROMPT_INJECTION", "WRONG_TOOL", "PREMATURE_COMPLETION",
        }
        assert set(sc["severity_heatmap"].keys()) == expected

    def test_heatmap_row_has_all_severity_columns(self):
        """Each heatmap row has critical / high / medium / low keys."""
        sc = compute_scorecard([])
        for cat, row in sc["severity_heatmap"].items():
            assert set(row.keys()) == {"critical", "high", "medium", "low"}, \
                f"Row for {cat} missing severity columns"

    def test_heatmap_empty_runs_all_zeros(self):
        """With no runs, every cell in the heatmap is 0."""
        sc = compute_scorecard([])
        for cat, row in sc["severity_heatmap"].items():
            for sev, count in row.items():
                assert count == 0, f"Expected 0 for {cat}/{sev}, got {count}"

    def test_heatmap_counts_failures_correctly(self):
        """A DESTRUCTIVE_ACTION/CRITICAL failure increments only that cell."""
        runs = [
            {"verdict": "FAIL", "failure_category": "DESTRUCTIVE_ACTION",
             "severity": "CRITICAL", "guardrail_result": None},
            {"verdict": "FAIL", "failure_category": "DESTRUCTIVE_ACTION",
             "severity": "HIGH", "guardrail_result": None},
            {"verdict": "FAIL", "failure_category": "PROMPT_INJECTION",
             "severity": "HIGH", "guardrail_result": None},
            {"verdict": "PASS", "failure_category": None,
             "severity": None, "guardrail_result": None},
        ]
        sc = compute_scorecard(runs)
        hm = sc["severity_heatmap"]
        assert hm["DESTRUCTIVE_ACTION"]["critical"] == 1
        assert hm["DESTRUCTIVE_ACTION"]["high"] == 1
        assert hm["DESTRUCTIVE_ACTION"]["medium"] == 0
        assert hm["PROMPT_INJECTION"]["high"] == 1
        assert hm["PROMPT_INJECTION"]["critical"] == 0

    def test_heatmap_pass_runs_not_counted(self):
        """PASS runs do not appear in the heatmap — it counts only failures."""
        runs = [
            {"verdict": "PASS", "failure_category": None, "severity": None, "guardrail_result": None},
            {"verdict": "PASS", "failure_category": None, "severity": None, "guardrail_result": None},
        ]
        sc = compute_scorecard(runs)
        for row in sc["severity_heatmap"].values():
            assert all(v == 0 for v in row.values())

    def test_heatmap_unknown_category_not_in_heatmap(self):
        """UNCATEGORIZED failures are excluded from the heatmap rows."""
        runs = [
            {"verdict": "FAIL", "failure_category": "UNCATEGORIZED",
             "severity": "LOW", "guardrail_result": None},
        ]
        sc = compute_scorecard(runs)
        assert "UNCATEGORIZED" not in sc["severity_heatmap"]

    def test_heatmap_none_severity_not_counted(self):
        """Failures with severity=None (edge case) don't increment any cell."""
        runs = [
            {"verdict": "FAIL", "failure_category": "GOAL_DRIFT",
             "severity": None, "guardrail_result": None},
        ]
        sc = compute_scorecard(runs)
        row = sc["severity_heatmap"]["GOAL_DRIFT"]
        assert all(v == 0 for v in row.values())


