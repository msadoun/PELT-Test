"""Run PELT on CPIAUCSL_PC1 and save a results figure."""

from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd

from pelt import (
    backtracking,
    estimate_sigma2,
    penalty_value,
    pelt,
    segment_means,
    segments_from_changepoints,
)


ROOT = Path(__file__).resolve().parent
EXCEL = ROOT / "CPIAUCSL_PC1.xlsx"


def load_cpi(path: Path = EXCEL) -> pd.DataFrame:
    raw = pd.read_excel(path, sheet_name="Monthly")
    raw.columns = ["date", "value"]
    frame = raw.dropna(subset=["value"]).copy()
    frame["date"] = pd.to_datetime(frame["date"])
    frame = frame.sort_values("date").reset_index(drop=True)
    return frame


def plot_results(dates, values, segments, means, changepoints, title, dest):
    fig, ax = plt.subplots(figsize=(14, 6))
    ax.plot(dates, values, color="#6b7280", linewidth=1.1, label="CPI YoY")
    ax.axhline(0, color="#d1d5db", linewidth=0.8)

    for (start, end), mean in zip(segments, means):
        ax.plot(
            [dates[start], dates[end - 1]],
            [mean, mean],
            color="#1d4ed8",
            linewidth=2.4,
            solid_capstyle="butt",
            label="Segment mean" if start == 0 else None,
        )

    for cp in changepoints:
        ax.axvline(dates[cp], color="#c2410c", linestyle="--", linewidth=1, alpha=0.85)

    ax.set_title(title)
    ax.set_xlabel("Date")
    ax.set_ylabel("Percent change from year ago")
    ax.legend(loc="upper right")
    fig.tight_layout()
    fig.savefig(dest, dpi=140)
    plt.close(fig)


def main() -> None:
    frame = load_cpi()
    values = frame["value"].tolist()
    n = len(values)
    sigma2 = estimate_sigma2(values, "variance")
    penalty = penalty_value(n, sigma2, "BIC")
    cp = pelt(values, penalty=penalty, minseglen=12)
    changepoints = backtracking(cp)
    segments = segments_from_changepoints(n, changepoints)
    means = segment_means(values, segments)

    dest = ROOT / "pelt_results.png"
    plot_results(
        frame["date"].tolist(),
        values,
        segments,
        means,
        changepoints,
        "PELT changepoints — CPIAUCSL_PC1 (BIC, min 12 months)",
        dest,
    )
    print(f"n={n} changepoints={len(changepoints)} penalty={penalty:.3f}")
    print(f"saved {dest}")
    for start, end in segments:
        piece = values[start:end]
        mean = sum(piece) / len(piece)
        print(
            f"{frame.loc[start, 'date'].date()} – {frame.loc[end - 1, 'date'].date()} "
            f"({end - start} mo) mean={mean:.2f}"
        )


if __name__ == "__main__":
    main()
