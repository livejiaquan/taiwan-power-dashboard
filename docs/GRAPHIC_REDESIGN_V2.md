# Power V2：一眼看懂供需

## 1. Brief
延續同一分支，讓非專業讀者先看到官方供電狀態、預估尖峰需求、供電能力與備轉，再展開說明。僅本機；未推送或部署。

## 2. States
保留live / delayed / stale / unavailable、樣本拒絕與各來源時間。延遲或舊資料將實際用電標為快照；超過24小時隱藏數字。來源完整說明可展開，摘要警示持續可見。

## 3. Direction
紙色底、深色狀態區與三條有數值意義的共享刻度長條。橘紅需求、墨綠能力、草綠備轉。沒有假儀表、裝飾運轉百分比或家庭戶數推算。

## 4. Contract
三條圖分别使用forecastMaxSupplyCapacityMw / forecastPeakDemandMw / forecastReserveCapacityMw。刻度取三者最大值，需求超過能力仍不裁切。備轉率原官方百分比，不能當成供給比例。實際用電和機組淨輸出獨立呈現；正輸出結構排除充電負值與缺值。燃料完整清單仍在下方。

## 5. Files
index.html首屏結構；css/components.css視覺與響應式；js/main.js渲染與來源狀態；js/presentation.js純比例計算；tests/presentation.test.js驗證來源與比例；tests/main-visibility.test.js補足DOM父節點mock。沒有改API／爬取／部署流程。

## 6. Implementation
首屏可讀三個MW值與狀態；實際來源時點與發電結構緊接其後。來源、備轉規則與機組備註原生details漸進揭露。鍵盤跳過導覽、展開、刷新與段落導航可用。無新增動態；沿用reduced-motion。

## 7. QA
54/54 Node測試；真實台電資料build成功；node --check与git diff --check成功。Playwright320/390/768/1188/1440無頁面溢位，四種時效狀態與超時隱藏確認，刷新不改來源時間；來源滑鼠與鍵盤展開；機組八列與備註；Chart CDN失敗保留完整文字數字。證據：output/playwright/v2-node-tests.log、v2-browser-qa.log、v2-interaction-qa.log。未測實體手機與VoiceOver。

## 8. Review / 外行理解驗收
畫面驗收：390×844首屏顯示官方供電狀態、21.1%備轉率、48,452MW能力、40,000MW預估需求、8,452MW備轉；日期與『預估／非目前瞬時』同頁可見。這是介面檢查，不是已做使用者研究。
建議找3位不懂電力者看5秒後隱藏畫面，問：這筆資料對應何日？尖峰需求和供給誰較大？是否能把備轉說成現在剩餘電量？至少2/3答對且無人把舊快照当即時，再驗收。若誤解，優先調整狀態與名詞而非再加説明。
對照以同一官方快照展示V1/V2；output/playwright/comparison-v1-v2-desktop.png與comparison-v1-v2-mobile.png，另有v2-mobile-first.png與完整v2-mobile.png。本機http://127.0.0.1:4186/；V1對照/v1/。
