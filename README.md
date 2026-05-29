# 台灣電力即時監控系統

Taiwan real-time power dashboard built with Taipower public/open data.

## Features

- Live current load, utilization, forecast reserve capacity, and reserve margin.
- Unit-level generation parsing from Taipower open data.
- Energy mix charts, category cards, top generating units, and constrained-unit notes.
- Same-origin Node proxy for local/dev deployment so browser CORS does not block official JSON.
- Browser cache, server cache, stale-cache fallback, and built-in sample fallback.
- Responsive visual language aligned with `taiwan-reservoir-static`: Noto Sans TC, Bootstrap Icons, Chart.js, blue/cyan public-data dashboard styling.

## Data Sources

| Dataset | Source |
| --- | --- |
| 今日電力供需狀況 | `https://service.taipower.com.tw/data/opendata/apply/file/d006020/001.json` |
| 各機組發電量即時資訊 | `https://service.taipower.com.tw/data/opendata/apply/file/d006001/001.json` |

Government dataset pages:

- https://data.gov.tw/en/datasets/162595
- https://data.gov.tw/en/datasets/8931

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
│   ├── main.js
│   └── power-data.js
├── data/
│   └── sample-power-data.js
└── tests/
    └── power-data.test.js
```

## Notes

The dashboard uses a small local Node proxy at `/api/power-data` because Taipower's official JSON endpoints are public but do not consistently expose browser-friendly CORS headers. If the proxy and direct fetch both fail, the app falls back to a recent browser cache or sample data and shows a visible degraded-data notice.
