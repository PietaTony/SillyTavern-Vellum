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
    // 🔴 **第二道防線，不是唯一一道。** 前端的 `PROVIDERS[].status` 已經讓還沒接上的
    // 那幾家不可選，但前端不可信 —— 直接打這支 API 一樣要擋下來。
    // ⚠️ 訊息是**給使用者看的**，不是給我們自己看的：原本寫「M2 目前只做 Gemini」，
    //    「M2」是我們的里程碑代號，使用者讀不懂，只會覺得是自己做錯了什麼。
    if (provider !== 'google')
      return c.json(
        { ok: false, message: 'Vellum 目前只接得上 Google Gemini，這一家還在接。' },
        400,
      );

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
