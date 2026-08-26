import { effectiveModel } from './modelOptions';
import { fetchModels, type ProviderRow, setActiveProvider, testModel } from './registryApi';

export type SwitchResult = {
  /** 實際會拿去對話的那個模型（選過的 → 官方清單第一個 → registry 那份）。 */
  model: string;
  test: { ok: true; model: string } | { ok: false; message: string };
};

/**
 * 切換「對話用哪一家」——**切完立刻打一次，確認它真的能用**。
 *
 * 🔴 **只回「切換成功」是假綠燈**（Peter 2026-08-26）：
 * `PUT /active/:provider` 只證明「這一家有金鑰、不是 planned」，
 * **不證明它送得出去**。實際踩到的情況是 Anthropic 金鑰好好的、餘額是 0 ——
 * 畫面跳綠色的「對話改用 Anthropic Claude」，然後使用者下一次聊天才發現送不出去。
 *
 * 🔴 **要測就要測「真的會用的那個模型」**，不是 registry 的預設 ——
 * 那份會過期（實測 `claude-sonnet-4-5` 已下架），測它會失敗在錯的理由上。
 * ⇒ 先拉一次官方清單，用 `effectiveModel()` 算出實際生效的那個再測。
 *
 * ⚠️ **測失敗不會把切換回滾**：他確實切過去了，只是那一家現在用不了。
 * 回滾會讓「我明明按了」與畫面不一致，而且他可能正要去儲值。
 */
export async function switchActiveProvider(row: ProviderRow): Promise<SwitchResult> {
  await setActiveProvider(row.id);
  const list = await fetchModels(row.id);
  const model = effectiveModel(row.model, list.ok ? list.models : [], row.defaultModel);
  return { model, test: await testModel(row.id, model) };
}
