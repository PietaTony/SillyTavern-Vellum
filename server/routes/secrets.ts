import { Hono } from 'hono';
import { z } from 'zod';
import { setKey, whichAreSet, redact, getKey } from '../lib/secrets.ts';
import { adapterFor } from '../providers/dispatch.ts';
import { byId, isSelectable, PROVIDERS } from '../providers/registry.ts';

// 🔴 **不再列舉供應商 id**：合法性由 registry 認定（家數要從 2 變 26）。
const WriteBody = z.object({
  provider: z.string().min(1),
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
    // 🔴 **第二道防線，不是唯一一道。** 前端已經讓 `planned` 的不可選，但前端不可信 ——
    // 直接打這支 API 一樣要擋下來。
    // ⚠️ 訊息是**給使用者看的**：原本寫「M2 目前只做 Gemini」，
    //    「M2」是我們的里程碑代號，使用者讀不懂，只會覺得是自己做錯了什麼。
    const cfg = byId(provider);
    if (!cfg) return c.json({ ok: false, message: '不認得這一家供應商。' }, 400);
    if (!isSelectable(cfg))
      return c.json({ ok: false, message: `Vellum 還沒接上 ${cfg.displayName}。` }, 400);

    // 🔴 依格式分派 —— **不再寫死 Gemini**（驗收 A4 的一半）。
    const r = await adapterFor(cfg.format).listModels(cfg, value);
    if (!r.ok) {
      // 供應商的錯誤原文可能夾帶金鑰片段（SPEC §2）
      return c.json({ ok: false, status: r.status, message: redact(r.message, [value]) });
    }
    await setKey(provider, value);
    return c.json({ ok: true, models: r.models });
  })

  /**
   * 供應商清單（給前端畫選單）。**只回設定，永不回金鑰**。
   * 🔴 這是「零例外」的形狀：26 家全部列出來，用 `status` 誠實表達哪幾家還沒通。
   */
  .get('/providers', async (c) => {
    const set = await whichAreSet();
    return c.json(
      PROVIDERS.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        format: p.format,
        status: p.status,
        keyHint: p.keyHint,
        consoleUrl: p.consoleUrl,
        defaultModel: p.defaultModel,
        hasModelList: Boolean(p.modelsUrl),
        keySet: Boolean(set[p.id]),
      })),
    );
  })

  /**
   * 某一家的可用模型清單（選模型 UI 用）。
   * 🔴 **金鑰從伺服器端取，不經過前端**（F3）。
   * 🔴 這支解掉「引擎有了沒有門」：`listModels` 早就把清單拉回來了，
   *    但在此之前只有 `KeyGate` 顯示一個「N 個模型可用」的**數字**。
   */
  .get('/models/:provider', async (c) => {
    const cfg = byId(c.req.param('provider'));
    if (!cfg) return c.json({ ok: false, message: '不認得這一家供應商。' }, 400);
    const key = await getKey(cfg.id);
    if (!key) return c.json({ ok: false, message: `還沒設定 ${cfg.displayName} 的金鑰。` }, 400);
    if (!cfg.modelsUrl)
      // 🔴 死路要有出口：這一家沒有清單端點時要說得出「那怎麼辦」。
      return c.json({ ok: false, message: `${cfg.displayName} 沒有提供模型清單，請手動輸入模型名稱。`, manual: true }, 200);
    const r = await adapterFor(cfg.format).listModels(cfg, key);
    return r.ok
      ? c.json({ ok: true, models: r.models, defaultModel: cfg.defaultModel })
      : c.json({ ok: false, message: redact(r.message, [key]) }, 502);
  });
