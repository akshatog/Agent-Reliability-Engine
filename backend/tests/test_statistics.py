"""Tests for Wilson score interval calculation (D5)."""
import pytest
from app.core.statistics import wilson_score_interval


class TestWilsonScoreInterval:
    def test_all_pass_returns_high_interval(self):
        lower, upper = wilson_score_interval(10, 10)
        assert lower > 0.7
        assert upper == 1.0

    def test_all_fail_returns_low_interval(self):
        lower, upper = wilson_score_interval(0, 10)
        assert lower == 0.0
        assert upper < 0.3

    def test_half_pass_centered_around_50(self):
        lower, upper = wilson_score_interval(5, 10)
        assert 0.2 < lower < 0.5
        assert 0.5 < upper < 0.8

    def test_zero_total_returns_zero(self):
        lower, upper = wilson_score_interval(0, 0)
        assert lower == 0.0
        assert upper == 0.0

    def test_bounds_are_ordered(self):
        lower, upper = wilson_score_interval(3, 7)
        assert lower <= upper

    def test_bounds_are_between_zero_and_one(self):
        for successes, total in [(0, 1), (1, 1), (3, 10), (99, 100)]:
            lower, upper = wilson_score_interval(successes, total)
            assert 0.0 <= lower <= 1.0
            assert 0.0 <= upper <= 1.0

    def test_90_confidence_is_narrower_than_99(self):
        """Wider confidence = wider interval; narrower confidence = tighter."""
        lo90, hi90 = wilson_score_interval(5, 10, confidence=0.90)
        lo99, hi99 = wilson_score_interval(5, 10, confidence=0.99)
        assert (hi90 - lo90) < (hi99 - lo99)

    def test_large_sample_has_narrow_interval(self):
        """With 1000 trials at 80% pass, interval should be within 3% of 0.80."""
        lower, upper = wilson_score_interval(800, 1000)
        assert upper - lower < 0.06

    def test_single_success_out_of_one(self):
        lower, upper = wilson_score_interval(1, 1)
        assert lower > 0.0
        assert upper == 1.0

    def test_returns_tuple_of_two_floats(self):
        result = wilson_score_interval(5, 10)
        assert isinstance(result, tuple)
        assert len(result) == 2
        assert isinstance(result[0], float)
        assert isinstance(result[1], float)
