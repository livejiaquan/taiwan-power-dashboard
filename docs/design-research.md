# 介面重設計研究（2026-10-22，第二輪補充同日）

這份筆記記錄 2026-10 第三輪改版前看過的同類產品，以及最後採用了什麼。前兩輪的資料端點與工程調查見 [`RESEARCH.md`](RESEARCH.md)；這裡只談介面。

調查方式：2026-10-22 用瀏覽器逐一開啟各站的即時頁，觀察首屏、狀態語言、時效標示與手機版；前端技術能從頁面直接看出來的才寫「已確認」，其餘標「未驗證」。

## 看過的產品

| 產品 | 前端／圖表 | 資訊架構 | 配色與狀態語言 | 資料時效呈現 | 行動版 |
| --- | --- | --- | --- | --- | --- |
| [台電 今日電力資訊／各機組發電量](https://www.taipower.com.tw/d006/loadGraph/loadGraph/genshx_.html) | 傳統伺服器頁＋表格（已確認） | 頁首總計 → 燃料別小計 → 機組長表 | 燈號需另開頁面；燃料以小色塊區分 | 頁首一行「更新時間 2026-10-22 15:00」，沒有「幾分鐘前」 | 表格直接縮放，需橫向捲動 |
| [Electricity Maps（台灣）](https://app.electricitymaps.com/zone/TW) | React＋Tailwind（頁面帶有 Tailwind 變數，已確認）；圖表自繪 SVG（未驗證） | 地圖為主，側欄依序：碳強度方塊 → 兩個圓環（無碳、再生）→ 各來源橫條 | 碳強度用單一色階染整個方塊，數字就是顏色 | 時間旁掛「Preliminary」標籤，說明資料仍是初估 | 側欄改為底部抽屜 |
| [GridStatus](https://www.gridstatus.io/live/caiso) | 未驗證（未登入時圖表停在骨架畫面） | 頂端一排 KPI（Load、Net Load、Price、Main Source），下方卡片網格；每張卡右上固定有下載與全螢幕 | 中性灰白，KPI 標籤旁一顆即時點 | KPI 標籤旁的點表示是否為最新值 | 左側欄收合 |
| [EIA Hourly Electric Grid Monitor](https://www.eia.gov/electricity/gridmonitor/) | Angular 21＋Highcharts（頁面 `ng-version` 與 `.highcharts-container`，已確認） | 儀表板＝可自訂的卡片；每張卡有說明、設定、下載三顆鈕 | 政府藍＋灰，變化用箭頭與百分比 | 每個數字上方寫明「10/22/2026 2 a.m. EDT」 | 卡片單欄堆疊 |
| [NESO Carbon Intensity](https://carbonintensity.org.uk/) | 未驗證 | 先給「目前碳強度」一個數字，再講預測與區域 | 數字直接套用 very low → very high 的五級色 | 預測 96 小時以上，實績與預測明確分開 | 單欄 |
| [東京電力 でんき予報](https://www.tepco.co.jp/forecast/index-j.html) | 靜態 HTML（已確認） | 「本日見通し」→「現在の使用状況」→ 曲線；每段先講結論再給數字 | 使用率大字直接上色，數字下方常駐三格門檻圖例（安定的／厳しい／非常に厳しい） | 每段標「16:05 更新」 | 大字照樣大，單欄 |
| [grid.iamkate.com](https://grid.iamkate.com/) | 靜態 PHP 輸出＋SVG（已確認） | 一個同心圓環（發電來源）左右夾著「Demand = Generation + Transfers」等式 | 化石、再生、核能等大類用色塊標題列 | 時間在等式最上方 | 欄位直接堆疊 |
| [Open Electricity](https://explore.openelectricity.org.au/energy/nem/) | SvelteKit 2＋Svelte 5＋LayerCake／d3＋Tailwind 4（依 [opennem/openelectricity](https://github.com/opennem/openelectricity) 的 `package.json`，已確認） | 堆疊面積圖佔七成寬，右側「圖例即表格」：每列是來源、能量、占比 | 每種燃料固定一個顏色，太陽黃、風綠、煤黑褐 | 時間範圍寫在圖表右上 | 表格移到圖下 |

## 觀察

1. **結論的形狀要像這個領域本身的符號。** でんき予報用三格門檻圖例，Carbon Intensity 用五級色，Electricity Maps 用整塊染色。台灣對應的是台電的五色燈號；舊版把它做成漸層色塊，燈號本身反而不見了。
2. **時效是每個數字的一部分，不是另一張卡。** EIA 把時間寫在每個數字上方，GridStatus 在標籤旁放即時點，Electricity Maps 用「Preliminary」標籤。舊版把時效放在 hero 下方一塊大卡，資料過期時的長篇警語比數字還搶眼。
3. **資料過期時仍要讓人讀得出「當時」是什麼。** 本站的 GitHub 排程實際上常延遲數小時（2026-10-22 觀察到 3–5 小時一次），多數訪客看到的都是快照。舊版此時把整個 hero 刷成灰色，等於把最重要的資訊藏起來。台電官網則永遠只寫一行更新時間。
4. **一個大數字＋門檻尺是共通語法。** でんき予報、Carbon Intensity、iamkate 都是「大數字＋常駐分級」，不需要讀者記門檻。
5. **圖表都帶下載與表格。** EIA、GridStatus、NESO 都是如此，本站已有，保留。
6. **手機版都是單欄堆疊**，沒有一家為手機另做資訊架構；差別在首屏能不能看到結論。

## 採用什麼、為什麼

| 採用 | 來自 | 原因 |
| --- | --- | --- |
| Hero 改成「燈號板」：五顆官方燈一字排開，亮起的那顆就是答案，下方是大數字與 0–25% 門檻尺 | 台電燈號、でんき予報門檻圖例 | 直接使用台灣讀者已經認得的符號；顏色之外還有燈位、形狀圖示與文字三重線索 |
| 過期時燈號不熄滅，改為「快照時的燈」：燈仍標出位置，但降低亮度並加斜線，旁邊寫「非即時」 | Electricity Maps 的 Preliminary 標籤 | 符合資料信任契約（主要指標前先標「非即時」），又不把答案藏起來 |
| 時效改成頁首下方一條細帶：狀態點＋來源時間＋「多久前」，過期時多一顆「到台電官網看最新」的連結 | EIA、GridStatus、台電官網 | 時效貼著數字，不再是一張搶戲的卡；給過期資料一條出路 |
| 「此刻」四個數字放進同一塊面板、用細線分隔，而不是四張獨立卡片 | GridStatus 頂端 KPI 列 | 四個數字是同一時間點的同一件事，視覺上應該是一組 |
| 一週預測沿用燈號：每天一顆小燈＋橫條 | Carbon Intensity 預測色帶 | 讓 hero 的符號延續到預測，讀者不用學第二套圖例 |
| 配色從中性 Apple 灰改為冷調鋼灰／夜藍；數字改用 Barlow Semi Condensed（第二輪改為以 Fontsource 自架） | 電塔、配電盤、公路標誌的工業字體 | 讓這個看板有自己的樣子；窄體數字在手機上能放得更大 |
| 框架維持 Vite＋React＋Tailwind＋ECharts | Electricity Maps 同類組合 | 現有資料信任層、測試與 Pages 部署都穩定，換框架只有風險沒有好處 |

沒有採用：

- **地圖**（Electricity Maps、EIA）：台電只公布北中南東四區負載，畫地圖資訊量太少，四個數字更清楚。
- **可自訂儀表板**（EIA、GridStatus）：本站的讀者是一般民眾，固定的閱讀順序比自由排版重要。
- **整塊染色的 hero**（Electricity Maps、舊版）：大面積飽和色在紅、橘燈時過度刺激，而且過期時無法同時表達「當時是綠燈」與「現在不確定」。


## 每個產品拿來做什麼、值得借鏡什麼

| 產品 | 使用者拿它做什麼 | 值得借鏡的功能 | 本站的處理 |
| --- | --- | --- | --- |
| 台電今日電力資訊 | 官方數字的最終依據 | 一行「更新時間」；機組長表 | 時間改成「幾分鐘前」；機組改為可搜尋、可依燃料篩選、預設只列前幾筆 |
| Electricity Maps | 比較各國電網碳強度與發電來源 | 「Preliminary」標籤；圓環呈現占比；來源橫條 | 借用「初估／非即時」標籤的概念；占比改用堆疊橫條（手機上比圓環好讀） |
| GridStatus | 電力交易與分析人員看即時市況 | 頂端 KPI 列；每張卡固定下載與全螢幕 | 「此刻的電網」四格面板；每張圖固定有表格與 CSV |
| EIA Grid Monitor | 研究者查美國各區每小時資料 | 每個數字上方都寫資料時間；卡片三顆固定按鈕 | 每張圖底部寫資料時間與來源 |
| NESO Carbon Intensity | 民眾決定何時用電；開發者串 API | 五級色＋文字分級；96 小時預測 | 一週預測沿用五燈號 |
| 東京電力でんき予報 | 民眾確認今天會不會吃緊 | 大字使用率＋常駐三格門檻圖例 | 大字備轉率＋常駐 0–25% 門檻尺 |
| grid.iamkate.com | 愛好者看英國電網結構 | 「需求＝發電＋進口」等式；極簡單頁 | 「使用率＝目前用電 ÷ 最大供電能力」寫在數字下方 |
| Open Electricity | 澳洲研究者與記者查長期資料 | 圖例即表格（來源、數值、占比同一列） | 發電結構清單同時列功率與占比 |

## 開源實作與授權

| 專案 | 授權 | 用途 | 本站的使用方式 |
| --- | --- | --- | --- |
| [electricitymaps/electricitymaps-contrib](https://github.com/electricitymaps/electricitymaps-contrib) | AGPL-3.0（部分檔案另附 MIT） | 資料 parser；前端已不在此 repo | **只參考概念**（燃料配色慣例、台電 parser 的欄數檢查），未複製程式碼；AGPL 與本專案 MIT 不相容 |
| [opennem/openelectricity](https://github.com/opennem/openelectricity) | MIT | 澳洲電力網站前端 | 參考「圖例即表格」的版面與燃料配色；未複製程式碼 |
| [opennem/opennem-fe](https://github.com/opennem/opennem-fe) | MIT | 前一代前端（Vue） | 僅閱讀 |
| [JacobLinCool/taipower-dashboard](https://github.com/JacobLinCool/taipower-dashboard) | MIT | 台電資料看板 | 僅閱讀，確認台電欄位語意 |
| [apan1121/powerInfoV2](https://github.com/apan1121/powerInfoV2)、[kiang/taipower_data](https://github.com/kiang/taipower_data) | GitHub 未標示授權 | 台電資料累積 | 僅閱讀；未標授權即不可複製 |
| [shadcn/ui](https://github.com/shadcn-ui/ui)、[Radix Primitives](https://github.com/radix-ui/primitives) | MIT | 元件模式與無障礙行為 | 直接使用 Radix 套件；元件寫法依 shadcn 慣例（CSS 變數 token、`cn()`） |
| [Apache ECharts](https://github.com/apache/echarts) | Apache-2.0 | 圖表 | 直接使用，按需註冊、延遲載入 |
| [Fontsource Barlow／Barlow Semi Condensed](https://fontsource.org/fonts/barlow) | OFL-1.1 | 字體 | 自架，只載入 Latin 子集 |

授權檢查方式：2026-10-22 以 GitHub API 讀取各 repo 的 `license.spdx_id`。

## 主流前端設計怎麼做

| 對象 | 觀察到的做法 | 本站採用 |
| --- | --- | --- |
| Linear | 深色優先、極少的顏色，狀態用小色點；以 LCH 等感知色彩空間產生主題 | 介面幾乎全是中性色，彩色只留給燈號與燃料 |
| Vercel（Geist） | 一套自家字體搭配等寬數字；灰階分成多階並以透明度做邊框 | 數字一律用等寬（tabular）字形；邊框用前景色的低透明度 |
| Stripe | 文件公開談過以感知亮度設計可及的色彩系統，確保每個色階對比可預測 | 每組前景／背景都實算對比（下表） |
| Electricity Maps、GridStatus | 資料先於裝飾；時間與資料狀態緊貼數字 | 時效細帶放在所有數字之前 |
| Observable（Plot） | 圖表預設簡潔：細格線、直接標註、少圖例 | 圖表格線用最淡的一階、門檻線直接標註文字 |
| Radix Colors | 12 階色票，每一階有固定用途（背景、元件、邊框、實色、文字） | 色彩 token 依「用途」命名（background、card、muted、border、accent），不依色名 |
| shadcn/ui＋Tailwind | 語意化 CSS 變數＋Tailwind `@theme`，深淺色只換變數 | 同樣架構；本輪把圓角與動效也收進 `@theme` |

## 設計語言

**字體**

- 數字與拉丁字母：Barlow Semi Condensed（大數字、圖表）與 Barlow（內文）。窄體讓大數字在 390px 手機上能放到 104px；造型來自公路與工業標示，貼近電網的語境。
- 中文：系統字體（PingFang TC／Noto Sans TC／微軟正黑體）。中文字型檔動輒數 MB，不值得為了首屏下載。
- 字級：只用一組階梯 12／14／16／18／22／28／36／48／64／96／144px（定義在 `src/index.css` 的 `@theme`）。備轉率 144／96px（桌機／手機），面板數字 48／36px，燈號名稱與章節標題 28–36px，內文與說明 16px（行高 1.75），標籤與控制項 14px，12px 只用於圖表軸標與時間戳。數字一律 `tabular-nums`。

**色彩**（實作在 `src/index.css`）

| Token | 淺色 | 深色 | 用途 |
| --- | --- | --- | --- |
| background | `#edf1f5` | `#0b131c` | 頁面底色：冷調瓷灰／夜藍 |
| card | `#ffffff` | `#121d29` | 面板 |
| foreground | `#13202c` | `#e8eef4` | 主要文字 |
| muted-foreground | `#4b5a69` | `#9cadbf` | 次要文字 |
| accent | `#1d5fd1` | `#73a9ff` | 互動元素、使用率 |
| 燈號板外殼 | `#0e1823` | `#08101a` | 兩種主題都是深色，燈色固定，讀起來像實體號誌 |

實算 WCAG 對比（2026-10-22）：淺色主文字 16.5:1、次要文字 7.1:1（在面板上）／5.8:1（在 muted 上）、accent 5.8:1；深色主文字 14.6:1、次要文字 7.4:1、accent 7.2:1；燈號板說明文字 7.1:1、未亮燈的燈名 4.5:1。全部達 AA。

**間距與圓角**

- 間距只用 4／8／12／16／24／32／48／64px；面板內距手機 20px、桌機 32px，面板之間 12／16px，章節之間 64px。
- 單一容器：最大寬 1280px、左右 gutter 16／24px；首屏所有面板的內容都對齊同一條線（容器邊＋32px）。
- 圓角表達層級，三階就好：`rounded-hero`（28px，只有首屏燈號卡）、`rounded-panel`（20px，所有面板）、`rounded-control`（12px，按鈕、輸入框）。
- 觸控目標：觸控裝置上所有控制項至少 44px（Tailwind `pointer-coarse:` 變體）；頁首按鈕不分裝置都是 44px。

**動效**

- 一條曲線：`--ease-standard: cubic-bezier(0.2, 0, 0, 1)`，所有 `transition` 預設 160ms。
- 全頁只有一個主動播放的動畫：載入時，代表答案的那顆燈「點亮」（900ms）。其他動效只回應使用者操作。
- `prefers-reduced-motion` 時全部關閉。

## 第三輪：視覺實測（2026-10-22）

使用者回饋「沒有視覺焦點、沒有對齊、字太小」。這一輪用同一支 audit 腳本量測本站與兩個標竿，數字如下（`lt14`／`lt12`＝小於 14／12px 的字元占比；焦點＝首屏最大的兩個文字；左緣＝寬度超過 30% 的區塊左緣 x 值與數量）。

| 頁面 | 寬度 | lt14 | lt12 | 首屏最大兩個文字 | 主要左緣 |
| --- | --- | --- | --- | --- | --- |
| IQAir 台北 | 1440 | 7% | 0% | 36px 標題／18px | 232、0、48 |
| IQAir 台北 | 390 | 5% | 0% | 28px 標題／16px | 16、64、0 |
| Electricity Maps 台灣 | 1440 | 47% | 14% | 18px／16px（首屏被 cookie 橫幅遮住） | 208、221、220 |
| Electricity Maps 台灣 | 390 | 48% | 18% | 18px／16px（同上） | 29、0、12 |
| 本站改版前 | 1440 | 33% | 0% | 148px「23.2%」／28px | 154、186 |
| 本站改版前 | 390 | 36% | 0% | 104px／24px | 16、40、36 |
| 本站改版後 | 1440 | 1% | 0% | 144px「23.2%」／28px（5.1 倍） | 104、136 |
| 本站改版後 | 390 | 1% | 0% | 96px／28px（3.4 倍） | 16、36 |

量測方式：IQAir 以 Playwright（系統 Chrome）載入後執行腳本；Electricity Maps 擋 headless 瀏覽器，改在一般瀏覽器內執行，cookie 橫幅未同意，所以它的「首屏最大文字」不代表真實焦點，只採用字級分布。

看齊的方向：

- **字級分布向 IQAir 看齊**：內文 16px 為主、14px 只給標籤與表格，12px 只剩圖表軸標與時間戳（從 33% 降到 1%）。Electricity Maps 大量 10–12px 是地圖工具的取捨，不適合給一般民眾的看板。
- **焦點比 IQAir 更明確**：IQAir 的焦點是 36px 標題，本站把答案本身（備轉率）做成 144px，並用燈號顏色上色（即時與延遲狀態），是第二大文字的 5 倍。
- **對齊**：容器統一為 1280px，所有面板內距桌機 32px、手機 20px，頂層區塊的左緣只剩容器邊與內容邊兩條線。
- **首屏密度**：資料時效橫幅壓成一行（狀態、兩個來源時間、「說明」、官網連結），完整說明收進「說明」展開區；燈號板的判定說明縮成一行。
- **Squint test**：首屏模糊 8px 後，燈號板原本整欄深色、和數字搶焦點；改為只有燈號外殼是深色，其餘回到面板底色。
