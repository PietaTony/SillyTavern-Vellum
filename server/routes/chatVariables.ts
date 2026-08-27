import { Hono } from 'hono';
import { nextVars, VarsBody } from '../lib/varsWrite.ts';
import type { Chat } from '../services/chatModel.ts';
import { safeId } from '../lib/ids.ts';
import { readJson, writeJson } from '../adapters/storage.ts';

/**
 * 卡片腳本的變數（M13 第三期）。**與 `chats.ts` 分開一支**：那支已經貼著 150 行的上限。
 *
 * 🔴 **這支存在的理由是一個實機 bug 的根因**（Peter 2026-08-26：「桌寵目前調整大小沒有用」）。
 * 桌寵把自己的尺寸寫在對話變數裡，而在此之前我們**根本沒有存變數的地方** ——
 * 於是它每次讀回來都是空的，改完下一幀就被自己打回預設。
 * 完整的來龍去脈在 `src/features/cardscripts/runtime/vars.ts` 的檔頭。
 *
 * 🔴 **預設淺層合併。** 卡片一次只寫它關心的那幾個鍵（例如只寫桌寵尺寸），
 * 整包覆寫會把別支腳本的狀態抹掉。
 * ⇒ 要覆寫得**明講**（body 送 `replace`）—— 判準與形狀在 `lib/varsWrite.ts`，三支端點共用。
 *
 * ⚠️ 值一律當成**不透明的資料**，我們不解讀也不驗形狀（`z.unknown()`）——
 * 硬給形狀只會在下一張卡上炸掉。範圍語意見 `chatModel.ts` 的六題。
 */
export const chatVariables = new Hono().patch('/:id/variables', async (c) => {
  const id = safeId(c.req.param('id'));
  if (!id) return c.json({ error: '找不到這段對話' }, 404);
  const body = VarsBody.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: '參數不合法' }, 400);
  const chat = await readJson<Chat | null>(`chats/${id}.json`, null);
  if (!chat) return c.json({ error: '找不到這段對話' }, 404);
  const variables = nextVars(chat.variables, body.data);
  await writeJson(`chats/${id}.json`, { ...chat, variables });
  return c.json({ variables });
});
