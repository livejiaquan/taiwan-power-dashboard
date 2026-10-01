# Power V3 設計依據與實作 brief

## 1. UX Brief
目標：第一次閱讀台灣電力資料的外行。5秒看懂來源日期、台電預估狀態，以及尖峰需求與可供電能力的關係。延續既有repo/branch，真實資料、既有錯誤保護、手機與鍵盤均保留，不推送或部署。

實際研究（2026/09/30，獨立IAB截圖）：
- [National Grid: Live](https://grid.iamkate.com/)：同心環是主角，需求＝發電＋交換獨立成關係式，能源色一貫。採圖形主導與一致色；台灣無交換流資料，不能照造交換項。output/references/national-grid-live.jpg。
- [Electricity Maps](https://app.electricitymaps.com/map)：主畫布留給一個可探索量，色階與時間始終在畫面。採主視覺與固定時間；無地理scope和電力flow來源，不能照造地圖。output/references/electricity-maps.jpg。
- [CAISO Today’s Outlook](https://www.caiso.com/todays-outlook)：供給、需求與定義同視線，現在與預估分列。採關係閱讀與命名；其儲能/下一小時scope不可移植台電來源。output/references/caiso-outlook.jpg。

母對話補充實看reference：[Low Carbon Power 台灣](https://lowcarbonpower.org/region/Republic_of_China_(Taiwan))的明確時間窗與direct labels；[IEA Energy Sankey](https://www.iea.org/data-and-statistics/data-tools/energy-sankey)的穩定比例幾何，但没有完整accounting不得製造Sankey。這兩張未由本機獨立截圖，不混稱本機驗證。

V2不足：頂部品牌、標題、導覽與通知連續耗掉首屏；三條圖仍是文章段落中的配件。供需關係拆成三列，讀者要在文字與圖之間自行拼裝。發電結構退成细帶，缺少視覺重心。

## 2. UX States Matrix
| State | Trigger | UI Response | Recovery/Next Action |
|---|---|---|---|
| Loading | 初次取得來源 | 原讀取狀態 | 等待官方資料驗證 |
| Empty | 來源無法形成合法模型 | 不製造零值 | 重取／台電官方 |
| Error (Recoverable) | 刷新失敗但保留期限內有資料 | 快照、原時間、警示 | 刷新 |
| Error (Fatal) | 無合法來源或超過24小時 | 隱藏圖與數值 | 重取／官方 |
| Success | 两來源新鮮 | 官方燈號＋尖峰預估圖，實際輸出獨立圖 | 展開資料與機組 |
| Disabled/Pending | 正在刷新 | 原按鈕禁用 | 完成後恢復 |
| Partial/Degraded | 時效延遲或圖表資源失敗 | 警示與文字數值保留 | 查來源／重取 |

## 3. Visual Direction
唯一推薦『電力平衡圖』。主畫布深midnight navy，橘色尖峰需求、薄荷色供需差額、官方狀態文字獨立。大型半環是主角，右側是實際正輸出發電結構環圖。無發光、粒子、地圖、裝飾流線或假家庭換算。字體Noto Sans TC＋IBM Plex Mono，14–16px正文。生成視覺稿為構圖目标，實際角度必须以來源數字算出。

## 4. Component Contracts
供需弧：預估需求／max(需求,供給能力)。供需差額＝能力−需求，明確與官方預估備轉及需求分母的備轉率分開；不能把21.1%畫成能力分母空隙。需求超過能力保留超出段。發電環：有限正輸出類別／正輸出总量；淨輸出另列，充電負值不當正輸出。來源不足不render圖。Canvas失敗保留文字與aria說明，不依hover讀核心數字。

## 5. File Plan
index.html主構圖、css主題/響應式、presentation純比例函式、main接線、charts畫布方法、比例測試。API、freshness、爬取、部署流程保留。

## 6. Implementation
已實作大型供需半環、獨立正輸出發電環圖；手機順序為預估、實際用電、發電結構。官方燈號語義色與過期灰化独立；原生來源/規則展開、刷新及機組仍可用。

## 7. Verification

以下為 V3 初版的歷史驗證，不代表後續 cloud polish 的視覺結果。2026/09/30 cloud polish 已重新通過 62 項測試、官方來源 build、語法與 diff 檢查；瀏覽器視覺驗證仍受 loopback 存取限制，先前 terminal.local 預覽回傳 502，尚未通過。2026/10/01 可讀性更新將正文提升為 1rem、關鍵標籤 14px-equivalent、metadata 最低 13px-equivalent，調整 chart 與窄螢幕重排，並修正手機 DOM／視覺順序差異；69 項測試與官方來源 build 通過。最新限制與待驗證項目見根目錄 `design-qa.md` 的 Current readability verification。
56/56測試、官方來源build、node --check、git diff --check通过。320/390/768/1188/1440無溢位；鍵盤、刷新（不變或合法新來源）、來源展開、四種時效狀態與圖表CDN失敗回退通過。來源快照16:40，最終實際用電38,235MW，機組淨輸出38,235MW。視覺QA見根目錄design-qa.md，final result: passed。

## 8. PR Summary
主視覺由附屬長條改成一個可讀的供需關係圖，發電結構另圖呈現。補2項能力/需求分母與差額不等於官方備轉測試。API/時效/部署流程保留；同branch本機未推送或部署。UI截圖比較V2/V3採同一官方快照，證據在output/playwright；圖中例值不代表網站日後持續即時。真人理解與實體手機仍待驗證。所有reference與報告僅保留本機，輸出聊天只傳網站UI截圖。
