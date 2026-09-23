/**
 * PELT changepoint detection for a change in mean.
 * Killick, Fearnhead & Eckley (2012); nicodesh/pelt-algorithm.
 */
(function (root) {
  function estimateSigma2(data, method) {
    const n = data.length;
    if (n < 2) return 1;
    if (method === "firstdiff") {
      let sum = 0;
      let sumsq = 0;
      for (let i = 1; i < n; i += 1) {
        const d = data[i] - data[i - 1];
        sum += d;
        sumsq += d * d;
      }
      const m = n - 1;
      const varDiff = (sumsq - (sum * sum) / m) / (m - 1);
      return Math.max(varDiff / 2, 1e-12);
    }
    let sum = 0;
    for (let i = 0; i < n; i += 1) sum += data[i];
    const mean = sum / n;
    let ss = 0;
    for (let i = 0; i < n; i += 1) {
      const d = data[i] - mean;
      ss += d * d;
    }
    return Math.max(ss / (n - 1), 1e-12);
  }

  function penaltyValue(n, sigma2, kind) {
    const logn = Math.log(n);
    switch ((kind || "BIC").toUpperCase()) {
      case "AIC":
        return 2 * sigma2;
      case "SIC":
        return sigma2 * logn;
      case "MBIC":
        return sigma2 * (1 + 2 * logn);
      case "HQ":
        return 2 * sigma2 * Math.log(logn);
      case "NICODE":
        return 2 * logn;
      default:
        return 2 * sigma2 * logn;
    }
  }

  function pelt(data, options) {
    const n = data.length;
    const minseglen = Math.max(1, (options && options.minseglen) || 2);
    const penalty = options && options.penalty != null
      ? options.penalty
      : penaltyValue(n, estimateSigma2(data, "variance"), "BIC");

    const prefix = new Float64Array(n + 1);
    const prefixSq = new Float64Array(n + 1);
    for (let i = 0; i < n; i += 1) {
      prefix[i + 1] = prefix[i] + data[i];
      prefixSq[i + 1] = prefixSq[i] + data[i] * data[i];
    }

    function rss(start, end) {
      const length = end - start;
      const sum = prefix[end] - prefix[start];
      const sumsq = prefixSq[end] - prefixSq[start];
      return sumsq - (sum * sum) / length;
    }

    const cost = new Float64Array(n + 1);
    const last = new Int32Array(n + 1);
    cost[0] = -penalty;
    let candidates = [0];

    for (let t = 1; t <= n; t += 1) {
      let best = Infinity;
      let bestTau = 0;
      for (let i = 0; i < candidates.length; i += 1) {
        const tau = candidates[i];
        if (t - tau < minseglen) continue;
        const value = cost[tau] + rss(tau, t) + penalty;
        if (value < best) {
          best = value;
          bestTau = tau;
        }
      }
      if (!Number.isFinite(best)) {
        best = cost[0] + rss(0, t) + penalty;
        bestTau = 0;
      }
      cost[t] = best;
      last[t] = bestTau;

      const next = [];
      for (let i = 0; i < candidates.length; i += 1) {
        const tau = candidates[i];
        if (t - tau < minseglen || cost[tau] + rss(tau, t) <= cost[t]) {
          next.push(tau);
        }
      }
      if (t >= minseglen) next.push(t);
      candidates = next;
    }

    return { last, cost, penalty };
  }

  function backtracking(last) {
    const changepoints = [];
    let t = last.length - 1;
    while (last[t] > 0) {
      changepoints.push(last[t]);
      t = last[t];
    }
    changepoints.reverse();
    return changepoints;
  }

  function segmentsFromChangepoints(n, changepoints) {
    const bounds = [0, ...changepoints, n];
    const segments = [];
    for (let i = 0; i < bounds.length - 1; i += 1) {
      segments.push({ start: bounds[i], end: bounds[i + 1] });
    }
    return segments;
  }

  function segmentStats(data, dates, segments) {
    return segments.map((seg, index) => {
      let sum = 0;
      let min = Infinity;
      let max = -Infinity;
      for (let i = seg.start; i < seg.end; i += 1) {
        const value = data[i];
        sum += value;
        if (value < min) min = value;
        if (value > max) max = value;
      }
      const mean = sum / (seg.end - seg.start);
      return {
        index: index + 1,
        start: seg.start,
        end: seg.end,
        startDate: dates[seg.start],
        endDate: dates[seg.end - 1],
        months: seg.end - seg.start,
        mean,
        min,
        max,
      };
    });
  }

  root.PELT = {
    estimateSigma2,
    penaltyValue,
    pelt,
    backtracking,
    segmentsFromChangepoints,
    segmentStats,
  };
})(window);
