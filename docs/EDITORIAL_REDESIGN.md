# 台灣電力觀測誌：本機改版交付

2026-09-30。分支 `codex/power-editorial-redesign`，起點 `32922dac58c27bd6b2a4858bc4d291b1093407f9`。獨立 checkout，不修改使用者既有專案。本輪未推送、部署或更改 Actions。

## 1. UX Brief

服務看能源新聞、關心供需與發電來源的一般讀者。讓讀者先知道資料是哪一天、是否仍有效，再看官方供電燈號、預估尖峰備轉與來源時間的發電結構。地址附近的停電問題導向台電，不能用全國備轉率作保證。

驗收：窄螢幕先看到來源時間與狀態；主要數字完整、不被旁邊標籤擠壓。機組表只在表格內捲動；所有舊快照的預估尖峰與歷史實績均有明確來源日期。重查舊快照不變新，超過保留期限隱藏數字。

## 2. UX States Matrix

| 狀態 | 觸發 | 畫面 | 下一步 |
|---|---|---|---|
| Loading | 初次取得資料 | 紙色載入畫面，說明正在核對來源與時間 | 等待驗證，沒有範例數字 |
| Empty | 官方 payload 空／欄位不足；或機組沒有備註 | 空 payload 進不可用；沒有備註則只顯示備註區的空狀態 | 重查／官方來源；不把缺資料當零 |
| Error (Recoverable) | 取得失敗，有合法 last-known-good | 保留原來源時間，依實際年齡標明最後成功、延遲或快照 | 重查或官方確認 |
| Error (Fatal) | 無合法資料、未來／不合法資料、超過24小時 | 隱藏所有供需與發電數字，顯示無法確認與重試 | 官方來源 |
| Success | 兩來源有效且在20分鐘內 | 來源時間、官方燈號、指定日期的預估尖峰、發電結構 | 分層閱讀 |
| Disabled/Pending | 重查進行中 | 重查按鈕 disabled、aria-busy；不先清除合法值 | 等待結果；時間仍繼續計算 |
| Partial/Degraded | 延遲／過期、只有一來源有效、圖表 CDN 失敗 | 延遲／過期明標；只有一合法來源不能冒充整頁正常；圖表失敗仍有文字明細 | 查看來源細節或官方頁面 |

資料門檻沿用 [DATA_TRUST_CONTRACT.md](DATA_TRUST_CONTRACT.md)，未放寬 validation、來源 allowlist、新鮮度、單位換算或 sample 拒絕政策。

## 3. Visual Direction

以公共資訊刊物為結構：紙色 `#f3f1e9`、深墨 `#282e29`、朱紅 `#ae422f`，細分隔線取代陰影、漸層與圓角拼卡。中文標題用 Noto Serif TC，正文 Noto Sans TC，數字 IBM Plex Mono；字型無法載入有系統字型後備。

首屏有一個主要百分比，預估尖峰時段／備轉容量／需求用三列資訊。供需、發電、機組依序編號。保留較小的線性燈號讀法，移除半圓儀表盤、裝飾台灣圖與多重徽章。燃料色彩使用一致的低飽和色系，官方供電燈號另保留自己的語意，不把兩者混成風險色。

來源細節、備轉說明與機組備註使用原生 details，預設收合。頁面沒有動畫裝飾，僅重查狀態；支援 reduced-motion。圖表不作數字動畫。

## 4. Component Contracts

- `renderTrustState(result)`：保留原資料政策，顯示兩來源較早時間、transport、狀態及重查結果。來源細節可鍵盤展開，不用下載時間填來源時間。
- `renderHero(model, freshness)`：供需日期取 `supply.observedAt` 的臺灣日曆日；尖峰是該日預估值，不稱目前瞬時值。過期文字保留「最後快照」，主要數字不暗示綠色即時保證。
- `renderStats(model, freshness)`：四項資料列，移除與主區重複的備轉卡；用電與發電各標自身來源時間；尖峰實績使用官方 ROC 原始日期換算，不使用讀者「昨日」。MW 摘要整數四捨五入，完整類別／機組資料保留一位小數。
- `presentation.js`：日期與燃料視覺色的純呈現層，不修改資料 model、估算值或來源。
- Charts／tables：圖表與詳情同色；所有資料有可讀文字，圖表失敗不清空資料。窄螢幕表格可水平捲動並可鍵盤聚焦。

## 5. File Plan

