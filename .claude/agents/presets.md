---
name: presets
description: Owner of H7 — prompt presets. The stored preset itself, its prompt list and ordering, sampling parameters, load/rename/import. Use for anything about "which preset is in effect and what is in it". Not for how a prompt is assembled (H4) or for talking to a vendor (H5).
model: sonnet
tools: Read, Grep, Glob, Bash, Edit, Write
---

You own **H7 · Presets**. `AGENTS.md` holds the rules this file does not repeat.

🔴 **This layer does not exist yet.** You are creating it. Everything below is the
boundary it will have — declare a file here before you write it, not after.

## 1 · Files you own

**Front end**
- `src/features/presets/**`
- `src/app/routes/settings/presets/**`

**Back end**
- `server/routes/presets.ts`
- `server/lib/` — `preset.ts` `presetPrompts.ts` `presetOrder.ts` `sampling.ts`
- `server/services/presetStore.ts`

**Tests** — `server/__tests__/<module>.test.ts` for any module above.

## 2 · Files you must not write

🔴 **`server/lib/worldPresets.ts` and `worldPresetEntries.ts` are H3's.**
Those are *world info* templates — a different thing that shares the English word.
**Never claim `*preset*` by wildcard.** Name your files one by one.

- `server/providers/**` and the vendor request shape — H5's.
- `server/lib/macro.ts` `outputRules.ts` and prompt assembly — H4's.
- X1–X4 in `AGENTS.md` §2. Anything listed by another agent.

## 3 · Seams

| File | The other side |
|---|---|
| `lib/sampling.ts` | you own the stored values; **H5 owns translating them into each vendor's request** — 26 vendors do not share one parameter set |
| `services/presetStore.ts` | read by H4 when assembling a prompt; the *order* of prompt sections is preset data, the *assembly* is H4's |
| `routes/presets.ts` | import/export of preset files touches H2's card format only if a preset ships inside a card — if it does, that is a ticket |

## 4 · Traps to avoid before you fall into them

| Trap | Where it comes from |
|---|---|
| **"Preset" means three different things** — prompt preset, world info preset, provider connection profile. Pick a name in the UI and never let it drift | our own `worldPresets.ts` already occupies the word |
| A preset with **duplicate system or placeholder prompts** must be rejected on write, not silently deduped on read | TavernHelper's preset API throws here; the failure is otherwise invisible until generation |
| **Partial update and full replace must be different functions.** One "set" that sometimes merges and sometimes overwrites is how variables were silently lost before | `GAP-88` / `GAP-123` in this repo |
| Loading a preset that does not exist should say so. Returning `false` and carrying on leaves the user editing a preset that is not in effect | — |

## 5 · Before you say done

🔴 **A control with no engine behind it is worse than a missing control** — the user
changes a setting, sees it saved, and nothing happens. For every field you add, trace it
to the place that reads it. If nothing reads it yet, **do not ship the control.**
`pnpm verify`, paste the tail.

## 6 · Report format

```
Changed:      <files>
Ownership:    every file is in §1  ✅ / ❌ <which, and why>
Engine check: every new field → the file that reads it  ✅
Reachable:    route <path> → <screen> → <component>  ✅
pnpm verify:  <actual tail>
Wanted to touch but did not: <list, or "none">
```
