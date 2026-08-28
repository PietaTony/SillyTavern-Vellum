import { Hono } from 'hono';
import { z } from 'zod';
import { getCompanionEnabled, setCompanionEnabled } from '../services/settings.ts';

/**
 * E1：桌寵開關（跨層票，Peter 2026-08-28 簽，鎖期間借住 `chat-core`）。
 *
 * 🔴 **不是自己被 `server/app.ts` 直接註冊。** 這張票明講 `app.ts` 不在鎖裡——
 * 註冊新路由要另開票——所以這支改用 `chatMessages.ts` 已經掛好的 `/api/chats`
 * 前綴，用 `.route('/settings', companionSettings)` 掛進去：對外路徑是
 * `/api/chats/settings/companion`，沒有動 `app.ts` 一行。
 * ⚠️ **語意上這不是「這段對話的設定」**——是全域設定，跟 `network.ts`／
 * `globalWorlds.ts` 同一類。掛在這個前綴下純粹是檔案大小與鎖範圍的權宜之計，
 * 鎖歸還之後如果 X3 要收回 `settingsModel.ts`／`services/settings.ts`，
 * 順手把這支路由挪去獨立前綴不需要動這支檔案本身的邏輯。
 *
 * 🔴 **真正的桌寵是卡片的背景腳本**（`CardBackground.tsx` 的 overlay frame），
 * 不是 `server/lib/companion.ts` 那支沒接路由的孤兒引擎。這支只負責存讀開關值，
 * 「關掉之後 frame 真的不建」的判斷在前端 `useCardScripts.ts`。
 */
export const companionSettings = new Hono()
  .get('/companion', async (c) => c.json({ enabled: await getCompanionEnabled() }))
  .patch('/companion', async (c) => {
    const body = z.object({ enabled: z.boolean() }).safeParse(await c.req.json());
    if (!body.success) return c.json({ error: '參數不合法' }, 400);
    await setCompanionEnabled(body.data.enabled);
    return c.json({ enabled: body.data.enabled });
  });
