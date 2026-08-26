import { adapterFor } from '../providers/dispatch.ts';
import type { ProviderConfig } from '../providers/types.ts';

/**
 * 這個模型名字在官方清單裡嗎。**只在「額度不足」那條路上用。**
 *
 * 🔴 存在的理由：餘額 0 的時候供應商**對任何請求都回同一個錯**，
 * 包含根本不存在的模型 —— 實測 `claude-does-not-exist-9` 也回
 * 「Your credit balance is too low」。那讓「測過才存」整條失效，
 * 而手動輸入的那幾家會存到打錯的字串。
 * ⇒ 改用清單驗一次（Anthropic 餘額 0 時 `listModels` 仍然可用）。
 *
 * 🔴 **拉不到清單、或這家沒有清單端點 ⇒ 回 `true`。**
 * 無從判斷時擋下來只會讓使用者的選擇無聲消失，而那比存錯更難查。
 */
export async function modelLooksReal(
  cfg: ProviderConfig,
  key: string,
  model: string,
): Promise<boolean> {
  if (!cfg.modelsUrl) return true;
  const list = await adapterFor(cfg.format).listModels(cfg, key);
  return list.ok ? list.models.includes(model) : true;
}
