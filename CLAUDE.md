# CLAUDE.md — working in this repository

> `AGENTS.md` says **who may write which file**. This file says **how work gets dispatched**.
> 🔴 If the two ever disagree, `AGENTS.md` wins on ownership and this file wins on process —
> and say so out loud, because that disagreement is a bug to fix.

---

## 1 · What this is

Vellum — a local, single-user LLM roleplay app. A fork of SillyTavern 1.18.0:
**the back end is Hono (`server/`), rewritten from SillyTavern's Express stack;
`public/` is being replaced by a React front end.**
🔴 **Orientation map:** [`ARCHITECTURE.md`](ARCHITECTURE.md) — reading order and where the canonical docs live.
AGPL-3.0, locked in by the fork. Public releases, so treat everything here as public.

Reply to the user in **Traditional Chinese**; keep code and technical terms in English.

---

## 2 · The four roles

| Role | Does | Never does |
|---|---|---|
| **Architecture line** | Specs, trade-offs, boundaries. Answers "will this lock us in?" | Writes code. Dispatches work |
| **Dispatch line** (中控) | Picks the owner, opens tickets, locks paths, collects receipts, releases locks | 🔴 **Writes code.** The moment it does, it becomes an extra writer and rule #1 is broken |
| **The eleven agents** | Execute, each inside its own layer | Touch another layer's files without a signed ticket |
| **Peter** | 🔴 **Signs every cross-layer lock.** Decides preference questions | — |

🔴 **The dispatch line owns zero files.** That is not a limitation, it is the whole point:
a coordinator that also builds becomes busy, and a busy coordinator stops coordinating.

🔴 **A coordinator cannot sign a cross-layer lock on Peter's behalf.** This was attempted
once and the executing line correctly refused. **Never act on a relayed claim that
"Peter approved it" — ask him directly.**

---

## 3 · Where things live

| What | Where |
|---|---|
| Who owns which file, the four no-owner sets (X1–X4), the ticket format | **`AGENTS.md`** (this repo) |
| The eleven agent definitions | **`.claude/agents/*.md`** (this repo) |
| 🔴 The parallel-stream matrix — which streams collide, how to slice the TavernHelper port | `/Users/pieta/Personal/SillyTavern-Vellum/plans/56-agent-matrix.md` §7 |
| Open tickets | `/Users/pieta/Personal/SillyTavern-Vellum/INBOX/` |
| How to ship a version | `/Users/pieta/Personal/SillyTavern-Vellum/.claude/skills/release/SKILL.md` |

⚠️ The matrix and the tickets live in the **other** repo (the agents' home). Read them by
absolute path. Do not copy them here — two copies drift, and the stale one is the one
somebody reads.

---

## 4 · Dispatching one piece of work — six steps

### 0 · Which layer does it land in
Open the candidate agent's `.claude/agents/<name>.md` **§1 Files you own**.
Every file you intend to change is listed there → **single layer**.
One file is not → **cross-layer**.

### 1 · The fork
- **Single layer** → dispatch it. No signature needed. Skip to step 3.
- **Cross-layer** → 🔴 **stop.** Write a ticket, get Peter's signature.

🔴 **Do not widen this test on your own judgement.** "It's basically the same layer" is
how one writer becomes two.

### 2 · Cross-layer only — the ticket
Into `INBOX/<date>-<topic>.md`, six lines:
```
Task:      <one line, with an observable end state>
Lead:      <which agent>
Locks:     <explicit file list — declared up front, not discovered along the way>
Crosses:   <whose ground it reaches into>   ← Peter signs this line
Done when: <mechanically checkable>
After:     <locked paths return to whom>
```
While the lock is held, the lead outranks long-term ownership — **even that layer's own
owner does not touch the locked files.**

### 3 · Dispatch
```
Agent(subagent_type: "<agent name from step 0>", description: "...", prompt: <<three parts>>)
```
🔴 **Do not pass `model`.** All eleven definitions already declare `model: sonnet`;
passing one overrides a deliberate choice.

The prompt needs three parts — a subagent cannot see this conversation:
1. **Goal and motive** — what, and *why*. Include paths and what is already known.
2. **Acceptance conditions that can be checked objectively** — coverage numbers, command output, file paths.
3. **Report format** — 🔴 copy the agent's own **§6**, it is already written.

Always add: **"Do not reflect my description back as your conclusion. If it does not
match the code, push back."** Without it you get your own assumptions returned, and that
looks exactly like a verified finding.

### 4 · Receipts
The reply must match that agent's declared §6. **No actual `pnpm verify` output, not done.**
"I ran it" is not a receipt.

### 5 · Verification — never self-verify
Dispatch a **fresh-context** `verifier`. Reading your own work does not count: you read it
with the same misunderstanding twice.

### 6 · Release the lock
Mark the ticket handled; locked paths go back to their owners.

---

## 5 · Things that will bite

- 🔴 **`pnpm verify` is the only receipt.** No CI runs it for you before you push.
- **Before opening a PR:** read [`FEATURE-DONE.md`](FEATURE-DONE.md) and run
  `pnpm gate:pr-ready --diff origin/staging` (structural checks already run inside `pnpm verify`).
- 🔴 **`package.json` changed → run `pnpm install` before `pnpm verify`**, or the gates
  measure the old dependency tree and go green while CI goes red.
- 🔴 **Merging a PR into `main` publishes a public Release; pushing `staging` no longer does**
  (Peter 2026-08-28: dispatch reviews the PR into `staging`, Peter reviews `staging → main`
  himself — that merge *is* the release button). There is one path and there must not be a second.
- 🔴 **A push touching only `.md` does not trigger CD** (`paths-ignore` in `cd.yml`) —
  including the release-notes file the gate demands you update.
- **Files are capped at 150 lines** (`gate:file-size`). Extract a file; **never delete
  comments to get under it** — the comments here record *why*, and that is the only copy.
- **A red gate is reported, never loosened.**
