# GAP-124 實施計劃：畫面色差隱藏 ID（點讀筆）

> **給 Peter。** 動機、技術路線、分階段交付、驗收標準、派工邊界，一次寫齊。  
> 正本 id 清單：`design/screens.json`。Agent 家 backlog 請同步 `plans/90-BACKLOG.md` GAP-124。

---

## 1 · 這是什麼、為什麼現在就要做

**問題**：外行（或 Peter 自己）丟一張手機截圖給 AI，AI 無法**機械地**回答「現在是 catalog 的哪一張畫面、哪個狀態變體」。  
例：金鑰頁四態共用 `first-run/key`，但設計 id 是 `First-Run--3`／`3a`／`3b`／`3c`——vision 從截圖猜，**浪費 tokens 且易猜錯**。

**點讀筆**：在畫面上嵌入極淡色差文字，內容 = `screens.json` 的 `id`。人眼幾乎看不出；1080p+ 截圖上 VLM／OCR 穩定讀到。  
第一步從「描述整張圖」變成 **O(1) 查表**——後面接 agent team 派工。

**與 ST-V 北極星的關係**：

```
外行截圖 → 讀出 id → screens.json → AGENTS.md 派 owner → INBOX ticket → agent 改 → pnpm verify
```

沒有 id，dispatch 靠 vision 猜 → 派錯 layer → 「外行以為 AI 聽懂了，其實改錯分支」。  
有 id，**定義寫在 UI 上**，跟 gates／ownership 同一套哲學：讓 AI 沒有藉口用模糊描述代替硬事實。

---

## 2 · 目標與非目標

### 目標

| # | 可驗收表述 |
|---|---|
| G1 | 每個可達到的 **screen 狀態**（不是 route）渲染唯一 `screens[].id` |
| G2 | 1080p 截圖上 vision／OCR **≥9/10** 讀對 id |
| G3 | 深／淺主題、backdrop 半透明、有背景圖三種情況仍可讀 |
| G4 | id 一讀出即可查 `screens.json` → route、back、note、里程碑 |
| G5 | gate 守「有 catalog id 的狀態必須有水印」，含 `--selftest` |

### 非目標（本 GAP 不做）

- ❌ DOM `data-*`、aria-label 冒充——給 automation 用，截圖 workflow 用不到  
- ❌ 事後 SoM 標號（OmniParser 系）——那是 agent 自己操作時的事  
- ❌ 用 vision 做「哪裡排版不對」——視覺留給**長相**；**身分**交給 id  
- ❌ 對外開放協議 v1 定稿——先做 Vellum 內部 spec，跑通再抽成公開格式  

---

## 3 · 最小協議（Vellum 內部 v0）

待實作前 Peter 拍板括號內預設；未拍板前用預設值開工。

| 欄位 | 規則 |
|---|---|
| **字串** | 原樣 `screens.json` 的 `id`（例 `First-Run--3b`），不另編碼 |
| **位置** | 右下角安全區，距邊 ≥8px；`position: fixed` 在 viewport 角（待確認是否跟 Screen 外殼捲動） |
| **字級** | 10–11px，等寬或 sans 皆可；**禁止硬寫 hex**（`gate:no-hex` → theme token + `alpha()`） |
| **對比** | 前景 = `alpha(text.primary, 0.04–0.08)` 疊在 `background.default`；深淺各測一輪調係數 |
| **層級** | `z-index` 高於內容、低於 modal／toast；不可攔截 pointer events |
| **環境** | **永遠渲染**（含 production）——這是產品行為，不是 dev-only debug |
| **變體** | 同一 route 多 id 時，由**該 route 的 feature owner** 在 runtime 決定傳哪個 id |

**安全邊界**（回應業界「低 opacity = prompt injection」研究）：  
水印**只允許**白名單字元 `[A-Za-z0-9_-]+`，長度 ≤64，內容**只能**來自 `screens.json` 已登記 id——禁止任意字串、禁止指令語意。

---

## 4 · 架構：誰渲染、誰傳 id

```
┌─────────────────────────────────────────────────────────┐
│  route / screen 元件（feature owner）                      │
│  決定「現在是 --3b 還是 --3c」→ screenId prop            │
└──────────────────────────┬──────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────┐
│  Screen 外殼或 ScreenIdWatermark（X1 ticket）            │
│  固定位置、theme token、pointer-events: none             │
└──────────────────────────┬──────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────┐
│  使用者截圖 → VLM 讀 "First-Run--3b"                     │
│  → design/screens.json → note / route / back             │
│  → AGENTS.md → 該動哪個 agent 的哪些檔                    │
└─────────────────────────────────────────────────────────┘
```

**Cross-layer ticket 必開**（Peter 簽 `Crosses`）：

| Lead | Locks（初稿，實作前再核） |
|---|---|
| X1（UI ticket） | `src/shared/ui/Screen.tsx` 或新 `ScreenIdWatermark.tsx`、`themeTokens` 若需新 token |
| 各 feature | 各自 route 傳 `screenId`（H5 金鑰四態、H1 對話狀態…） |
| P1 | `scripts/gate-screen-id.ts`（新）或擴 `gate-screens-vs-routes.ts` |

