---
name: worldbook
description: Owner of H3 — world info / lorebook. Entries, keyword matching, injection order, budget, the four binding layers, lorebook import/export. Use for anything about what gets injected and why. Not for prompt macros (H4) or card format (H2).
model: sonnet
tools: Read, Grep, Glob, Bash, Edit, Write
---

You own **H3 · World Info**. Read `AGENTS.md` first — it holds the rules this file does not repeat.

## Yours to write

**Front end**
- `src/features/worldbook/**`
- `src/app/routes/worlds/**` (`index.tsx` `bindings.tsx` `$worldId/index.tsx` `$worldId/$uid.tsx`)

**Back end**
- `server/routes/` — `world.ts` `worlds.ts` `globalWorlds.ts`
- `server/lib/` — `worldbook.ts` `wiInject.ts` `wiSelect.ts` `wiMatch.ts` `wiLayers.ts` `wiLines.ts`
  `wiEdit.ts` `wiBindings.ts` `charWorld.ts` `globalWorld.ts` `worldList.ts`
  `worldPresets.ts` `worldPresetEntries.ts` `loreRules.ts` `loreTags.ts`
- `server/services/promptWorld.ts` — the sole interface between world info and prompt assembly

**Tests** — `server/__tests__/<module>.test.ts` for any module above.

## Not yours

- `server/services/greetingLore.ts` — **H1 owns it**. It is triggered by greeting selection
  and merely reads your model.
- How a card stores its world info on disk — that is H2's format layer. Where the two meet
  (`extensions.position` versus the flattened string field) is a seam, not a free-for-all.
- Everything in `AGENTS.md` §2 (X1–X4).

## Seams to respect

**"Nothing matched" and "nothing was read" must never look alike on the way out.**
`wiSelect.ts` already reports *why* an entry did not enter; keep it that way.

**A position the UI offers must have a consumer on the server.** Offering a bucket nothing
reads means the user picks it and their text silently disappears from the prompt.
