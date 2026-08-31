# ARCHITECTURE.md — 專案地圖（索引，不是正本）

> 🔴 **本檔是入口，不是百科。** 與其他文件衝突時，依下方「正本優先序」。
> 深度規格 deliberately 不在這個 repo —— 兩份 plans 會漂移（見 `CLAUDE.md` §3）。

---

## 1 · Vellum 是什麼

本機、單人 LLM 角色扮演 app。SillyTavern 1.18.0 的 fork：

| 層 | 技術 | 目錄 |
|---|---|---|
| 前端 | React 19 + Vite + TanStack Router/Query + MUI | `src/app/`（殼層）、`src/features/`（功能） |
| 後端 | **Hono**（自 ST Express 重寫） | `server/` |
| 驗收 | build + test + lint + 自研 gate | `pnpm verify` |
| 授權 | AGPL-3.0-or-later | 公開發版 |

資料在本機 `data/`（角色、對話、金鑰）。**Alpha** —— 破壞性變更仍可能發生。

---

## 2 · Repo 地圖

```
src/
  app/           路由、主題、全站 Provider（X3 組裝線 —— 動前要 ticket）
  features/      10 個功能模組；互相只 import 對方 index.ts（gate:boundaries）
  shared/        跨功能 UI／工具（X1 —— 動前要 ticket）
server/
  app.ts         組裝 Hono app，不啟動（可測性）
  index.ts       啟動、靜態檔、種子
  routes/        HTTP 端點
  lib/           純邏輯／領域模型
  services/      有 IO 的編排（buildTurn、renderChat…）
  adapters/      檔案、網路、子行程
  providers/     LLM vendor 適配
  http/          hostGuard、bodyLimits
scripts/         gate-*.ts、verify-*.ts
design/          screens.json —— UI 里程碑與路由對照
.claude/agents/  十一層 owner 定義 + GAP 陷阱
```

---

## 3 · 正本優先序（衝突時誰贏）

| 優先 | 問的是 | 正本 |
|---|---|---|
| 1 | 能不能跑、測試過不過 | **code** + `pnpm verify` 輸出 |
| 2 | 誰能改哪個檔 | `AGENTS.md` → `.claude/agents/<domain>.md` §1 |
| 3 | 怎麼派工、誰簽 cross-layer | `CLAUDE.md` |
| 4 | 閘門為何存在 | `scripts/gate-*.ts` 檔頭 → [`docs/generated/gate-index.md`](docs/generated/gate-index.md) |
| 5 | 領域踩過的坑 | `.claude/agents/*.md` §4 → [`docs/generated/gap-index.md`](docs/generated/gap-index.md) |
| 6 | 深度規格、取捨、平行流矩陣 | agents home **`plans/`**（見 §5） |
| 7 | 進行中的 lock / ticket | agents home **`INBOX/`** |
| 8 | 現在排隊、發版現況 | **`計畫.md`**（中控看板；可能未 commit） |

---

## 4 · 新人／agent 閱讀順序（約 15 分鐘）

1. **本檔** — 地圖與優先序
2. [`AGENTS.md`](AGENTS.md) — 一檔一寫入者；X1–X4 無主區
3. [`.claude/agents/<domain>.md`](.claude/agents/) — 動手前查 §1 擁有檔、§4 GAP
4. [`docs/generated/gap-index.md`](docs/generated/gap-index.md) — 跨域搜尋 GAP（generated，改 GAP 後跑 `pnpm gen:doc-index`）
5. 要改的路由／畫面 — `design/screens.json` + 對應 `src/app/routes/`
6. 改完 — **`pnpm verify`**，貼真實輸出（「我跑過了」不算）；開 PR 前再跑 **`pnpm gate:pr-ready --diff origin/staging`**（見 [`FEATURE-DONE.md`](FEATURE-DONE.md)）
7. 跨層 — 開 ticket，**Peter 親簽** `Crosses`（見 `AGENTS.md` §3）

---

## 5 · 外部 agents home（不在本 repo）

完整決策脈絡在**第二個本機 repo**，不要複製進來：

| 路徑 | 內容 |
|---|---|
| `/Users/pieta/Personal/SillyTavern-Vellum/plans/` | 規格、架構提案；**入口** [`00-INDEX.md`](/Users/pieta/Personal/SillyTavern-Vellum/plans/00-INDEX.md) |
| `/Users/pieta/Personal/SillyTavern-Vellum/INBOX/` | 進行中的 cross-layer ticket |
| `/Users/pieta/Personal/SillyTavern-Vellum/.claude/skills/release/SKILL.md` | 發版流程 |

只 clone GitHub 的 code repo ⇒ 可跑 app，但**拿不到 §5 的完整規格**。

---

## 6 · 跨層接縫（常踩）

詳表在 [`AGENTS.md` §4](AGENTS.md#4--boundaries-that-are-real-and-which-side-they-fall-on)。最常被忘的三條：

| 接縫 | 兩邊 |
|---|---|
| render | `server/services/renderChat.ts` ↔ `src/features/chat/render/` |
| turn 組裝 | `server/services/buildTurn.ts` 匯 H2/H3/H4 |
| 卡片腳本 | H6 sandbox；**全 repo 尚無 CSP**（見 `card-scripts.md` GAP-81） |

---

## 7 · 生成索引的維護

```bash
pnpm gen:doc-index    # 改 agent §4 或 gate 檔頭後執行
pnpm gate:doc-index   # verify 會跑 —— 索引過期即 FAIL
```

正本仍是 agent 檔與 gate 檔；`docs/generated/` **禁止手改**。

---

## 8 · 十一層 owner（速查）

| Agent | 域 | 目錄提示 |
|---|---|---|
| `chat-core` | H1 對話、stream、swipes | `src/features/chat/`, `server/routes/chats.ts`… |
| `characters` | H2 角色卡、persona | `src/features/characters/` |
| `worldbook` | H3 世界書 | `src/features/worldbook/` |
| `prompt-assembly` | H4 macro、變數模型 | `server/lib/macro.ts`, `vars.ts`… |
| `providers` | H5 LLM vendor | `src/features/providers/`, `server/providers/` |
| `card-scripts` | H6 卡片腳本、sandbox | `src/features/cardscripts/` |
| `platform` | P1 打包、gate、背景 | `scripts/`, `electron/`, `src/features/backgrounds/` |
| `presets` `audio` `extensions` `commands` | H7–H10 🌱 | 邊界已定，code 尚少 |

Dispatch 細節 → [`CLAUDE.md`](CLAUDE.md)。
