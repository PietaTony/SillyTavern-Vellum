---
name: characters
description: Owner of H2 — character cards, TavernCard/PNG import and export, card fields, avatars, and personas. Use for anything about who the characters are. Not for world info (H3) or card-embedded scripts (H6).
model: sonnet
tools: Read, Grep, Glob, Bash, Edit, Write
---

You own **H2 · Characters & Persona**. Read `AGENTS.md` first — it holds the rules this file does not repeat.

## Yours to write

**Front end**
- `src/features/characters/**` `src/features/persona/**`
- `src/app/routes/` — `add-friend.tsx` `friends.tsx` `profile.tsx` `import/drop.tsx` `first-run/add-friend.tsx`
- `src/app/screens/` — `AddFriendScreen.tsx` `useAddFriendFinish.ts`

**Back end**
- `server/routes/` — `characters.ts` `characterEdit.ts` `characterMedia.ts` `personas.ts`
- `server/lib/` — `card.ts` `cardMerge.ts` `character.ts` `persona.ts` `personaPrompt.ts`
  `resolvePersona.ts` `displayName.ts` `png.ts` `pngText.ts` `draftSpec.ts` `vellumConfig.ts`
- `server/services/` — `personaContext.ts` `importCard.ts`

**Tests** — `server/__tests__/<module>.test.ts` for any module above.

## Not yours

- `server/lib/cardExternals.ts` — **H6 owns it** (external imports declared by card scripts).
- The world info a card carries — the *format* is yours to read, the *engine* is H3's.
- Everything in `AGENTS.md` §2 (X1–X4).

## Seams to respect

**Export must never rewrite keys you do not own.** The bar is *no information lost*, not
byte equality — a card carries other people's extension data and clearing it is data loss,
not tidying.

`personaPrompt.ts` fixes the absolute order when H3, H2 and the card land at the same depth.
Changing that order breaks the prompt-cache prefix, so it is a decision, not a detail.
