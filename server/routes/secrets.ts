import { Hono } from 'hono';
import { z } from 'zod';
import { setKey, whichAreSet, redact, getKey } from '../lib/secrets.ts';
import { testKey } from '../lib/gemini.ts';

const WriteBody = z.object({
  provider: z.enum(['google', 'anthropic']),
  value: z.string().min(1),
});

export const secrets = new Hono()
  /** 只回「哪些已設定」，不回值（F3）*/
  .get('/', async (c) => c.json(await whichAreSet()))

  .post('/', async (c) => {
    const parsed = WriteBody.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: '參數不合法' }, 400);
    await setKey(parsed.data.provider, parsed.data.value);
    return c.json({ ok: true });
  })

  /**
   * 測試連線 —— 🔴 真的打一次供應商，不是檢查字串格式。
   * 這是首次啟動「測試閘門」的實作：沒通過就不解鎖下一步。
   */
  .post('/test', async (c) => {
    const parsed = WriteBody.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: '參數不合法' }, 400);
    const { provider, value } = parsed.data;
    if (provider !== 'google') return c.json({ ok: false, message: 'M2 目前只做 Gemini' }, 400);

    const r = await testKey(value);
    if (!r.ok) {
      // 供應商的錯誤原文可能夾帶金鑰片段（SPEC §2）
      return c.json({ ok: false, status: r.status, message: redact(r.message, [value]) });
    }
    await setKey(provider, value);
    return c.json({ ok: true, models: r.models });
  })

  /** 給前端顯示可用模型清單用；金鑰從伺服器端取，不經過前端 */
  .get('/models', async (c) => {
    const key = await getKey('google');
    if (!key) return c.json({ ok: false, message: '尚未設定 Gemini 金鑰' }, 400);
    const r = await testKey(key);
    return r.ok ? c.json({ ok: true, models: r.models }) : c.json({ ok: false, message: redact(r.message, [key]) }, 502);
  });
