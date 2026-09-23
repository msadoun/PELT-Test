# PELT results — US CPI inflation

Visual changepoint analysis of FRED **CPIAUCSL_PC1** (CPI-U all items, percent change from a year ago, monthly, seasonally adjusted) using the **PELT** (Pruned Exact Linear Time) algorithm.

This project shows the **fitted regimes**, not an animation of the algorithm running.

Implementation follows Killick, Fearnhead & Eckley (2012) and the Python reference at [nicodesh/pelt-algorithm](https://github.com/nicodesh/pelt-algorithm). The cost is residual sum of squares for a change in mean. The default BIC penalty is scaled by the sample variance so it is usable on percent-level data (`2 σ² log n`). The original repo’s unscaled `2 log n` penalty is available as a comparison option.

## Dataset

| | |
|---|---|
| Series | `CPIAUCSL_PC1` |
| Source | [FRED](https://fred.stlouisfed.org/series/CPIAUCSL_PC1) workbook `CPIAUCSL_PC1.xlsx` |
| Sample | January 1948 – August 2026 |
| Observations | 943 months (October 2025 is missing in the workbook and is skipped) |

## View the dashboard

Open `index.html` in a browser. No install is required.

If the browser blocks local scripts, serve this folder and open http://127.0.0.1:8765/ :

```powershell
python -m http.server 8765
```

The page draws:

- the CPI year-over-year series
- a horizontal **segment mean** for each regime
- dashed **changepoint** lines
- a colored strip of regime means
- a table of start/end dates, length, mean, min, max, and change in mean

Hover the chart for the date, observed YoY, and current regime mean.

### Controls

| Control | Effect |
|---|---|
| **Penalty** | BIC (default), MBIC, SIC, AIC, or the original unscaled `2 log n` |
| **Penalty multiplier** | Scale the chosen penalty (higher → fewer changepoints) |
| **Minimum segment length** | 6, 12 (default), 24, or 36 months |

## Default fit

BIC, 1× penalty, minimum 12 months: **12 changepoints / 13 regimes**.

| Period | Mean YoY |
|---|---|
| Jan 1948 – Dec 1948 | 7.7% |
| Jan 1949 – Sep 1950 | −0.6% |
| Oct 1950 – Dec 1951 | 7.2% |
| Jan 1952 – Nov 1967 | 1.6% |
| Dec 1967 – Sep 1973 | 4.7% |
| Oct 1973 – Aug 1975 | 10.3% |
| Sep 1975 – Dec 1978 | 6.7% |
| Jan 1979 – Jan 1982 | 11.6% |
| Feb 1982 – Aug 1991 | 4.1% |
| Sep 1991 – Oct 2008 | 2.8% |
| Nov 2008 – Apr 2021 | 1.6% |
| May 2021 – Feb 2023 | 7.0% |
| Mar 2023 – Aug 2026 | 3.1% |

## Python (optional)

Same algorithm, plus a static matplotlib figure.

```powershell
pip install -r requirements.txt
python analyze.py
```

This writes `pelt_results.png` and prints the regimes. `pelt.py` is the library (`pelt`, `backtracking`, penalty helpers).

## Files

```
index.html            Results dashboard
app.js                Chart, table, and controls
pelt.js               PELT (browser)
pelt.py               PELT (Python)
analyze.py            Load the Excel file and save a figure
data/cpiaucsl.json    Extracted series
data/cpiaucsl.js      Same series for the dashboard
CPIAUCSL_PC1.xlsx     Source workbook
requirements.txt      Python dependencies
```
