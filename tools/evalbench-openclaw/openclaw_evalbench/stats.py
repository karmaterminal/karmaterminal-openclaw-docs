"""The pre-declared statistics: Wilson per rate, Newcombe and a prompt bootstrap per difference."""

import math
import random

Z95 = 1.959963984540054
BOOTSTRAP_RESAMPLES = 10_000
BOOTSTRAP_SEED = 1575


def wilson(successes, n, z=Z95):
    """Wilson score interval for successes/n, or None when nothing was scored."""
    if not 0 <= successes <= n:
        raise ValueError(f"{successes} successes of {n}")
    if n == 0:
        return None
    p, z2 = successes / n, z * z
    centre = (p + z2 / (2 * n)) / (1 + z2 / n)
    half = z * math.sqrt(p * (1 - p) / n + z2 / (4 * n * n)) / (1 + z2 / n)
    # At 0 and n successes the bound is 0 and 1 exactly; don't let rounding leave it beside them.
    return (0.0 if successes == 0 else max(0.0, centre - half), 1.0 if successes == n else min(1.0, centre + half))


def newcombe(a, n_a, b, n_b, z=Z95):
    """Newcombe's hybrid score interval for b/n_b - a/n_a, or None when either side scored nothing."""
    wa, wb = wilson(a, n_a, z), wilson(b, n_b, z)
    if wa is None or wb is None:
        return None
    pa, pb = a / n_a, b / n_b
    diff = pb - pa
    return (diff - math.sqrt((pb - wb[0]) ** 2 + (wa[1] - pa) ** 2),
            diff + math.sqrt((wb[1] - pb) ** 2 + (pa - wa[0]) ** 2))


def prompt_bootstrap(a, b, resamples=BOOTSTRAP_RESAMPLES, seed=BOOTSTRAP_SEED):
    """Percentile 95 % interval for the difference in pooled rate, resampling whole prompts.

    `a` and `b` map prompt id -> (elected, scored). Only prompts scored in both arms are used; None without two.
    """
    prompts = sorted(p for p in a if p in b and a[p][1] > 0 and b[p][1] > 0)
    if len(prompts) < 2:
        return None
    rng = random.Random(seed)
    diffs = []
    for _ in range(resamples):
        picked = [prompts[rng.randrange(len(prompts))] for _ in prompts]
        ea, na = sum(a[p][0] for p in picked), sum(a[p][1] for p in picked)
        eb, nb = sum(b[p][0] for p in picked), sum(b[p][1] for p in picked)
        diffs.append(eb / nb - ea / na)
    diffs.sort()
    last = len(diffs) - 1
    return diffs[round(0.025 * last)], diffs[round(0.975 * last)]


def excludes_zero(interval):
    return interval is not None and (interval[0] > 0 or interval[1] < 0)


def effect(newcombe_ci, bootstrap_ci):
    """The pre-declared reading of one comparison."""
    hits = [excludes_zero(newcombe_ci), excludes_zero(bootstrap_ci)]
    return "effect" if all(hits) else "unclear" if any(hits) else "no effect shown"
