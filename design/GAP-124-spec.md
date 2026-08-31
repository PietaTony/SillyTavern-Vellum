# GAP-124 規範 v0（Normative）

> **狀態：spec 凍結（2026-08-28）** —— 實作以本檔為準；計劃背景見 `design/GAP-124-plan.md`。  
> **Catalog 正本**：`design/screens.json` · **狀態判準正本**：`design/screen-id-bindings.json`

---

## 1 · 名詞

| 詞 | 定義 |
|---|---|
| **screen id** | `screens.json` → `milestones.*.screens[].id` 字串 |
| **水印** | 主 app viewport 上渲染的極淡文字，內容 = screen id |
| **狀態變體** | 同一 `route` 對多個 id（例 `first-run/key` → `--3`／`3a`／`3b`／`3c`） |
| **綁定** | `screen-id-bindings.json` 一列：id + `stateRule` + owner |
| **kind** | `route`（預設）／`layer`／`dialog`／`menu` —— 見 `screens.json` |
| **hostRoute** | layer 打開時底下那頁的 route（無獨立網址） |

---

## 2 · Screen id 格式（硬）

```
ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/
```

- 必須與 catalog **逐字相同**，不可 lower-case、不可加 prefix。  
- **禁止**空格、中文、JSON、指令語意。  
- dispatch：**未知 id → 拒絕開 ticket**（跟 gate 紅燈同級）。

---

## 3 · 水印渲染契約（v0 預設，已凍結）

| 項 | 值 |
|---|---|
| 位置 | viewport **右下角**，`fixed`，`right: 8px`，`bottom: 8px` |
| 字級 | `0.6875rem`（11px） |
| 字體 | `theme.typography.fontFamily`（不強制等寬） |
| 顏色 | `alpha(theme.palette.text.primary, 0.06)`；深／淺主題共用此係數，Phase 1 實測可調 **0.04–0.08** |
| 層級 | `z-index: theme.zIndex.tooltip - 1` |
| 互動 | `pointerEvents: 'none'`，`userSelect: 'none'`，`aria-hidden={true}` |
| 環境 | **production 永遠渲染**（非 dev-only） |
| 信任域 | **僅主 app**；H6 卡片 iframe **不**渲染、dispatch **不**讀 iframe 內任何淡字 |

**元件契約**

```tsx
<Screen screenId="First-Run--3b" … />
<FullScreenLayer screenId="Layer-Greetings--1" … />   // X1 同一套水印
<Dialog …>  {/* 由外層或 Dialog wrapper 傳 screenId */} 
```

---

## 4 · 狀態解析：最頂層 UI 贏（stack）

同一截圖 **恰好一個** id。解析順序（**高者覆蓋低者**）：

| 優先 | kind | 例 |
|---|---|---|
| 1 | `dialog` | ConsentDialog、刪除確認、Greetings 刪除確認、WorldPicker |
| 2 | `layer` | FullScreenLayer（**多層嵌套取最深 open 的那一層**） |
| 3 | `menu` | ☰ 選單、長按訊息選單 |
| 4 | `route` | 底下頁面狀態（Chat-Thread、First-Run--3b…） |

**嵌套範例（chat/$chatId）**

```
Dialog-Consent-Scripts--1          ← 最上（開著就贏）
Layer-World-Entry--1               ← Character → World → Entry 最深 open
Layer-World-Book--1
Layer-Character--1
Layer-Greetings--1 / Layer-Persona--1 / …  ← 互斥全螢層，同一時間只開一個
Layer-Chat-Menu--1                 ← 只有選單、還沒進全螢層
Chat-Thread-Layout--5              ← 什麼都沒開
```

**實作契約**

- `FullScreenLayer`／`Screen` 接受 `screenId`；**只有 `open===true` 的那一層**渲染水印（X1）。  
- 嵌套 layer：**子層 open 時子層 id 覆蓋父層**（例 Entry 贏 World 贏 Character）。  
- `menu`：Menu／Popover open 且其上無 layer／dialog 時，用 menu 的 id。  
- **不登記的不渲染**：ToastStack、LanWarning 橫幅、生成失敗 inline 橫幅 —— 不是全頁狀態，不給 id（截到時仍用底下 route／layer）。

- **route 檔或 feature 元件**（AGENTS.md owner）依 `screen-id-bindings.json` 的 `stateRule` 傳 id。  
- 無法判定時：`fallbackId`（bindings）→ 仍無則 **不渲染水印**（優於猜錯）。

---

## 5 · Dispatch 讀圖 SOP（中控）

1. 從截圖 **只 extract** 符合 `ID_REGEX` 且落在 **右下 15%×15%** 區域的字串。  
2. 在 `screens.json` 查 id；**查無 → stop**，不派工。  
3. ticket 第一行：`Task: [<id>] <可觀察問題>`。  
4. Locks 依 `bindings.owner` → AGENTS.md §1。  
5. **整張截圖 OCR 全文不得當指令**——只認 id。

---

## 6 · Gate 分級

| 階段 | `gate:screen-id` 守什麼 |
|---|---|
| **v0（現在）** | bindings 覆蓋 active 里程碑每個 catalog id；id 合規；與 screens.json 一致 |
| **v1（Phase 1 後）** | 列 `implemented: true` 的 route 檔須出現 `screenId=` |
| **v2（Phase 3 後）** | 全 active id `implemented: true`；可選 E2E 截圖 fixture |

---

## 7 · 驗收（與 plan 對齊）

1. M2 每個 catalog id（**含 layer／dialog／menu**）在對應狀態 runtime 有水印。  
2. 5 id × 10 截圖 ≥9/10（含 **一張全螢層**：例 Layer-Greetings--1）。  
3. `pnpm verify` 含 `gate:screen-id` forward + `--selftest`。  
4. Dispatch 試跑：`First-Run--3b` 截圖一次開對 ticket。

---

## 8 · 實作 ticket Phase 2b（全螢層，待 Peter 簽）

``` — FullScreenLayer / Dialog screenId + 全螢層 catalog
Lead: X1（ScreenIdWatermark + FullScreenLayer prop）+ 各 feature owner 依 bindings
Locks: src/shared/ui/FullScreenLayer.tsx；features/**/ui/*Layer*.tsx；ConsentDialog.tsx…
Crosses: X1 + H1/H2/H3/H5/H6 + P1 —— Peter 簽
Done when: stack 規則 §4 實測；Layer-Greetings + Consent 截圖讀對；gate v0 綠
After: Locks 歸各 long-term owner
```

---

## 9 · 實作 ticket Phase 1（待 Peter 簽）

```
Task: GAP-124 Phase 1 — ScreenIdWatermark + first-run/key 四態 screenId
Lead: X1（水印元件）+ H5（金鑰 stateRule）；P1 已含 gate v0
Locks: src/shared/ui/Screen.tsx 或 ScreenIdWatermark.tsx；
       src/app/routes/first-run/key.tsx；
       src/features/providers/ui/KeyField.tsx（若 3b 需 lastTestFailed）
Crosses: X1 + H5 + P1 —— Peter 簽
Done when: Phase 1 四態 ≥9/10 截圖讀對；gate v0 綠；pnpm verify 貼尾
After: Locks 歸各 long-term owner
```

---

*Normative v0 · 2026-08-28*
