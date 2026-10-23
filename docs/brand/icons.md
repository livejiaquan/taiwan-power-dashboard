# 圖示與品牌標記

第六輪（2026-10-23）統一圖示風格：站內所有 UI 圖示都來自 **Lucide**（`lucide-react`，授權為 ISC，與 MIT 相容；規範文件寫 MIT，實際授權以套件為準）。

## 繪製規則

- 線寬 1.75、圓角端點與轉角、無填色、顏色跟隨文字（`currentColor`）。由 `src/index.css` 的 `svg.lucide` 統一設定，元件內不再個別覆寫線寬。
- 尺寸只用三種：16px（行內文字、表格、標籤、外部連結）、20px（按鈕內）、24px（導覽、狀態大圖示）。
- 同一個概念在各處用同一個圖示（例如「供電狀態」在側欄與手機底欄都是 `gauge`）。

## 品牌標記

| 項目 | 規格 |
| --- | --- |
| 檔案 | `public/brand/mark.svg`（頁首、靜態殼層共用）；`public/favicon.svg`（同一圖形）；`public/apple-touch-icon.png`（180px，滿版方形，iOS 自行裁圓角）；`public/brand/mark-square.svg`（apple-touch-icon 的來源） |
| 容器 | 圓角方形，圓角 22%（64 格中 14.08），實心 `#29ae70`（hsl 152°, 62%, 42%，emerald），無邊框、陰影、漸層 |
| 內容 | Lucide `zap`，白色，佔邊長 58%，線寬 2，置中 |
| 頁首 | 標記 32px、間距 10px、字標「台灣電力」16px／600、字距 -0.01em；桌機側欄另有副標「即時供電看板」12px／500 次要色；手機頂列只留字標 |
| 對比 | 白色閃電對 `#29ae70` 約 2.8:1。標誌屬 WCAG 1.4.11 的例外（logo），且規範限定亮度 42–50%，因此不再加深 |

`docs/brand/mark-256.png` 是標記的 256px 預覽。

## 站內圖示對照

| 位置 | 用途 | Lucide 名稱 | 尺寸 |
| --- | --- | --- | --- |
| 側欄／手機底欄 | 供電狀態 | `gauge` | 24 |
| 側欄 | 今日曲線 | `line-chart` | 24 |
| 側欄／手機底欄 | 備轉趨勢 | `bar-chart-3` | 24 |
| 側欄 | 發電結構 | `pie-chart` | 24 |
| 側欄／手機底欄 | 機組 | `cpu` | 24 |
| 側欄／手機底欄 | 說明 | `book-open` | 24 |
| 側欄資料來源、說明頁、資料說明、曲線卡 | 外部連結（另開新視窗） | `external-link` | 16 |
| 側欄／手機頂列 | 暫停／恢復自動更新 | `pause`／`play` | 20 |
| 側欄／手機頂列、錯誤卡片 | 重新檢查資料 | `refresh-cw` | 20 |
| 側欄／手機頂列 | 切換淺色／深色 | `sun`／`moon` | 20 |
| 圖表卡 | 圖表／表格檢視、下載 CSV | `bar-chart-3`／`table-2`／`download` | 20 |
| 說明頁 | 下載快照 JSON | `download` | 20 |
| 說明頁、資料說明 | 展開／收合 | `chevron-down` | 20 |
| 狀態卡、燈號卡、說明頁 | 台電五燈號 | 綠 `circle-check`、黃 `triangle-alert`、橘 `octagon-alert`、紅 `siren`、黑 `ban` | 24（狀態方塊）／16（燈號列、行內） |
| 機組查詢 | 搜尋 | `search` | 20 |
| 機組查詢 | 排序 | `arrow-down-wide-narrow` | 16 |
| 機組查詢、檢修清單 | 檢修／限制備註 | `wrench` | 16 |
| 檢修清單 | 沒有檢修機組 | `check-circle-2` | 24 |
| 錯誤卡片 | 無法取得資料 | `cloud-off` | 24 |

## 被替換或移除的項目

| 原本 | 處理 |
| --- | --- |
| `index.html` 靜態殼層裡手繪的閃電 inline SVG（黃色填色） | 改為 `brand/mark.svg` |
| `index.html` 的 data-URI favicon（手繪深藍方塊＋黃色閃電） | 改為 `favicon.svg`＋`apple-touch-icon.png` |
| 頁首品牌：深色方塊內黃色填色的 `zap`（違反「無填色」） | 改為品牌標記＋字標 |
| 手機底欄 `activity`、`info` | 與側欄一致改為 `gauge`、`book-open` |
| 各處 12／14／18／32／40px 與 42% 的圖示尺寸、個別線寬 2.2／2.4 | 統一到 16／20／24 與線寬 1.75 |

保留未換的 inline SVG：`status-hero.jsx` 的使用率／再生能源環形量表。它是資料圖（依數值畫弧長），不是圖示，Lucide 沒有對應物。

## 移除 GitHub 露出

- 側欄「資料來源」的「原始碼（GitHub）」→ 換成「各機組發電量資料集」（政府資料開放平臺）。
- 頁尾「原始碼以 MIT License 公開於 GitHub」→ 刪除，改為「© 2026 Lim Jia Quan」，不加連結。
- 驗收：`vite build` 後 `grep -rn "github.com" build/web` 為 0 筆。README、LICENSE、`.github/`、`package.json` 依規範不動。
