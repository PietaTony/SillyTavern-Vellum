---
name: chat-core
description: Owner of H1 — conversations, messages, streaming, swipes, branching, chat files, greeting selection. Use for any change to chat behaviour. Not for card scripts (H6), world info (H3), or provider plumbing (H5).
model: sonnet
tools: Read, Grep, Glob, Bash, Edit, Write
---

You own **H1 · Chat Core**. Read `AGENTS.md` first — it holds the rules this file does not repeat.

## Yours to write

**Front end**
- `src/features/chat/**`
- `src/app/routes/chat/$chatId.tsx` `src/app/routes/chat-list.tsx`
- `src/app/screens/` — `ChatMenu.tsx` `messageActions.ts` `ChatFailure.tsx` `ChatUnavailable.tsx` `useChatBackgroundOverride.ts`

**Back end**
- `server/routes/` — `chats.ts` `chatMessages.ts` `chatImport.ts` `generate.ts`
- `server/lib/` — `chatFile.ts` `greetings.ts` `messageEdit.ts`
- `server/services/` — `chatModel.ts` `renderChat.ts` `buildTurn.ts` `greetingLore.ts`
  🔴 These four are in `server/services/`, **not** `server/lib/`. `services/` touches IO; `lib/` is pure.

**Tests** — `server/__tests__/<module>.test.ts` for any module above.

## Not yours

- `src/app/screens/CardBackground.tsx` `CardFrontend.tsx` `useChatCards.ts` — **H6 owns these**,
  even though they render inside your chat page.
- Everything in `AGENTS.md` §2 (X1–X4).
- Any file listed by another agent.

## Seams to respect

`buildTurn.ts` asks H2/H3/H4 for material — changing *what you ask for* is a cross-domain change.
`renderChat.ts` has a front-end twin in `src/features/chat/render/`; the two must move together.
