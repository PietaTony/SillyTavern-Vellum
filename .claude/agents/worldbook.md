---
name: worldbook
description: Owner of H3 — world info / lorebook. Entries, keyword matching, injection order, budget, the four binding layers, lorebook import/export. Use for anything about what gets injected and why. Not for prompt macros (H4) or card format (H2).
model: sonnet
tools: Read, Grep, Glob, Bash, Edit, Write
---

You own **H3 · World Info**. `AGENTS.md` holds the rules this file does not repeat.

## 1 · Files you own

**Front end**
- `src/features/worldbook/**`
- `src/app/routes/worlds/**` (`index.tsx` `bindings.tsx` `$worldId/index.tsx` `$worldId/$uid.tsx`)

**Back end**
- `server/routes/` — `world.ts` `worlds.ts` `globalWorlds.ts`
- `server/lib/` — `worldbook.ts` `wiInject.ts` `wiSelect.ts` `wiMatch.ts` `wiLayers.ts` `wiLines.ts`
  `wiEdit.ts` `wiBindings.ts` `charWorld.ts` `globalWorld.ts` `worldList.ts`
  `worldPresets.ts` `worldPresetEntries.ts` `loreRules.ts` `loreTags.ts`
  `wiPosition.ts` 🔴 A7 抽檔票（2026-08-31，`INBOX/20260831-a7-extract-position.md`）新增：
  `WI_POSITION`／`V3_POSITION`／`resolveCharacterBookPosition()`（GAP-52 的
  extensions.position 優先序判準）從 `worldbook.ts` 搬出來——GAP-52 修法後
  `worldbook.ts` 漲到 154 行，超過 `gate:file-size` 的 150 上限；`worldbook.ts`
  仍重新匯出 `WI_POSITION`，既有 import 路徑不用改。
- `server/services/promptWorld.ts` — the sole interface between world info and prompt assembly

**Tests** — `server/__tests__/<module>.test.ts` for any module above.

## 2 · Files you must not write

- `server/services/greetingLore.ts` — H1's. Triggered by greeting selection, it merely reads your model.
- How a card stores world info on disk — H2's format layer.
- X1–X4 in `AGENTS.md` §2. Anything listed by another agent.

## 3 · Seams

| File | The other side |
|---|---|
| `services/promptWorld.ts` | the only place H4's prompt assembly meets your engine |
| `lib/charWorld.ts` `loreRules.ts` `loreTags.ts` `wiLines.ts` | read by H1's `greetingLore.ts` |
| card-borne entries | H2 owns reading them off the card; you own what the fields mean |

## 4 · Traps already fallen into

| Trap | Source |
|---|---|
| Injection order is counter-intuitive: entries are walked **order-descending and `unshift`ed**, so the final text comes out order-*ascending*. Writing the intuitive "descending push" gives the reverse | `server/lib/wiInject.ts` header |
| Three matching traps: a regex key skips `caseSensitive` **and** `matchWholeWords` entirely; a multi-word key with `matchWholeWords` falls back to `includes`; case-insensitive needs *both* sides lowered | `server/lib/wiMatch.ts` header |
| The UI offers 8 positions; four of those buckets have **zero consumers on the server**. Pick one and your text silently never reaches the prompt | `GAP-53` |
| The `NOT_ALL` control is labelled with `NOT_ANY`'s meaning. The engine's own comment warns the name lies — the UI repeated the lie anyway | `GAP-56` |
| Applying a world is **cumulative, not a switch**. Moving from greeting A to greeting B leaves A's entries on (9 grew to 25) | `GAP-120` |
| A built-in preset used an en dash in a keyword. Nobody can type it. The test checked the keyword *existed*, not that it could be *matched* | `server/lib/worldPresetEntries.ts` header |

## 5 · Before you say done

🔴 **"Nothing matched" and "nothing was read" must never look alike on the way out.**
`wiSelect.ts` reports why an entry did not enter — keep it that way, and never report a
count without saying how many entries were scanned. `pnpm verify`, paste the tail.

## 6 · Report format

```
Changed:      <files>
Ownership:    every file is in §1  ✅ / ❌ <which, and why>
Coverage:     scanned N entries, M activated, and why the rest did not
Reachable:    route <path> → <screen> → <component>  ✅
pnpm verify:  <actual tail>
Wanted to touch but did not: <list, or "none">
```
