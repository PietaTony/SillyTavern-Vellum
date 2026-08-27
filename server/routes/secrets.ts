import { Hono } from 'hono';
import { whichAreSet, redact, getKey, previews } from '../services/secrets.ts';
import { getActiveProvider, loadSettings, setActiveProvider } from '../services/settings.ts';
import { adapterFor } from '../providers/dispatch.ts';
import { byId, isSelectable, PROVIDERS } from '../providers/registry.ts';

export const secrets = new Hono()
  /**
   * 只回「哪些已設定」的**布林**（F3）。
   * 🔴 **形狀不可以改成物件**：`app/setup.ts` 的 `isSetUp()` 做的是
   * `Object.values(status).some(Boolean)` —— 換成物件的話**空物件也是 truthy**，
   * 於是「一把金鑰都沒有」會被判定成「設定完成」，first-run 守衛整個失效。
   */
  .get('/', async (c) => c.json(await whichAreSet()))

  /**
   * 🔴 **全專案唯一一個回傳金鑰衍生資料的端點**（前四後四，見 `lib/secrets.ts`）。
   * 亮線就是「只有這一支」—— `server/__tests__/secretsPreview.test.ts` 釘住它。
   */
  .get('/preview', async (c) => c.json(await previews()))

  /*
   * 🔴 **`POST /` 已刪除**（Peter 2026-08-26 裁定，GAP-46）。
   * 它是「不測就存金鑰」的端點：**呼叫端 0**（實測 grep 全 repo 只有 `GET /api/secrets`
   * 被 `fetchKeyStatus` 用到），而且**違反本專案到處宣稱的「測過才存」** ——
   * 留著等於留一條繞過測試閘門的路。刪掉同時縮小攻擊面。
   * ⇒ 現在寫入金鑰只有一條路：`POST /api/secrets/test`（測過才存）。
   */

  /**
   * 供應商清單（給前端畫選單）。**只回設定，永不回金鑰**。
   * 🔴 這是「零例外」的形狀：26 家全部列出來，用 `status` 誠實表達哪幾家還沒通。
   */
  .get('/providers', async (c) => {
    const set = await whichAreSet();
    const settings = await loadSettings();
    const chosen = settings.providerModels ?? {};
    const active = settings.activeProvider ?? 'google';
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
        // 🔴 選過的才回，沒選過回 null —— **不要偷偷回 defaultModel**，
        //    那會讓「還沒選」與「選了預設那個」在畫面上長得一樣。
        model: chosen[p.id] ?? null,
        /** 對話現在打的是這一家。**同時只有一個 `true`。** */
        active: p.id === active,
      })),
    );
  })

  /**
   * 切換「目前使用中的供應商」。
   *
   * 🔴 **兩種切法會直接弄壞對話，所以在這裡擋掉**，不是靠 UI 自律：
   * ① `planned` 的四家根本送不出去 ② 沒有金鑰的家一送就失敗。
   * 讓它切過去只是把錯誤延後到下一次對話 —— 而那時候使用者已經忘記他改過設定。
   * ⚠️ **擋下來要說得出「那怎麼辦」**，不是只回 400（本專案原則：每個死路都要有出口）。
   */
  .put('/active/:provider', async (c) => {
    const id = c.req.param('provider');
    const cfg = byId(id);
    if (!cfg) return c.json({ error: '不認得這一家供應商' }, 400);
    if (!isSelectable(cfg)) {
      return c.json({ error: `Vellum 尚未支援 ${cfg.displayName}，選了也送不出去。` }, 400);
    }
    if (!(await whichAreSet())[id]) {
      return c.json(
        { error: `${cfg.displayName} 還沒有金鑰 —— 先設定金鑰才能用它對話。`, action: 'setup-key' },
        400,
      );
    }
    await setActiveProvider(id);
    return c.json({ ok: true, active: await getActiveProvider() });
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