修改 `index.html`、`css/main.css`、`css/components.css`、`js/main.js`、`js/charts.js`；新增 `js/presentation.js`。日期回歸測試在 `tests/presentation.test.js` 與現有 `tests/main-visibility.test.js`。README 與 PRODUCT 更新名稱／日期語意；忽略 Playwright 本機產物。

不修改 API、parser、freshness clock、validation、build ingestion、官方來源或部署 workflow；不新增框架或 runtime dependency。

## 6. Implementation

本機預覽：[http://127.0.0.1:4186/](http://127.0.0.1:4186/)。本機服務只綁定 loopback；服務停止後可從 repo 重跑：

```bash
npm run build
python3 -m http.server 4186 --bind 127.0.0.1 --directory dist
```

建置需要可存取台電兩個官方 endpoint；失敗不生成 sample。本次成功取得 9/30 的真實官方資料，最終前後對照共用同一份 `dist/api/power-data.json`。`/before/` 是本機從基線版本抽出的對照，不是新部署頁面；重新 build 會清除它。

## 7. Verification

- `npm test`：51/51 通過，包含既有資料完整性、台灣時區、萬瓩換算、燈號邊界、快照單調性、拒 sample、失敗不覆寫與已開啟頁面跨期限；新增臺灣午夜／跨年及實績日期 regression。
- `npm run build`：使用真實官方 feed 成功建立靜態產物。
- Playwright：320、390、768、1188、1440px 均無整頁水平溢出，也沒有供需／類別數字溢出。曾發現320px機組表撐頁，已用 grid child `min-width:0` 修正。Chart.js resize 完成後量測，不把尚未完成的下一影格當最終版面。
- 鍵盤首個 Tab 可到 skip link，Enter 聚焦 main；原生來源 details 可點擊／鍵盤開關。
- 重查同一份快照保留時間並明說未更新；章節 hash、圖表、8列機組表、檢修備註正常。
- 測試時鐘以同一真實快照模擬10、21、61、1441分鐘年齡：live→delayed→stale→unavailable；最後狀態隱藏數字。這些截圖以 `test-` 命名，不是實際現況。
- 圖表 CDN 被中止時 fallback 可讀，文字類別仍完整。最終截圖使用另一個全新瀏覽器，沒有測試時鐘或攔截。

原始結果：[Node 測試](../output/playwright/node-tests.log)、[瀏覽器驗收](../output/playwright/qa-results.log)、[真實時鐘前後對照紀錄](../output/playwright/capture-results.log)。

### 前後對照

| | 原版（基線程式＋同份官方快照） | 改版 |
|---|---|---|
| 桌面首屏 | [before-desktop-first.png](../output/playwright/before-desktop-first.png) | [after-desktop-first.png](../output/playwright/after-desktop-first.png) |
| 1188px | [before-compact-first.png](../output/playwright/before-compact-first.png) | [after-compact-first.png](../output/playwright/after-compact-first.png) |
| 手機首屏 | [before-mobile-first.png](../output/playwright/before-mobile-first.png) | [after-mobile-first.png](../output/playwright/after-mobile-first.png) |
| 整頁 | [before-desktop.png](../output/playwright/before-desktop.png) | [after-desktop.png](../output/playwright/after-desktop.png) |
| 手機整頁 | [before-mobile.png](../output/playwright/before-mobile.png) | [after-mobile.png](../output/playwright/after-mobile.png) |

測試狀態：[過期](../output/playwright/test-stale-mobile.png)、[不可用](../output/playwright/test-unavailable-mobile.png)。所有檔案在本機 `output/playwright/`，未推上 repo。

## 8. PR Summary

**What / Why：** 將擁擠的多卡儀表板改為分層的電力資訊閱讀頁。來源日期與可信度優先，指定日期的預估尖峰不再用「今日」指代昨日快照；實績也保留其原始日期。修手機整頁溢出，保留完整資料路徑與所有信任約束。

**Accessibility：** 原生 heading／nav／details／button，skip link、可見 focus、busy狀態與可聚焦捲動表格；不只以顏色傳達供電或資料效期。

**Risks / Follow-ups：** 尚未完整實機／VoiceOver／跨瀏覽器驗收，也沒有使用者研究證明新版理解更快。外部字型／圖表 CDN 是原有類型的依賴，圖表失敗有文字後備。資料更新仍是原本 GitHub best effort，這次本機成功取得新資料不代表已修復 production 排程或找出昨日快照根因。本機靜態預覽隨時間會誠實變成延遲／過期／不可用，需 rebuild 才有新快照。推送／公開部署另待使用者驗收。
