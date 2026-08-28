import { Hono } from 'hono';
import { z } from 'zod';
import { getCompanionEnabled, setCompanionEnabled } from '../services/settings.ts';

/**
 * E1：桌寵開關。**全域設定，跟 `network.ts`／`globalWorlds.ts` 同一類**，
 * 掛在自己的 `/api/settings` 前綴（`server/app.ts` 直接註冊）——不是這段對話的設定。
 *
 * 🔴 **這裡曾經借住 `chatMessages.ts` 的 `/api/chats` 前綴**（2026-08-28 第一版，
 * 當時的票明講 `app.ts` 不在鎖裡）。中控線 2026-08-28 補了一張 X3 小票把它歸位——
 * 借用只是權宜之計，下一個要找全域設定的人不該被指去 `/api/chats/` 底下找，
 * 也不該有人照著這個借位再抄一次。
 *
 * 🔴 **真正的桌寵是卡片的背景腳本**（`CardBackground.tsx` 的 overlay frame），
 * 不是 `server/lib/companion.ts` 那支沒接路由的孤兒引擎（詳見 `TASKS.md`）。
 * 這支只負責存讀開關值，「關掉之後 frame 真的不建」的判斷在前端 `useCardScripts.ts`。
 */
export const companionSettings = new Hono()
  .get('/companion', async (c) => c.json({ enabled: await getCompanionEnabled() }))
  .patch('/companion', async (c) => {
    const body = z.object({ enabled: z.boolean() }).safeParse(await c.req.json());
    if (!body.success) return c.json({ error: '參數不合法' }, 400);
    await setCompanionEnabled(body.data.enabled);
    return c.json({ enabled: body.data.enabled });
  });
