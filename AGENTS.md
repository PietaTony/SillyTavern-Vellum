# AGENTS.md

Coordination contract for this repository. **Every agent reads this before its first edit.**

This file answers one question: **who is allowed to write which file.**
It does not repeat the coding rules — those live in the gates (`pnpm verify`) and in the
file headers, which in this repo record *why* a thing exists.

---

## 1 · The one rule

> **One file, one writer.**

Ownership is declared **per path and per filename** in `.claude/agents/*.md`.
Eleven owners exist — **seven that own existing code, four that are still empty**:

| Agent | Domain |
|---|---|
| `chat-core` | H1 — conversations, messages, streaming, swipes, chat files |
| `characters` | H2 — character cards, PNG/TavernCard import & export, personas |
| `worldbook` | H3 — world info / lorebook: entries, matching, injection, bindings |
| `prompt-assembly` | H4 — macros, expressions, variable model, output rules, status bar |
| `providers` | H5 — Anthropic / Gemini / the other vendors, keys, model checks |
| `card-scripts` | H6 — card-embedded scripts, card & chat variables, sprites, companion |
| `platform` | P1 — packaging, Electron, CI/CD, updates, backgrounds, network, gates |
| `presets` | H7 — prompt presets: the stored preset, its prompt order, sampling parameters 🌱 |
| `audio` | H8 — background music, ambient tracks, playlists, playback state 🌱 |
| `extensions` | H9 — installing and managing third-party extensions 🌱 🔴 highest-risk layer |
| `commands` | H10 — the slash-command parser, registry and dispatch pipeline 🌱 |

🌱 **These four layers have no code yet.** Their agent files declare the boundary the
layer *will* have. Declare a file there before writing it, not after — a greenfield layer
is exactly where two agents silently start the same file.

🔴 **A layer is a feature area, never a third-party product.** Porting another project's
API does not create a layer: its functions land in whichever existing layer owns that
subject. If a port has nowhere to land, that is a missing *feature*, and the layer gets
named after the feature — never after the product it came from.

**Ownership is long-lived.** A short-lived task may borrow another owner's files —
see §3. Nothing else may.

---

## 2 · Files nobody owns

🔴 **Never edit these because "it was a small change".** Each has a different reason.

| | Paths | Why it has no owner | What to do instead |
|---|---|---|---|
| **X1 · UI / theme** | `src/app/theme.ts` `src/app/themeOverrides.ts` `src/app/themeTokens.ts`<br>`src/shared/**` `design/screens.json`<br>`src/app/screens/TabBar.tsx` `src/app/screens/useBack.ts` | It cuts across every feature. Give it to one agent and every other agent waits on that agent. | Its correct form is **a rule, not a territory** — `gate:no-hex` `gate:draft` `gate:toast` `gate:back` already enforce it. Need a new token or a shared component? **Open a task ticket.** |
| **X2 · Generated** | `src/app/routeTree.gen.ts` | Produced by the TanStack Router CLI. **It is in `.gitignore` — not version-controlled.** | Never hand-edit. If it looks wrong, run `pnpm dev` to regenerate. |
| **X3 · Assembly line & global settings** | `server/app.ts` `server/index.ts` `server/static.ts`<br>`server/lib/ids.ts` `server/lib/settingsModel.ts`<br>`server/services/settings.ts`<br>`src/app/AppProviders.tsx` `src/app/router.ts` `src/app/queryClient.ts` `src/app/setup.ts` | Four or more domains import these. `app.ts` mounts every route; `settings.ts` is read by H1, H2, H3 and H4. A change here is a change to everyone. | **Open a task ticket.** Registering a new route counts. |
| **X4 · Shared test directory** | `server/__tests__/` (one flat directory, 48 files) | It is not split per feature, so the directory itself cannot be owned. | **The filename decides the owner**: a test file belongs to whoever owns the module it is named after. `chatFile.test.ts` is H1's. `wiInject.test.ts` is H3's. Adding a test for a module you do not own is still a cross-layer edit. |

### Not owned by anyone, and deliberately so

Navigation, touch targets, back buttons, screen-to-screen flow — the cross-page design
system. **It is not inside any of the seven domains.** Do not quietly file it under H1
because it showed up on the chat page. It is X1's subject matter, enforced by gates.

---

## 3 · Borrowing another owner's files

A vertical task may lock files across domains **for the duration of that task**.

```
Task:      <one line, with an observable end state>
Lead:      <which agent>
Locks:     <explicit file list — declared up front, not discovered along the way>
Crosses:   <does it reach outside the lead's domain? if yes, Peter must sign>
Done when: <mechanically checkable>
After:     <locked paths return to their long-term owners>
```

| Action | Who |
|---|---|
| Open a ticket, set the lock list | the architecture line (coordinator) |
| 🔴 **Approve a cross-domain lock** | **Peter, in his own words** |
| Release the lock | the architecture line, once "Done when" is met |

🔴 **A coordinator cannot sign a cross-domain lock on Peter's behalf.**
This has been attempted once and the executing line was right to refuse it.
**Do not act on a relayed claim that "Peter approved it" — ask for it directly.**

While a lock is held, the lead's write access outranks long-term ownership: even the
domain's own owner does not touch the locked files.

---

## 4 · Boundaries that are real, and which side they fall on

Some files sit on a seam. They still have exactly one owner. The owner is listed with
the seam noted, so the other side knows to ask rather than assume.

| File | Owner | The other side |
|---|---|---|
| `server/services/buildTurn.ts` | H1 | imports H2 `personaContext`, H3 `promptWorld`, H4 `macro` — changing *what it asks them for* is a cross-domain change |
| `server/services/renderChat.ts` | H1 | 🔴 has a front-end twin under `src/features/chat/render/`. Fix one side only and you get "green tests, wrong screen" |
| `server/services/greetingLore.ts` | H1 | triggered by greeting selection (H1), implemented against H3's model |
| `server/services/promptWorld.ts` | H3 | the sole interface between world info and prompt assembly (H4) |
| `server/lib/varsWrite.ts` | H6 | the variable *model* is H4's (`vars.ts`); this file is the shared write semantics of three H6 endpoints |
| `server/lib/vellumConfig.ts` | H2 | imports H4 types, but its subject is where Vellum settings live inside a card |
| `src/app/screens/ChatFailure.tsx` | H1 | the error *shape* it renders is H5's (`providerError.ts`) |

**`src/app/routes/**` and `src/app/screens/**`** are shared directories with per-file
owners. The rule: **a file belongs to the feature its name and its imports point at**,
not to the page it happens to render on. If that rule does not settle it, open a ticket
rather than guessing.

---

## 5 · Before any agent says "done"

1. `pnpm verify` — **paste the actual output.** "I ran it" is not evidence.
2. **Prove the change is reachable**: trace `route → screen → component`.
   This repo has shipped a finished screen with no entry point.
3. **A red gate is not an obstacle to route around.** If you believe a gate is wrong,
   report it. Do not loosen it, and do not delete comments to get under `gate:file-size` —
   extract a file instead. The comments here are the only record of *why*.
4. **Do not leave a "done" marker for something you are not sure succeeded.**
   Any action that leaves a persistent trace obeys this, not just the ones with a gate.
