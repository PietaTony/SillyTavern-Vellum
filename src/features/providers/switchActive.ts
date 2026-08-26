import { effectiveModel } from './modelOptions';
import { fetchModels, type ProviderRow, type TestFail, testModel } from './registryApi';

export type VerifyResult = {
  /** 實際會拿去對話的那個模型（選過的 → 官方清單第一個 → registry 那份）。 */
  model: string;
  test: { ok: true; model: string } | TestFail;
};

/**
 * 切換之後，確認這一家**真的送得出去**。
 *
 * 🔴 **只回「切換成功」是假綠燈**（Peter 2026-08-26）：
 * `PUT /active/:provider` 只證明「有金鑰、不是 planned」，不證明它送得出去。
 * 實際踩到的是 Anthropic 金鑰好好的、餘額 0。
 *
 * 🔴 **這一段跟切換分開跑，不可以綁在一起**（Peter 2026-08-26：「radio 切換的時候會慢」）。
 * 實測：`PUT /active` **2.5ms**，但 `GET /models` 383ms ＋ `POST /test-model` 871ms（Google 真的生成一次）
 * ⇒ 綁在一起的話 radio 要等 ~1.3 秒才翻，看起來就是按了沒反應。
 * 切換立刻生效，驗證在背景跑，radio 顯示 loading。
 *
 * 🔴 **要測就要測「真的會用的那個模型」**，不是 registry 的預設 ——
 * 那份會過期（實測 `claude-sonnet-4-5` 已下架），測它會失敗在錯的理由上。
 */
export async function verifyProvider(row: ProviderRow): Promise<VerifyResult> {
  const list = await fetchModels(row.id);
  const model = effectiveModel(row.model, list.ok ? list.models : [], row.defaultModel);
  return { model, test: await testModel(row.id, model) };
}
