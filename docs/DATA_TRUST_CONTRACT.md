# 資料可信 Contract

此文件是 production 行為與測試的共同契約。門檻是產品安全政策，不是台電官方 SLA。

## Source of truth

| Feed | 官方資料集 | 必須保存的來源時間 |
| --- | --- | --- |
| 今日電力資訊 | [data.gov.tw/dataset/162595](https://data.gov.tw/dataset/162595) | `publish_time`，以台灣曆法與 `Asia/Taipei` 解析 |
| 各機組發電量 | [data.gov.tw/dataset/8931](https://data.gov.tw/dataset/8931) | `DateTime`；無 offset 時明確視為 `Asia/Taipei` |

`observedAt`（官方來源時間）與 `fetchedAt`（本產品抓取時間）必須分開。不得用 `fetchedAt`、部署時間、commit time、瀏覽器時間或 localStorage 寫入時間補缺失的 `observedAt`。

## Validation

只有在下列條件成立時，feed 才可進入可呈現 model：

- payload 是預期結構，必要 records/rows 非空。
- 供需必要欄位可解析為有限數值，萬瓩欄位先乘以 10 才標為 MW。
- generation 至少有 100 筆可識別的非小計機組，且至少 98% 機組有可解析的淨發電量；`-`、`N/A` 保持 unknown，不默認成 0。這是依目前官方 203 筆、201 筆已知輸出的 safety policy，不是台電 SLA。
- 官方 indicator 僅接受 `G/Y/O/R/B`。
- 來源時間可解析、不是未來超過 2 分鐘，且與另一 feed 沒有無法解釋的日期落差。
- 同時點的機組淨發電總量／目前負載必須介於 0.9–1.1；超出、筆數縮水或完整率不足時 fail closed，不產生「正常」結論。這些門檻是可版本化的 safety policy，需持續以真實 feed 監測。

HTTP 200 或 JSON parse 成功不等於有效。`{}`、錯誤頁 JSON、空 rows、缺時間或缺關鍵欄位都必須是 invalid。

## Freshness state machine

每份 feed 依 `now - observedAt` 分類，整體採較差的狀態：

| 狀態 | 規則 | UI contract |
| --- | --- | --- |
| `live` | 兩份 feed 都有效且 age ≤ 20 分鐘 | 可顯示「最新資料」與官方目前狀態，仍標示實際時間 |
| `delayed` | 任一 feed age > 20 且 ≤ 60 分鐘 | 顯示「資料延遲 N 分鐘」；移除 REALTIME／資料正常語意 |
| `stale` | 任一 feed age > 60 分鐘 | 在所有主要指標之前顯示「非即時」；數字只能作最後成功快照 |
| `unavailable` | 缺資料、invalid、未來時間、兩份 feed 無法形成可信 summary | 顯示「目前無法確認供電狀態」與重試／官方來源；不得顯示綠色正常結論 |

若只有一份 feed 有效，各區塊可以個別顯示，但首頁整體狀態必須是 unavailable/partial，不能把其中一份代表全頁。

## Reserve status

今日供電狀態以官方 `fore_peak_resv_indicator` 為優先：

- `G`：備轉容量率 ≥ 10%
- `Y`：備轉容量率高於 6%、未滿 10%
- `O`：備轉容量率 ≤ 6%
- `R`：備轉容量 ≤ 900 MW
- `B`：備轉容量 ≤ 500 MW

百分比與絕對 MW 是兩種條件，不能只靠百分比自行配色。15% 是年度備用容量規劃概念，不得標為今日備轉「充裕線」。

## Fallback and cache

- Production build 抓取或驗證失敗時必須 non-zero exit，不生成 sample，也不覆蓋上一個 last-known-good deployment。
- Browser cache 只改善載入速度；資料狀態永遠依 `observedAt`，重新下載同一 snapshot 不得重設 age。
- 已呈現頁面至少每 15 秒重算 freshness，並在分頁重新可見時立即重算；跨過 20／60 分鐘或 24 小時門檻時不得等待下一次網路 refresh 才改狀態。
- 新取得的 snapshot 若任一 feed 的 `observedAt` 早於 last-known-good，必須拒絕倒退且不得覆寫 cache。
- Last-known-good 可以保留最多 24 小時供脈絡，但必須依 age 顯示 delayed/stale；超過上限或 schema 不相容時 unavailable。
- Sample fixture 僅供 tests/local explicit demo，永遠不得自動進 production fallback。
- 第三方 proxy/archive 不得無標示取代官方 source of truth。
- Production client 只接受 schema v2、`taipower-static/proxy/direct` allowlist 與兩個明列的台電官方 endpoint provenance。

## Required verification

- Valid official fixture、萬瓩轉 MW、官方燈號邊界。
- `{}`、空 arrays、缺欄、`N/A`、HTML 殘留、未來／無效／缺失時間。
- `TZ=UTC` 與 `TZ=Asia/Taipei` 解析成同一 instant。
- live、20/60 分鐘邊界、mixed-age、stale browser cache、unavailable。
- Production fetch failure 不寫出 sample。
- 真實官方 feed 對照、production build-to-temp、desktop/mobile browser 各狀態、keyboard、console/log。
