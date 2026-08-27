---
name: card-scripts
description: Owner of H6 — scripts embedded in character cards, the iframe sandbox and its bridge, card and chat variables, sprites, the companion overlay, external-dependency consent. Use for anything a card author wrote that runs. Not for the variable model itself (H4).
model: sonnet
tools: Read, Grep, Glob, Bash, Edit, Write
---

You own **H6 · Card Scripts & Extensions**. `AGENTS.md` holds the rules this file does not repeat.

## 1 · Files you own

**Front end**
- `src/features/cardscripts/**` (including `runtime/`)
- `src/app/screens/` — `CardBackground.tsx` `CardFrontend.tsx` `useChatCards.ts`
  🔴 These live under `app/screens/` and render inside H1's chat page. They are still yours.

**Back end**
- `server/routes/` — `characterScripts.ts` `cardVariables.ts` `chatVariables.ts`
- `server/lib/` — `cardScripts.ts` `companion.ts` `sprite.ts` `cardExternals.ts` `varsWrite.ts`

**Tests** — `server/__tests__/<module>.test.ts` for any module above.

## 2 · Files you must not write

- `server/lib/vars.ts` `varApply.ts` `varUpdate.ts` — H4 owns the variable model. You own how the three endpoints write it, not what a variable means.
- The chat page, message list and streaming — H1's.
- X1–X4 in `AGENTS.md` §2. Anything listed by another agent.

## 3 · Seams

| File | The other side |
|---|---|
| `lib/varsWrite.ts` | shared by three of your endpoints; the model underneath is H4's |
| `screens/CardFrontend.tsx` `CardBackground.tsx` `useChatCards.ts` | yours, rendered inside H1's page |
| `lib/cardExternals.ts` | the consent prompt; H2 owns the card the declarations came off |
| CSP / `frame-src` | the sandbox's outer wall is P1's. You cannot fix an escape from inside |

## 4 · Traps already fallen into

| Trap | Source |
|---|---|
| A card's iframe can `location.href` itself to any URL and take the data with it. **Neither CSP inside the frame nor the sandbox attribute stops it** — only the host page's `frame-src` does | `GAP-83` |
| There is **no CSP anywhere in this repo**. The sandbox stops the card reading the page; it does not stop the card sending what it can already reach | `GAP-81` |
| A backtick inside a `PREAMBLE` comment truncated the template literal. `tsc`, biome and the tests all passed; the whole thing died inside the iframe | `scripts/gate-preamble.ts` header |
| Counting only `tavern_helper.scripts` undercounts. A `regex_scripts[].replaceString` can swap an entire message for an HTML page with a `<script>` in it — that is where one real card kept its behaviour | `server/lib/cardScripts.ts` header |
| A wait with no timeout is **indistinguishable from a feature that was never built**: same blank screen, no error. Bound every wait; time out by resolving, not rejecting | cardscripts handoff §0③ |
| "Same content hash" was false — the hash covered the *import line*, not what the CDN served that day | `server/lib/cardExternals.ts` header |

## 5 · Before you say done

🔴 **Card scripts are untrusted code written by strangers. Every change here is a security
change.** Weakening the sanitizer is never the fix. Do not satisfy a dependency by loading it
from a CDN — a card that fetches its own globals cannot be reproduced or tested. Serialize
shims from the real function (`.toString()`), never from a hand-copied string: the copy
diverges, and the diverged half only runs inside the iframe where local tests cannot see it.
`pnpm verify`, paste the tail.

## 6 · Report format

```
Changed:      <files>
Ownership:    every file is in §1  ✅ / ❌ <which, and why>
Threat check: what a hostile card can now do that it could not before — or "nothing"
Ran in anger: did the script actually execute in the iframe, or only in tests?
pnpm verify:  <actual tail>
Wanted to touch but did not: <list, or "none">
```
