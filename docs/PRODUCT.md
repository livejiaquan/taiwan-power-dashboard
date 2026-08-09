# 產品使命與路線圖

最後研究更新：2026-08-09（Asia/Taipei）

## Mission

讓一般使用者在 10 秒內可信地回答三件事：

1. 這筆資料是不是最新、資料有多舊？
2. 台電公布的今日供電狀態是什麼？
3. 現在主要由哪些能源供電？

如果資料不足以回答，產品必須清楚說「目前無法確認」，不得用 sample、抓取時間、部署時間或瀏覽器收件時間製造即時感。

## 為什麼值得存在

台電是 source of truth，但正式頁面與原始資料對一般使用者較難閱讀；既有第三方看板已能畫出即時數字。因此本產品的差異化不是「另一張圖」，而是：

- 把 freshness 與 provenance 放在結論之前。
- 使用台電正式燈號與日常語言解釋「代表什麼／不代表什麼」。
- 保留機組明細供進階查閱，但不讓它阻擋首要答案。
- 未來以可信的歷史脈絡、變化原因與回訪理由創造長期價值。

## 已驗證的產品事實

- 2026-08-09 23:01 直接讀取台電各機組 feed 時，來源時間為 22:50；官方 feed 當下並未普遍過期。
- 現有應用會把過期、缺欄位或錯誤解析的資料誤呈現成正常即時資料；production 亦曾把台電的台灣時間當成 UTC，顯示快 8 小時的未來時間。
- GitHub Actions 排程是 best effort，官方明載 scheduled workflow 可能延遲或被丟棄，不能承諾每 10 分鐘必定更新。
- 台電「備轉容量率」日常燈號的綠燈門檻是 10%，不是年度規劃用的 15%「備用容量率」。
- 政府資料開放授權條款第 1 版要求明確顯名；產品必須列出實際使用的資料集、提供機關與授權。

主要證據：

- [今日電力資訊資料集](https://data.gov.tw/dataset/162595)
- [各機組發電量資料集](https://data.gov.tw/dataset/8931)
- [台電：備用容量與備轉容量的差異](https://hc1.taipower.com.tw/2289/2363/2367/2372/10316/normalPost)
- [台電《源》146 期燈號門檻](https://www.taipower.com.tw/mag/yuan/146/EP146.pdf)
- [GitHub Actions schedule 限制](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
- [政府資料開放授權條款第 1 版](https://data.gov.tw/license)

## Outcome 指標

第一輪的成功不是「頁面做完」，而是：

- 任何 live、delayed、stale、invalid、unavailable 狀態都不會互相偽裝。
- supply 與 generation 分別保存官方來源時間；整體狀態採兩者中較差者。
- 缺 source timestamp、schema 不符或未來時間時 fail closed。
- production 抓取失敗不發布 sample；保留上一版，由前端依 source age 誠實標示 stale。
- 在 UTC 與 Asia/Taipei build 環境產生相同的時間 instant。
- Desktop 與 390px mobile 首屏都先看見資料狀態、年齡與官方供電結論。
- 自動測試與真實瀏覽器涵蓋 live、delayed、stale、invalid、unavailable。

下一階段的產品 outcome 應以 5–8 位非能源背景使用者做理解測試：至少 4/5 能在 10 秒內答出資料狀態、資料年齡與官方供電狀態。這是尚待驗證的研究，不以團隊主觀代替。

## Roadmap

### P0 — 資料可信 contract（目前）

- 整合遠端已完成的萬瓩轉 MW 與儲能占比修正。
- 驗證 schema、必要數值、來源時間與 feed 完整性。
- 以 production safety policy 拒絕機組筆數縮水、已知輸出低於 98% 或供需總量明顯不一致的 snapshot。
- 明確以 Asia/Taipei 解析台電無 offset 時間。
- 建立 `live / delayed / stale / unavailable` 狀態與 partial-feed 語意。
- 採用官方 `G/Y/O/R/B` 燈號，不使用 15% 當日常充裕線。
- 移除 production sample fallback；補齊失敗、快取與 build 測試。
- 防止較舊 snapshot 覆寫較新 last-known-good，並讓已開啟頁面自行跨越 freshness 門檻。
- 在首屏顯示每個來源的資料時間、年齡、來源與授權。

### P1 — 穩定營運與回訪價值

- 建立可重跑的 production build 與 post-deploy freshness smoke check。
- 評估比 GitHub cron 更有 SLA 的 first-party ingestion；在遷移前維持 best-effort 說明。
- 以官方歷史資料提供趨勢與「為什麼變化」，明確區隔即時、歷史與預測。
- 將地址層級停電問題導向台電正式查詢，不用全國備轉資料誤答。

### P2 — 分享、SEO 與正式網域

- 完成 canonical、分享圖、structured data、sitemap、robots 與 404。
- 在確認網域、DNS 權限與 ownership 後才設定 custom domain/CNAME/HTTPS。
- 依實際使用者研究決定通知、個人化或新圖表，不以功能數量為目標。

## Stop doing

P0 通過前，不新增圖表、通知、個人化或視覺裝飾；不宣稱 production-ready；不把 cron 設定值當 freshness SLA；不讓 sample/mock 進 production path；不以缺乏官方依據的 15% 線判斷今日供電。
