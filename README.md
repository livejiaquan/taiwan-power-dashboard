# 台灣電力即時看板

以台電官方開放資料呈現台灣供電狀態、資料新鮮度與發電結構的公共看板。

產品 mission、研究證據與 roadmap 見 [`docs/PRODUCT.md`](docs/PRODUCT.md)；production 的 freshness、fallback 與 validation 規則見 [`docs/DATA_TRUST_CONTRACT.md`](docs/DATA_TRUST_CONTRACT.md)。

## Features

- 首屏先回答「現在電夠不夠」：台電官方 `G/Y/O/R/B` 五燈號、尖峰預估備轉容量率與 6%/10% 門檻尺，紅/黑燈另以備轉容量 MW 說明。
- 「電從哪裡來」100% 燃料別堆疊條，加上再生、低碳、化石三大類占比。
- 發電結構：燃料別輸出占比圓環圖／容量使用率長條圖（ECharts）與明細表。
- 機組查詢：202 筆機組可搜尋、依燃料別篩選、依輸出／容量／使用率排序，並可只看有檢修或限制備註的機組。
- 每個狀態都先標示資料時間：live、delayed、stale、unavailable 由兩份官方來源時間決定，頁面每 15 秒自行重算。
- 淺色／深色模式（預設跟隨系統），手機單欄排版，鍵盤與螢幕閱讀器可用。
- Fail-closed：malformed、缺時間或無法取得的 feed 不會發布 sample 資料；較舊快照不會覆寫較新的 last-known-good。

## Tech Stack

- Vite + React 19 + Tailwind CSS v4，shadcn/ui 風格元件（Radix Tooltip/Tabs、lucide-react 圖示）。
- ECharts（按需載入、延遲載入）繪製圖表；燃料配色參考 Electricity Maps、Open Electricity 與 grid.iamkate.com 的慣例。
- 資料驗證、新鮮度與呈現規則是框架無關的純 JS 模組（`js/`），由 `node --test` 直接測試；React 只訂閱 `js/dashboard-controller.js` 的狀態。

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
npm install
npm run dev
```

Open `http://127.0.0.1:4173`. The Vite dev server mounts a same-origin proxy at `/api/power-data` (see `server/power-api.js`) that fetches and validates both official Taipower feeds.

## Test

```bash
npm test
```

## Production Build

Requires Node.js 22–26 and live access to both official Taipower feeds:

```bash
npm run build      # vite build → build/web, then stage site + official snapshot into dist/
npm run preview    # serve dist/ locally
```

`scripts/build-static-site.js` stages the built app and a freshly validated snapshot before replacing `dist/`. If validation or fetch fails, it exits non-zero without replacing the last successful build or publishing sample data.

## Project Structure

```text
taiwan-power-dashboard/
├── index.html                  # Vite entry
├── vite.config.js
├── src/                        # React UI
│   ├── App.jsx
│   ├── components/             # status card, mix, unit explorer, ui/ primitives
│   ├── hooks/                  # dashboard controller + theme bindings
│   └── lib/                    # fuel palette, utilities
├── js/                         # framework-agnostic data layer (tested directly)
│   ├── api.js                  # same-origin fetch, cache, provenance checks
│   ├── dashboard-controller.js # loading, auto refresh, freshness re-aging
│   ├── dashboard-presenter.js  # trust copy, reserve headline, formatting
│   ├── data-freshness.js
│   ├── freshness-clock.js
│   └── power-data.js           # Taipower parsing + validation
├── server/power-api.js         # dev/preview proxy (Vite plugin)
├── scripts/                    # static snapshot + site build
├── data/sample-power-data.js   # test fixture only; never shipped
├── docs/
└── tests/
```

## Notes

The dashboard uses a same-origin dev proxy at `/api/power-data` (a Vite plugin) because Taipower's official JSON endpoints do not consistently expose browser-friendly CORS headers. GitHub Pages never probes that server-only route or fetches Taipower directly; it reads the same-origin `api/power-data.json` snapshot produced by CI. If a refresh fails, a last-known-good browser/static snapshot may remain visible only with its original source age and a delayed/stale label. Missing, invalid, future-dated, sample, or over-24-hour data becomes unavailable.

## GitHub Pages

This repository includes a GitHub Actions workflow at `.github/workflows/pages.yml`.
On push to `main`, manual dispatch, and a nominal 10-minute schedule, the workflow:

1. installs dependencies and runs the Node test suite;
2. builds the React app with Vite;
3. fetches the latest Taipower JSON from GitHub Actions;
4. validates both source payloads and writes a static `api/power-data.json` snapshot;
5. force-publishes the static build to the `gh-pages` branch.

GitHub Actions scheduled jobs are best effort and can be delayed or skipped. The UI therefore derives freshness only from both official source timestamps, never from the cron setting, build time, or browser cache time. A failed build leaves the previous deployment in place; the client will visibly age it into delayed/stale/unavailable states. Local development uses the same-origin Vite proxy at `/api/power-data`.
