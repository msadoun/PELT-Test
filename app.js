(function () {
  const series = window.SERIES;
  const dates = series.observations.map((row) => row.date);
  const values = series.observations.map((row) => row.value);
  const n = values.length;

  const els = {
    penaltyKind: document.getElementById("penalty-kind"),
    multiplier: document.getElementById("multiplier"),
    multiplierValue: document.getElementById("multiplier-value"),
    minseglen: document.getElementById("minseglen"),
    penaltyOut: document.getElementById("penalty-out"),
    sigmaOut: document.getElementById("sigma-out"),
    countOut: document.getElementById("count-out"),
    regimesOut: document.getElementById("regimes-out"),
    monthsOut: document.getElementById("months-out"),
    rangeOut: document.getElementById("range-out"),
    tableBody: document.getElementById("segment-body"),
    tooltip: document.getElementById("tooltip"),
    canvas: document.getElementById("chart"),
    strip: document.getElementById("strip"),
  };

  const sigma2 = PELT.estimateSigma2(values, "variance");
  els.sigmaOut.textContent = Math.sqrt(sigma2).toFixed(2);
  els.monthsOut.textContent = String(n);
  els.rangeOut.textContent = `${formatMonth(dates[0])} – ${formatMonth(dates[n - 1])}`;

  const state = {
    hover: -1,
  };

  function currentPenalty() {
    const kind = els.penaltyKind.value;
    const multiplier = Number(els.multiplier.value);
    return PELT.penaltyValue(n, sigma2, kind) * multiplier;
  }

  function run() {
    const minseglen = Number(els.minseglen.value);
    const penalty = currentPenalty();
    const fit = PELT.pelt(values, { penalty, minseglen });
    const changepoints = PELT.backtracking(fit.last);
    const segments = PELT.segmentsFromChangepoints(n, changepoints);
    const stats = PELT.segmentStats(values, dates, segments);
    els.penaltyOut.textContent = penalty.toFixed(2);
    els.countOut.textContent = String(changepoints.length);
    els.regimesOut.textContent = String(stats.length);
    els.multiplierValue.textContent = `${Number(els.multiplier.value).toFixed(2)}×`;
    renderTable(stats);
    drawChart(changepoints, stats);
    drawStrip(stats);
    return { changepoints, stats };
  }

  function renderTable(stats) {
    els.tableBody.replaceChildren();
    stats.forEach((row, i) => {
      const prev = i === 0 ? null : stats[i - 1].mean;
      const delta = prev == null ? "—" : `${row.mean - prev >= 0 ? "+" : ""}${(row.mean - prev).toFixed(2)}`;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.index}</td>
        <td>${formatMonth(row.startDate)}</td>
        <td>${formatMonth(row.endDate)}</td>
        <td class="num">${row.months}</td>
        <td class="num">${row.mean.toFixed(2)}</td>
        <td class="num">${row.min.toFixed(2)}</td>
        <td class="num">${row.max.toFixed(2)}</td>
        <td class="num">${delta}</td>
      `;
      els.tableBody.appendChild(tr);
    });
  }

  function formatMonth(iso) {
    const [year, month] = iso.split("-");
    const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${names[Number(month) - 1]} ${year}`;
  }

  function layout(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return {
      ctx,
      width: cssWidth,
      height: cssHeight,
      pad: { top: 18, right: 18, bottom: 36, left: 52 },
    };
  }

  function yBounds(stats) {
    let min = Math.min(...values);
    let max = Math.max(...values);
    stats.forEach((row) => {
      min = Math.min(min, row.mean);
      max = Math.max(max, row.mean);
    });
    const pad = (max - min) * 0.08 || 1;
    return { ymin: min - pad, ymax: max + pad };
  }

  function scales(box, bounds) {
    const innerW = box.width - box.pad.left - box.pad.right;
    const innerH = box.height - box.pad.top - box.pad.bottom;
    return {
      x: (i) => box.pad.left + (i / (n - 1)) * innerW,
      y: (v) => box.pad.top + ((bounds.ymax - v) / (bounds.ymax - bounds.ymin)) * innerH,
      invertX: (px) => {
        const t = (px - box.pad.left) / innerW;
        return Math.round(Math.min(1, Math.max(0, t)) * (n - 1));
      },
      innerW,
      innerH,
    };
  }

  function drawChart(changepoints, stats) {
    const box = layout(els.canvas);
    const { ctx, width, height, pad } = box;
    const bounds = yBounds(stats);
    const s = scales(box, bounds);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    drawGrid(ctx, box, bounds, s);
    ctx.save();
    ctx.beginPath();
    ctx.rect(pad.left, pad.top, s.innerW, s.innerH);
    ctx.clip();

    ctx.strokeStyle = "#9aa3af";
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    values.forEach((value, i) => {
      const x = s.x(i);
      const y = s.y(value);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    stats.forEach((row) => {
      ctx.strokeStyle = meanColor(row.mean);
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(s.x(row.start), s.y(row.mean));
      ctx.lineTo(s.x(row.end - 1), s.y(row.mean));
      ctx.stroke();
    });

    changepoints.forEach((cp) => {
      ctx.strokeStyle = "rgba(194, 65, 12, 0.75)";
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.x(cp), pad.top);
      ctx.lineTo(s.x(cp), pad.top + s.innerH);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    if (state.hover >= 0) {
      const i = state.hover;
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.x(i), pad.top);
      ctx.lineTo(s.x(i), pad.top + s.innerH);
      ctx.stroke();
      ctx.fillStyle = "#111827";
      ctx.beginPath();
      ctx.arc(s.x(i), s.y(values[i]), 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawGrid(ctx, box, bounds, s) {
    const { pad, width, height } = box;
    ctx.strokeStyle = "#e5e7eb";
    ctx.fillStyle = "#6b7280";
    ctx.font = "12px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    const ticks = niceTicks(bounds.ymin, bounds.ymax, 6);
    ticks.forEach((tick) => {
      const y = s.y(tick);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
      ctx.fillText(tick.toFixed(tick >= 10 || tick <= -10 ? 0 : 1), pad.left - 8, y);
    });

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const years = yearTicks();
    years.forEach((item) => {
      const x = s.x(item.index);
      ctx.fillStyle = "#6b7280";
      ctx.fillText(String(item.year), x, height - pad.bottom + 10);
    });

    ctx.save();
    ctx.translate(16, pad.top + s.innerH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillStyle = "#374151";
    ctx.fillText("Percent change from year ago", 0, 0);
    ctx.restore();
  }

  function yearTicks() {
    const startYear = Number(dates[0].slice(0, 4));
    const endYear = Number(dates[n - 1].slice(0, 4));
    const span = endYear - startYear;
    const step = span > 60 ? 10 : 5;
    const ticks = [];
    for (let year = Math.ceil(startYear / step) * step; year <= endYear; year += step) {
      const index = dates.findIndex((d) => d.startsWith(String(year)));
      if (index >= 0) ticks.push({ year, index });
    }
    return ticks;
  }

  function niceTicks(min, max, count) {
    const span = max - min;
    const raw = span / count;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const norm = raw / mag;
    const step = (norm >= 7 ? 10 : norm >= 3 ? 5 : norm >= 1.5 ? 2 : 1) * mag;
    const start = Math.ceil(min / step) * step;
    const ticks = [];
    for (let v = start; v <= max + step * 0.001; v += step) ticks.push(v);
    return ticks;
  }

  function meanColor(mean) {
    if (mean >= 6) return "#b91c1c";
    if (mean >= 4) return "#c2410c";
    if (mean >= 2.5) return "#1d4ed8";
    return "#0f766e";
  }

  function drawStrip(stats) {
    const box = layout(els.strip);
    const { ctx, width, height } = box;
    ctx.clearRect(0, 0, width, height);
    stats.forEach((row) => {
      const x0 = (row.start / n) * width;
      const x1 = (row.end / n) * width;
      ctx.fillStyle = meanColor(row.mean);
      ctx.globalAlpha = 0.22;
      ctx.fillRect(x0, 0, Math.max(1, x1 - x0), height);
      ctx.globalAlpha = 1;
      if (x1 - x0 > 64) {
        ctx.fillStyle = "#374151";
        ctx.font = "11px 'Segoe UI', system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${row.mean.toFixed(1)}%`, (x0 + x1) / 2, height / 2);
      }
    });
  }

  function showTooltip(index, clientX, clientY) {
    if (index < 0) {
      els.tooltip.hidden = true;
      return;
    }
    const regime = currentStats.find((row) => index >= row.start && index < row.end);
    els.tooltip.hidden = false;
    els.tooltip.innerHTML = `
      <strong>${formatMonth(dates[index])}</strong>
      <span>CPI YoY ${values[index].toFixed(2)}%</span>
      <span>Regime mean ${regime ? regime.mean.toFixed(2) : "—"}%</span>
    `;
    const wrap = els.canvas.getBoundingClientRect();
    els.tooltip.style.left = `${clientX - wrap.left + 14}px`;
    els.tooltip.style.top = `${clientY - wrap.top + 14}px`;
  }

  let currentStats = [];
  let currentCps = [];

  function refresh() {
    const result = run();
    currentStats = result.stats;
    currentCps = result.changepoints;
  }

  function pointerIndex(event) {
    const rect = els.canvas.getBoundingClientRect();
    const box = {
      width: rect.width,
      height: rect.height,
      pad: { top: 18, right: 18, bottom: 36, left: 52 },
    };
    const s = scales(box, yBounds(currentStats));
    return s.invertX(event.clientX - rect.left);
  }

  els.canvas.addEventListener("pointermove", (event) => {
    state.hover = pointerIndex(event);
    drawChart(currentCps, currentStats);
    showTooltip(state.hover, event.clientX, event.clientY);
  });
  els.canvas.addEventListener("pointerleave", () => {
    state.hover = -1;
    drawChart(currentCps, currentStats);
    showTooltip(-1);
  });

  ["penalty-kind", "multiplier", "minseglen"].forEach((id) => {
    document.getElementById(id).addEventListener("input", refresh);
  });
  window.addEventListener("resize", refresh);

  refresh();
})();
