"""The intervals against published values, and the pre-declared reading of a comparison."""
import math

import pytest

from openclaw_evalbench import stats


def test_wilson_against_published_values():
    low, high = stats.wilson(8, 10)
    assert (round(low, 4), round(high, 4)) == (0.4902, 0.9433)
    # Newcombe 1998 (Statistics in Medicine 17:857), method 3: 81/263 and 15/148 and 0/20.
    for (r, n), want in {(81, 263): (0.2553, 0.3662), (15, 148): (0.0624, 0.1605), (0, 20): (0.0, 0.1611)}.items():
        low, high = stats.wilson(r, n)
        assert (round(low, 4), round(high, 4)) == want


def test_wilson_bounds_and_symmetry():
    assert stats.wilson(0, 0) is None
    for n in (1, 5, 60):
        for r in range(n + 1):
            low, high = stats.wilson(r, n)
            assert 0 <= low <= r / n <= high <= 1
            mirror = stats.wilson(n - r, n)
            assert math.isclose(low, 1 - mirror[1], abs_tol=1e-12) and math.isclose(high, 1 - mirror[0], abs_tol=1e-12)
    with pytest.raises(ValueError):
        stats.wilson(3, 2)


def test_newcombe_against_published_values():
    # Newcombe 1998 (Statistics in Medicine 17:873), method 10: 56/70 - 48/80 and 9/10 - 3/10.
    low, high = stats.newcombe(48, 80, 56, 70)
    assert (round(low, 4), round(high, 4)) == (0.0524, 0.3339)
    low, high = stats.newcombe(3, 10, 9, 10)
    assert (round(low, 4), round(high, 4)) == (0.1705, 0.8090)
    assert stats.newcombe(0, 0, 1, 2) is None


def test_the_prompt_bootstrap_is_wider_when_prompts_carry_the_difference():
    spread = {f"p{i}": (5, 5) if i < 6 else (0, 5) for i in range(12)}
    even = {f"p{i}": (5, 10) for i in range(12)}
    none = {f"p{i}": (0, 5) for i in range(12)}
    none10 = {f"p{i}": (0, 10) for i in range(12)}
    wide, narrow = stats.prompt_bootstrap(none, spread), stats.prompt_bootstrap(none10, even)
    assert wide[1] - wide[0] > 0.3 and narrow == (0.5, 0.5)
    assert stats.prompt_bootstrap(none, spread) == wide  # seeded
    assert stats.prompt_bootstrap({"p": (1, 5)}, {"p": (2, 5)}) is None
    assert stats.prompt_bootstrap({"p": (1, 5), "q": (0, 0)}, {"p": (2, 5), "q": (1, 5)}) is None


@pytest.mark.parametrize("newcombe, bootstrap, reading", [
    ((0.1, 0.4), (0.05, 0.5), "effect"), ((-0.4, -0.1), (-0.5, -0.1), "effect"), ((0.1, 0.4), (-0.05, 0.5), "unclear"),
    ((-0.1, 0.4), (0.05, 0.5), "unclear"), ((-0.1, 0.4), (-0.05, 0.5), "no effect shown"), ((0.1, 0.4), None, "unclear"),
])
def test_an_effect_needs_both_intervals(newcombe, bootstrap, reading):
    assert stats.effect(newcombe, bootstrap) == reading
