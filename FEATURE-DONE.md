# FEATURE-DONE.md — 功能交件分級（Definition of Done）

> 🔴 **這不是第二套 verify。** `pnpm verify` 仍是唯一合併收據；本檔把「做完」拆成三層，
> 讓 agent 知道先交功能、再補文件、最後對齊 PR 敘事。機械部分由 `pnpm gate:pr-ready` 守。

---

## Tier 0 · 必須（沒有就不算做完）

| # | 項目 | 怎麼證明 |
|---|---|---|
| T0-1 | 建置與測試全綠 | `pnpm verify` 真實輸出貼在 PR |
| T0-2 | 改動可達 | 能 trace `route → screen → component`（或對應的 API 路徑） |
| T0-3 | 一檔一寫入者 | 每個改動的檔都在某 agent §1；跨層有 ticket + Peter 簽名 |
| T0-4 | 紅 gate 不繞 | 不刪註解湊行數、不 loosen gate |

---

## Tier 1 · Peter 風格（使用者會看到的品質）

| # | 項目 | 怎麼證明 |
|---|---|---|
| T1-1 | 新 **route** 進設計正本 | `design/screens.json` active 里程碑有對應 `route`；`gate:screens` 綠 |
| T1-2 | 新 **持久化檔** 有六題 | 寫入模組檔頭回答 ①–⑥（對照 `settingsModel.ts`）；`gate:pr-ready` 綠 |
| T1-3 | 安全／網路功能更新 README | `README.md`「安全性」段與 UI 文案不打架 |
| T1-4 | 後端模組有測試 | `server/lib/*.ts`、`server/routes/*.ts` 新增邏輯 → `server/__tests__/<名>.test.ts` |
| T1-5 | 陷阱記 GAP | 非瑣碎決策寫進 owner agent §4；跑 `pnpm gen:doc-index` |

---

## Tier 2 · PR 敘事（審的人不用猜）

| # | 項目 | 怎麼證明 |
|---|---|---|
| T2-1 | PR 用模板 | `.github/PULL_REQUEST_TEMPLATE.md` 各段有填 |
| T2-2 | 老實寫缺口 | 「已知限制／Phase 2」不藏；檔頭 ⚠️ 與 PR 一致 |
| T2-3 | 交件前跑 pr-ready | `pnpm gate:pr-ready`（開 PR 前加 `--diff origin/staging`） |

---

## 建議順序

```
實作 → Tier 0（verify）→ Tier 1（文件／測試／screens）→ Tier 2（PR 文案 + gate:pr-ready）
```

🔴 **不要反過來**：先寫 PR 再補功能，或 verify 紅了先開 draft「之後再修」—— CI 與 Peter 都會擋。