`TabBar`、全螢層（ConsentDialog、GreetingsLayer…）也要列 id：在 `screens.json` **先補登**再渲染，避免 gate 假綠燈。

---

## 5 · 分階段交付

### Phase 0 · 規格凍結（1–2 天，Peter + 架構線）

- [ ] 確認位置、opacity 係數、production 是否永遠開（建議：是）  
- [ ] 盤點 active 里程碑（M2）每個 **狀態** 的 id 是否已在 `screens.json` 登記；缺的全補  
- [ ] 寫 cross-layer ticket 進 INBOX，Peter 簽 Locks  

### Phase 1 · 單屏 POC（H5 金鑰四態）

- [ ] `ScreenIdWatermark` 元件 + theme token  
- [ ] `first-run/key` 四態各傳對 id（`--3`／`3a`／`3b`／`3c`）  
- [ ] Peter 真機截圖 10 張 → vision 讀 id 記錄（人工或腳本）  

**Phase 1 過關**：四態各 ≥9/10 讀對，且 Peter 肉眼「不刻意找看不出」。

### Phase 2 · M2 全覆蓋

- [ ] active 里程碑 listed screens 全部接上  
- [ ] 全螢層／overlay 補 `screens.json` 條目 + 水印  
- [ ] 深／淺主題 + backdrop 各測一輪  

### Phase 3 · Gate + dispatch 接線

- [ ] `gate:screen-id`（或擴 `gate:screens`）：掃 route 是否傳 `screenId`、id 是否在 manifest  
- [ ] `--selftest`：mock DOM 含水印 / 缺水印 各 FAIL／PASS  
- [ ] 中控 SOP 更新：截圖 ticket 第一行必含讀出的 id；無 id → 先修 GAP-124 再派工  

### Phase 4 · 可選：對外協議草案

- [ ] 從 v0 抽 `Screen-Identity-Protocol` 一頁 spec（格式、白名單、渲染契約）  
- [ ] 與 Agent 家 `plans/` 合併，不在 code repo 留第二份正本  

---

## 6 · 驗收（Done when）

1. M2 active 內每個 catalog id 對應的 runtime 狀態，實機均有水印。  
2. 抽測 5 個 id × 10 張截圖 ≥9/10 正確（含微信壓縮後若 Peter 要求則加測）。  
3. `pnpm verify` 全綠，含新 gate 的 forward + `--selftest` + 空掃 exit 2。  
4. 文件：`screens.json` `_gaps.124` 標 `done`；Agent 家 backlog 同步。  
5. **Dispatch 試跑**：Peter 丟一張 `3b` 截圖，中控不問澄清即可開 ticket（Lead／Locks 正確）。

---

## 7 · 風險與對策

| 風險 | 對策 |
|---|---|
| 微信／JPEG 壓縮抹掉淡字 | Phase 1 就用 Peter 常用手機壓縮測；必要時調 opacity 下限（仍肉眼不可見為準） |
| 同一 route 傳錯 id | feature 單元測：狀態機 → 預期 id；gate 對照 manifest |
| 被當 prompt injection 攻擊面 | 白名單 id、禁止自由文字；卡片 iframe 不渲染此水印（主 app chrome only） |
| X1 無 owner 卡住 | Peter 開 X1 ticket 指定 Lead；鎖定前不動 `Screen.tsx` |
| catalog 與 runtime 漂移 | id 只從 `screens.json` 生成常數或型別；gate 驗 manifest 覆蓋率 |

---

## 8 · 與「AI agent team、外行都能改」的對照

| 沒有 GAP-124 | 有 GAP-124 |
|---|---|
| 外行：「金鑰頁怪怪的」 | 外行：截圖（水印已含 id） |
| Vision 猜 route + 狀態，耗 tokens | 讀一行 id，查表 |
| 中控 Clarify 一輪 | Ticket 直接寫 `Task: First-Run--3b …` |
| 可能派 H5 改錯分支（3 vs 3b） | Locks 對準 `first-run/key` 失敗態元件 |
| verify 綠但改錯屏 | 改完同一 id 再截，狀態可對帳 |

**Vision 的正確分工**：id 用點讀筆；**排版／顏色／文案**才用 vision 指「哪裡長得不對」。兩者不搶工作。

---

## 9 · 立即下一步（給 Peter）

1. **拍板** Phase 0 括號預設（位置、永遠開、opacity 範圍）。  
2. **簽** cross-layer INBOX ticket（X1 lead + H5 Phase 1 POC）。  
3. **Agent 家** `plans/90-BACKLOG.md` 貼 GAP-124（可從 `_gaps.124` 複製）。  
4. Phase 1 完成後，Peter 真機 10 張截圖驗收——跟 MVU／桌寵面板同一套「你手機上看到的才算數」。

---

*2026-08-28 · 與 `design/screens.json` `_gaps.124`、`scripts/gate-screens-vs-routes.ts` 檔頭交叉引用。*
