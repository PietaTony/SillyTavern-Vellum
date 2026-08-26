import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ToastMsg } from '@/shared/ui/toastMsg';
import { failureToast } from './failureToast';
import { testModel } from './registryApi';

/**
 * 「選了模型 → 立刻測 → 通過才存 → 跳 tips」。**設定頁與清單頁共用這一份。**
 *
 * 🔴 **共用不是為了少寫幾行**：這條規則有一個真實理由 ——
 * **models 端點會列出打不通的模型**（實測 `gemini-2.5-flash` 在清單裡，
 * 打下去回 404「no longer available to new users」）。
 * 兩個入口各寫一份，遲早有一邊變成「選了就存」，而那一邊會存到用不了的模型。
 */
export function useModelTest(provider: string, onNotify: (m: ToastMsg) => void, consoleUrl = '') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (model: string) => testModel(provider, model.trim()),
    onSuccess: (r) => {
      if (r.ok) {
        onNotify({ severity: 'success', text: `測試成功，已存：${r.model}` });
      } else {
        onNotify(failureToast(r.message, provider, consoleUrl));
      }
      if (r.ok) void qc.invalidateQueries({ queryKey: ['providerRows'] });
    },
    onError: () => onNotify({ severity: 'warning', text: '連不上，沒有存' }),
  });
}
