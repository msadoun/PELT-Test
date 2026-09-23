"""PELT changepoint detection for a change in mean.

Implementation follows Killick, Fearnhead & Eckley (2012) and the
Python reference at https://github.com/nicodesh/pelt-algorithm, with
prefix-sum costs and a safe pruning loop.
"""

from __future__ import annotations

import math
from typing import Iterable, Sequence


def estimate_sigma2(data: Sequence[float], method: str = "variance") -> float:
    """Estimate residual variance used to scale the PELT penalty."""
    n = len(data)
    if n < 2:
        return 1.0

    if method == "firstdiff":
        diffs = [data[i] - data[i - 1] for i in range(1, n)]
        mean = sum(diffs) / len(diffs)
        var_diff = sum((d - mean) ** 2 for d in diffs) / (len(diffs) - 1)
        return max(var_diff / 2.0, 1e-12)

    mean = sum(data) / n
    return max(sum((x - mean) ** 2 for x in data) / (n - 1), 1e-12)


def penalty_value(
    n: int,
    sigma2: float,
    kind: str = "BIC",
) -> float:
    """Return a penalty on the RSS scale.

    BIC uses ``2 * sigma2 * log(n)``, which matches the nicodesh default
    ``2 * log(n)`` when the series is standardized (sigma2 == 1).
    """
    logn = math.log(n)
    kind = kind.upper()
    if kind == "AIC":
        return 2.0 * sigma2
    if kind == "SIC":
        return sigma2 * logn
    if kind == "MBIC":
        return sigma2 * (1.0 + 2.0 * logn)
    if kind in {"HQ", "HANNAN-QUINN"}:
        return 2.0 * sigma2 * math.log(logn)
    if kind == "NICODE":
        return 2.0 * logn
    return 2.0 * sigma2 * logn


def pelt(
    data: Sequence[float],
    penalty: float | None = None,
    minseglen: int = 2,
) -> list[int]:
    """Return the last-changepoint pointer at each time ``t = 0..n``.

    ``cp[t]`` is the start index of the final segment on ``data[0:t]``.
    ``cp[0]`` is 0. This is the same role as the ``CP`` vector in the
    nicodesh reference.
    """
    n = len(data)
    if n == 0:
        return [0]
    if minseglen < 1:
        minseglen = 1

    prefix = [0.0] * (n + 1)
    prefix_sq = [0.0] * (n + 1)
    for i, value in enumerate(data):
        prefix[i + 1] = prefix[i] + value
        prefix_sq[i + 1] = prefix_sq[i] + value * value

    def rss(start: int, end: int) -> float:
        length = end - start
        total = prefix[end] - prefix[start]
        total_sq = prefix_sq[end] - prefix_sq[start]
        return total_sq - (total * total) / length

    if penalty is None:
        penalty = penalty_value(n, estimate_sigma2(data), "BIC")

    cost = [0.0] * (n + 1)
    last = [0] * (n + 1)
    cost[0] = -penalty
    candidates = [0]

    for t in range(1, n + 1):
        best = math.inf
        best_tau = 0
        for tau in candidates:
            if t - tau < minseglen:
                continue
            value = cost[tau] + rss(tau, t) + penalty
            if value < best:
                best = value
                best_tau = tau
        if best is math.inf:
            best = cost[0] + rss(0, t) + penalty
            best_tau = 0
        cost[t] = best
        last[t] = best_tau

        nxt = []
        for tau in candidates:
            if t - tau < minseglen or cost[tau] + rss(tau, t) <= cost[t]:
                nxt.append(tau)
        if t >= minseglen:
            nxt.append(t)
        candidates = nxt

    return last


def backtracking(cp: Sequence[int]) -> list[int]:
    """Return start indices of each new regime (excluding 0)."""
    changepoints: list[int] = []
    t = len(cp) - 1
    while cp[t] > 0:
        changepoints.append(cp[t])
        t = cp[t]
    changepoints.reverse()
    return changepoints


def segments_from_changepoints(n: int, changepoints: Iterable[int]) -> list[tuple[int, int]]:
    bounds = [0, *changepoints, n]
    return [(bounds[i], bounds[i + 1]) for i in range(len(bounds) - 1)]


def segment_means(data: Sequence[float], segments: Sequence[tuple[int, int]]) -> list[float]:
    means = []
    for start, end in segments:
        piece = data[start:end]
        means.append(sum(piece) / len(piece))
    return means
