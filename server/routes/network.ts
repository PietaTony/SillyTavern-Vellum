import { Hono } from 'hono';
import { z } from 'zod';
import { reachableUrls } from '../adapters/network.ts';
import { loadSettings, saveSettings } from '../services/settings.ts';

/**
 * 「允許其他裝置連線」的開關（Peter 2026-08-27）。
 *
 * 🔴 **`GET` 要同時回「設定值」與「這次啟動實際綁了什麼」** ——
 * 這兩件事**會不一樣**（改完還沒重啟、或有人用 `HOST` 環境變數蓋過去）。
 * 只回設定值的話，畫面會說「已開啟」而實際上外面連不進來 —— 那是說謊的開關。
 */
export const network = new Hono()
  .get('/', async (c) => {
    const port = Number(process.env['PORT'] ?? 8520);
    const bound = process.env['VELLUM_BOUND_HOST'] ?? '127.0.0.1';
    return c.json({
      /** 設定裡是開還是關。 */
      enabled: (await loadSettings()).exposeNetwork === true,
      /** 🔴 **這次啟動實際綁的介面** —— 與上面那個不一致就代表「要重啟才生效」。 */
      bound,
      /** 🔴 `HOST` 環境變數蓋過設定時，UI 要說得出「開關現在管不到」。 */
      forcedByEnv: (process.env['HOST'] ?? '') !== '',
      port,
      /** 其他裝置實際打得到的網址（只有真的綁對外時才有意義）。 */
      urls: bound === '127.0.0.1' ? [] : reachableUrls(port),
    });
  })

  .patch('/', async (c) => {
    const body = z.object({ enabled: z.boolean() }).safeParse(await c.req.json());
    if (!body.success) return c.json({ error: '參數不合法' }, 400);
    const s = await loadSettings();
    await saveSettings({ ...s, exposeNetwork: body.data.enabled });
    // 🔴 **不假裝立刻生效。** port 已經綁上去了，中途換介面做不到。
    return c.json({ enabled: body.data.enabled, needsRestart: true });
  });
