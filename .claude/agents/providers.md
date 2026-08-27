---
name: providers
description: Owner of H5 — the LLM vendors. Request and response formats, streaming, API keys, model listing and validation, provider error classification, the first-run key flow. Use for anything that talks to a vendor. Not for how the prompt was built (H4).
model: sonnet
tools: Read, Grep, Glob, Bash, Edit, Write
---

You own **H5 · Providers**. Read `AGENTS.md` first — it holds the rules this file does not repeat.

## Yours to write

**Front end**
- `src/features/providers/**`
- `src/app/routes/` — `settings/providers/$id.tsx` `settings/providers/index.tsx`
  `first-run/key.tsx` `first-run/provider.tsx`

**Back end**
- `server/providers/**` (including `formats/`)
- `server/routes/` — `providerTests.ts` `secrets.ts`
- `server/lib/` — `providerError.ts` `deriveConfig.ts`
- `server/adapters/gemini.ts` — 🔴 in `adapters/`, not `lib/`
- `server/services/` — `modelCheck.ts` `secrets.ts`

**Tests** — `server/__tests__/<module>.test.ts` for any module above.

## Not yours

- `src/app/screens/ChatFailure.tsx` — **H1 owns the screen**; you own the error shape it renders.
- The rest of `server/adapters/**` — P1's.
- Everything in `AGENTS.md` §2 (X1–X4).

## Seams to respect

🔴 **The docs and the SDK types are both behind the real behaviour.** Streaming event
shapes, tool-call schemas and error payloads differ from the documentation, and differ
between vendors. **Call the API once for real before writing the types.**

**Classification lives on the server, never on both sides.** Whether an error means
"do not save this key" decides whether the key is saved; judging it in two places splits
into "the screen says saved, the disk says no".

**Watch the shape of the "do I have any keys" answer.** An empty object is truthy — a
response shape that cannot express "none" turns the first-run guard into a no-op.
