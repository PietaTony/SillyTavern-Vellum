/**
 * 「**真的打一次供應商**」的三支端點：測金鑰／測存著的金鑰／測模型。
 *
 * 🔴 **與 `secrets.ts` 分開**：那一支管的是「存了什麼、有沒有存」（純本機讀寫），
 * 這一支每一次呼叫都會**往外發一個請求**（可能計費）。
 * 兩種節奏混在一起會讓「這支會不會花錢」變成要逐行看才知道。
 *
 * 🔴 三支共通的兩條：
 *   ① **成功才存**（金鑰、模型都是）—— 存一個沒測過的只會讓人以為設定好了
 *   ② 供應商的錯誤原文可能夾帶金鑰片段 ⇒ **送出前一律 `redact`**
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { getKey, redact, setKey } from '../lib/secrets.ts';
import { modelLooksReal } from '../lib/modelCheck.ts';
import { classifyProviderError } from '../lib/providerError.ts';
import { setProviderModel } from '../lib/settings.ts';
import { adapterFor } from '../providers/dispatch.ts';
import { byId, isSelectable } from '../providers/registry.ts';

const WriteBody = z.object({
  provider: z.string().min(1),
  value: z.string().min(1),
});

export const providerTests = new Hono()
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
      return c.json({ ok: false, message: `Vellum 尚未支援 ${cfg.displayName}。` }, 400);

    // 🔴 依格式分派 —— **不再寫死 Gemini**（驗收 A4 的一半）。
    const r = await adapterFor(cfg.format).listModels(cfg, value);
    if (!r.ok) {
      // 供應商的錯誤原文可能夾帶金鑰片段（SPEC §2）
      const message = redact(r.message, [value]);
      return c.json({ ok: false, status: r.status, message, reason: classifyProviderError(message) });
    }
    await setKey(provider, value);
    return c.json({ ok: true, models: r.models });
  })

  /**
   * 測**已經存著的那把**金鑰（不必重貼）。
   *
   * 🔴 **這比「重貼一次再測」更安全**：現在的流程要測就得把金鑰再送一次網路，
   * 而這支完全不讓金鑰離開伺服器 —— 前端只送 provider id，伺服器自己去讀、自己去打。
   * ⇒ **少一次傳輸，不是多一個洞。**
   */
  .post('/test-stored/:provider', async (c) => {
    const cfg = byId(c.req.param('provider'));
    if (!cfg) return c.json({ ok: false, message: '不認得這一家供應商。' }, 400);
    if (!isSelectable(cfg))
      return c.json({ ok: false, message: `Vellum 尚未支援 ${cfg.displayName}。` }, 400);
    const key = await getKey(cfg.id);
    if (!key) return c.json({ ok: false, message: `還沒設定 ${cfg.displayName} 的金鑰。` }, 400);
    const r = await adapterFor(cfg.format).listModels(cfg, key);
    // 🔴 供應商的錯誤原文可能夾帶金鑰片段 ⇒ 送出前一律 redact（與 /test 同一條）
    return r.ok
      ? c.json({ ok: true, models: r.models })
      : c.json({
          ok: false,
          status: r.status,
          message: redact(r.message, [key]),
          reason: classifyProviderError(redact(r.message, [key])),
        });
  })

  /**
   * 🔴 **測試這個模型，成功才存**（Peter 2026-08-26，與金鑰同一套邏輯）。
   *
   * 🔴 **唯一的例外：額度不足照樣存**（Peter 2026-08-26：
   * 「儘管額度不足，使用者切換模型也是要存下來」）。
   * 理由是那個失敗**不是這個模型的問題** —— 模型是好的，壞的是帳戶餘額。
   * 把他的選擇丟掉等於懲罰他選了一個對的東西，而且他不會知道為什麼下拉跳回去了。
   * ⚠️ 「測過才存」原本要擋的是**清單裡列得出來、打下去卻 404 的模型**
   * （實測 `gemini-2.5-flash`）—— 那一類仍然不存。
   *
   * **真的打一次**，不是檢查它在不在清單裡 —— `07-gemini-facts` 記過
   * **models 端點會列出打不通的模型**（`gemini-2.5-flash` 實打 404「不對新使用者開放」）。
   * ⇒ 只檢查清單的話，正好存到一個用不了的，而使用者要到下一次對話才發現。
   *
   * 成本：一次極小的生成（`maxOutputTokens` 給最低）。使用者主動觸發，不是背景輪詢。
   */
  .post('/test-model/:provider', async (c) => {
    const cfg = byId(c.req.param('provider'));
    if (!cfg) return c.json({ ok: false, message: '不認得這一家供應商。' }, 400);
    if (!isSelectable(cfg))
      return c.json({ ok: false, message: `Vellum 尚未支援 ${cfg.displayName}。` }, 400);
    const body = z.object({ model: z.string().min(1) }).safeParse(await c.req.json());
    if (!body.success) return c.json({ ok: false, message: '參數不合法' }, 400);
    const key = await getKey(cfg.id);
    if (!key) return c.json({ ok: false, message: `還沒設定 ${cfg.displayName} 的金鑰。` }, 400);

    const ac = new AbortController();
    let upstream: Response;
    try {
      upstream = await adapterFor(cfg.format).open(
        cfg,
        key,
        {
          model: body.data.model,
          messages: [{ role: 'user', text: 'hi' }],
          maxOutputTokens: 256,
        },
        ac.signal,
      );
    } catch (e) {
      return c.json({ ok: false, message: e instanceof Error ? redact(e.message, [key]) : '連不上' });
    }
    if (!upstream.ok) {
      const raw = await upstream.text();
      // 🔴 供應商的錯誤原文可能夾帶金鑰片段 ⇒ 一律 redact，並截短（400 回應常常是整包 HTML）
      const message = redact(raw, [key]).slice(0, 300);
      const reason = classifyProviderError(message);
      /*
       * 額度不足 ⇒ 模型是好的、壞的是帳戶，存下來（見上面檔頭的理由）。
       *
       * 🔴 **但不可以就這樣照單全收。** 餘額 0 的時候供應商**對任何請求都回同一個錯**，
       * 包含根本不存在的模型 —— 實測 `claude-does-not-exist-9` 也回「credit balance is too low」。
       * 直接存的話「測過才存」整條失效，而手動輸入的那幾家會存到打錯的字串。
       * ⇒ 改用**官方清單**驗一次。Anthropic 餘額 0 時 `listModels` 仍然可用
       *   （我們就是靠它拿到那 10 個模型的）。
       * ⚠️ 清單也拉不到（或這家沒有清單端點）⇒ **無從判斷，就存**：
       *   此時擋下來只會讓使用者的選擇無聲消失，而那比存錯更難查。
       */
      const saved = reason === 'no-credit' && (await modelLooksReal(cfg, key, body.data.model));
      if (saved) await setProviderModel(cfg.id, body.data.model);
      return c.json({ ok: false, status: upstream.status, message, reason, saved });
    }
    // 🔴 **確認之後才存**，而且立刻中止串流 —— 我們只需要知道它開得起來。
    ac.abort();
    await setProviderModel(cfg.id, body.data.model);
    return c.json({ ok: true, model: body.data.model });
  });

