# 台灣電力｜尖峰供需與發電結構

以台電官方開放資料呈現供需、資料時效與發電結構的公共資訊工具。先確認來源日期，再讀供需與備轉；延遲資料與舊快照不冒充此刻。

產品 mission、研究證據與 roadmap 見 [`docs/PRODUCT.md`](docs/PRODUCT.md)；production 的 freshness、fallback 與 validation 規則見 [`docs/DATA_TRUST_CONTRACT.md`](docs/DATA_TRUST_CONTRACT.md)。

## Features

- Clearly labeled live, delayed, stale, and unavailable states based on official source timestamps.
- Current load, utilization, forecast reserve capacity, and Taipower's official `G/Y/O/R/B` status.
- Unit-level generation parsing from Taipower open data.
- Energy mix charts, category detail rows, top generating units, and expandable official unit remarks.
- Same-origin Node proxy for local/dev deployment so browser CORS does not block official JSON.
- Browser/server cache that preserves source age; cached data never becomes fresh merely because it was downloaded again.
- Monotonic per-feed source times: an older refresh cannot overwrite a newer last-known-good snapshot.
- In-page freshness clock that updates delayed/stale/unavailable states even when the network refresh timer is throttled.
- Fail-closed production build: malformed, missing-time, or unavailable feeds do not publish sample data.
- Visual-first power balance: a quantitative forecast demand/capacity arc, independent observed-generation mix, source-time hierarchy, progressive disclosure, and mobile-safe tables.

The V3 design brief is in [`docs/POWER_V3_DESIGN.md`](docs/POWER_V3_DESIGN.md), with verification in [`design-qa.md`](design-qa.md). Screenshots and generated references remain local and are excluded from Git. This branch does not publish GitHub Pages.

## Data Sources

| Dataset | Source |
| --- | --- |
| 今日電力資訊 | `https://service.taipower.com.tw/data/opendata/apply/file/d006020/001.json` |
| 各機組發電量即時資訊 | `https://service.taipower.com.tw/data/opendata/apply/file/d006001/001.json` |

Government dataset pages:

- https://data.gov.tw/dataset/162595
- https://data.gov.tw/dataset/8931

資料提供：台灣電力股份有限公司；依[政府資料開放授權條款第 1 版](https://data.gov.tw/license)使用。本產品不代表台電背書。

## Run Locally

```bash
npm start
```

Open:

```text
http://127.0.0.1:4173
```

## Test

```bash
npm test
```

The read-only workflow at `.github/workflows/ci.yml` runs on pushes to
`codex/power-editorial-redesign` and on pull requests. It checks JavaScript syntax,
runs the complete regression suite, and verifies static site assembly with
fixed-time offline fixtures. The project has no package dependencies or lockfile,
so CI does not install packages. Fixture output is temporary and never published;
a green CI result does not assert that the live Taipower feeds are available or fresh.

## Production Build

Requires Node.js 22–26 and live access to both official Taipower feeds:

```bash
npm run build
```

The command creates `dist/`, validates both payloads and their source timestamps, and exits non-zero without publishing sample data if validation or fetch fails.

## Project Structure

```text
taiwan-power-dashboard/
├── index.html
├── server.js
├── css/
│   ├── main.css
│   └── components.css
├── js/
│   ├── api.js
│   ├── charts.js
│   ├── data-freshness.js
│   ├── freshness-clock.js
│   ├── main.js
│   └── power-data.js
├── docs/
│   ├── DATA_TRUST_CONTRACT.md
│   └── PRODUCT.md
├── data/
│   └── sample-power-data.js  # test/local fixture only; excluded from production artifact
├── scripts/
│   ├── build-static-data.js
│   └── build-static-site.js
└── tests/
    ├── data-trust.test.js
    └── power-data.test.js
```

## Notes

The dashboard uses a small local Node proxy at `/api/power-data` because Taipower's official JSON endpoints do not consistently expose browser-friendly CORS headers. GitHub Pages never probes that server-only route or fetches Taipower directly; it reads the same-origin `api/power-data.json` snapshot produced by CI. If a refresh fails, a last-known-good browser/static snapshot may remain visible only with its original source age and a delayed/stale label. Missing, invalid, future-dated, sample, or over-24-hour data becomes unavailable.

## GitHub Pages

This repository includes a GitHub Actions workflow at `.github/workflows/pages.yml`.
On push to `main`, manual dispatch, and a nominal 10-minute schedule, the workflow:

1. runs the Node test suite;
2. fetches the latest Taipower JSON from GitHub Actions;
3. validates both source payloads and writes a static `api/power-data.json` snapshot;
4. force-publishes the static build to the `gh-pages` branch.

GitHub Actions scheduled jobs are best effort and can be delayed or skipped. The UI therefore derives freshness only from both official source timestamps, never from the cron setting, build time, or browser cache time. A failed build leaves the previous deployment in place; the client will visibly age it into delayed/stale/unavailable states. Local development uses the same-origin Node proxy at `/api/power-data`.
