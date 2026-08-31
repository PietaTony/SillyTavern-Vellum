import { Hono } from 'hono';
import { z } from 'zod';
import {
  getCompanionEnabled,
  setCompanionEnabled,
  getHistoryByteBudget,
  setHistoryByteBudget,
  getMaxResponseTokens,
  setMaxResponseTokens,
  loadSettings,
  saveSettings,
} from '../services/settings.ts';
import { MAX_HISTORY_BYTE_BUDGET, MIN_HISTORY_BYTE_BUDGET } from '../lib/historyTruncation.ts';
import { MAX_MAX_OUTPUT_TOKENS, MIN_MAX_OUTPUT_TOKENS } from '../lib/maxResponseTokens.ts';
import { regexFrom } from '../lib/outputRules.ts';
import { safeId } from '../lib/ids.ts';

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
 *
 * 🔴 D1（Peter 2026-08-31 跨層票）：使用者自建的輸出規則 CRUD 也掛在這裡，**不是另開一支檔案**。
 * 那張票的 Locks 清單只給了 `settingsModel.ts`／`services/settings.ts`／`renderChat.ts`／
 * `ChatMenu*` 與 `features/chat/**`，沒有 `server/app.ts`，也沒有授權新增 `server/routes/`
 * 的檔名（`routes/` 跟 `lib/`／`services/` 一樣是逐檔列名，不能自己判斷加檔）。這支已經掛在
 * `/api/settings`、已經是我名下的檔案 —— 加在同一條 Hono 鏈上，`app.ts` 完全不用動。
 *
 * 🔴 A2/GAP-37（跨層票 2026-08-31，Peter 已簽）：對話歷史上限（`/history-budget`）
 * 也掛在這裡，同一個理由——那張票的 `Locks` 只給了 `historyTruncation.ts`／
 * `buildTurn.ts`／`settingsModel.ts`／`services/settings.ts`／設定頁畫面檔，沒有
 * `server/app.ts`，這支已經是 `/api/settings` 前綴、已經是我名下的檔案。
 *
 * 🔴 B5（2026-08-31 做完；2026-08-31 收斂進 X3）：回應上限（`/max-response`）也掛
 * 在這裡，持久化走 `services/settings.ts`（`historyByteBudget` 同一支）——這個鍵
 * 原本為了避開跨層簽名另開了獨立的 `maxResponseSettings.json`，Peter 2026-08-31
 * 裁定收斂：兩個相鄰的「大小」設定不該分家。六題見 `settingsLimits.ts`。
 */
const RuleBody = z.object({
  name: z.string().min(1).max(120),
  find: z.string().min(1),
  replace: z.string(),
  target: z.enum(['display', 'prompt', 'both']),
  minDepth: z.number().int().nullable(),
  maxDepth: z.number().int().nullable(),
  trim: z.array(z.string()),
  enabled: z.boolean(),
});

/**
 * `find` 是不是一個 JS 讀得懂的正則。🔴 **壞掉的正則不能默默存進去**——
 * `outputRules.ts` 的 `regexFrom()` 對看不懂的 pattern 回 `null`，`applyRule` 接到
 * `null` 就直接原文吐回去（靜默不套用）。存的時候不擋，使用者會以為規則生效了，
 * 其實它從第一天就沒動過任何一個字（總則五：不能靜默失效）。
 */
const findIsValid = (find: string): boolean => regexFrom(find) !== null;

export const companionSettings = new Hono()
  .get('/companion', async (c) => c.json({ enabled: await getCompanionEnabled() }))
  .patch('/companion', async (c) => {
    const body = z.object({ enabled: z.boolean() }).safeParse(await c.req.json());
    if (!body.success) return c.json({ error: '參數不合法' }, 400);
    await setCompanionEnabled(body.data.enabled);
    return c.json({ enabled: body.data.enabled });
  })

  .get('/history-budget', async (c) => c.json(await getHistoryByteBudget()))
  .patch('/history-budget', async (c) => {
    const body = z
      .object({ bytes: z.number().int().min(MIN_HISTORY_BYTE_BUDGET).max(MAX_HISTORY_BYTE_BUDGET) })
      .safeParse(await c.req.json());
    if (!body.success) {
      return c.json(
        { error: `位元組數要是 ${MIN_HISTORY_BYTE_BUDGET}～${MAX_HISTORY_BYTE_BUDGET} 之間的整數` },
        400,
      );
    }
    await setHistoryByteBudget(body.data.bytes);
    return c.json(await getHistoryByteBudget());
  })

  .get('/max-response', async (c) => c.json(await getMaxResponseTokens()))
  .patch('/max-response', async (c) => {
    const body = z
      .object({ tokens: z.number().int().min(MIN_MAX_OUTPUT_TOKENS).max(MAX_MAX_OUTPUT_TOKENS) })
      .safeParse(await c.req.json());
    if (!body.success) {
      return c.json(
        { error: `token 數要是 ${MIN_MAX_OUTPUT_TOKENS}～${MAX_MAX_OUTPUT_TOKENS} 之間的整數` },
        400,
      );
    }
    await setMaxResponseTokens(body.data.tokens);
    return c.json(await getMaxResponseTokens());
  })

  .get('/output-rules', async (c) => c.json({ items: (await loadSettings()).globalOutputRules ?? [] }))

  .post('/output-rules', async (c) => {
    const body = RuleBody.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: '參數不合法' }, 400);
    if (!findIsValid(body.data.find)) {
      return c.json({ error: `正則寫壞了：「${body.data.find}」建不出合法的 RegExp` }, 400);
    }
    const rule = { id: crypto.randomUUID(), ...body.data };
    const s = await loadSettings();
    const next = [...(s.globalOutputRules ?? []), rule];
    await saveSettings({ ...s, globalOutputRules: next });
    return c.json(rule, 201);
  })

  .patch('/output-rules/:id', async (c) => {
    const id = safeId(c.req.param('id'));
    const body = RuleBody.safeParse(await c.req.json());
    if (!id) return c.json({ error: '找不到這條規則' }, 404);
    if (!body.success) return c.json({ error: '參數不合法' }, 400);
    if (!findIsValid(body.data.find)) {
      return c.json({ error: `正則寫壞了：「${body.data.find}」建不出合法的 RegExp` }, 400);
    }
    const s = await loadSettings();
    const list = (s.globalOutputRules ?? []) as ({ id: string } & Record<string, unknown>)[];
    if (!list.some((r) => r.id === id)) return c.json({ error: '找不到這條規則' }, 404);
    const rule = { id, ...body.data };
    const next = list.map((r) => (r.id === id ? rule : r));
    await saveSettings({ ...s, globalOutputRules: next });
    return c.json(rule);
  })

  .delete('/output-rules/:id', async (c) => {
    const id = safeId(c.req.param('id'));
    const s = await loadSettings();
    const list = (s.globalOutputRules ?? []) as ({ id: string } & Record<string, unknown>)[];
    const next = list.filter((r) => r.id !== id);
    if (!id || next.length === list.length) return c.json({ error: '找不到這條規則' }, 404);
    await saveSettings({ ...s, globalOutputRules: next });
    return c.json({ ok: true });
  });
