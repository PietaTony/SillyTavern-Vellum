import { useMutation, useQueryClient } from '@tanstack/react-query';
import { pushToast } from '@/shared/ui/toastStore';
import { deleteBackground, setChatBackground, setGlobalBackground, uploadBackground } from './api';
import type { Fitting } from './model';

/**
 * 背景的五個動作打成一包。**抽出來的理由是 `BackgroundsLayer` 會撞 150 行上限**，
 * 而這五個彼此高度相關（都要 invalidate 同兩把 key），拆散反而更難讀。
 *
 * 🔴 **每一個成功都要 invalidate `['backgrounds']` 與 `['chat', chatId]` 兩把。**
 * 只 invalidate 前者的話：在對話分頁選了一張，清單的勾勾會動，
 * 但**對話頁背後那張圖不會換** —— 因為它讀的是 `chat` 那份快取。
 */
export function useBackgroundActions(chatId?: string | undefined) {
  const qc = useQueryClient();
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['backgrounds'] });
    if (chatId) await qc.invalidateQueries({ queryKey: ['chat', chatId] });
  };
  const warn = (e: Error) => pushToast({ severity: 'warning', text: e.message });

  /**
   * 🔴 **一定要有 tips。** Peter 2026-08-26 回報「/settings 的背景按下去沒有更改」——
   * 查出來是他點到 `_white.jpg`：**設定成功了**，但純白疊在米色底再加 0.72 玻璃層，
   * 看起來就是什麼都沒發生。ST 內建 23 張裡有三張是這種純色佔位圖
   * （`__transparent.png`／`_white.jpg`／`_black.jpg`）。
   * ⇒ 「畫面本身就是回饋」在這裡不成立，要明講換成了哪一張。
   */
  const said = (name: string | null, where: string) =>
    pushToast({
      severity: 'success',
      text: name ? `${where}背景改成 ${name}` : `已取消${where}背景`,
    });

  const pickGlobal = useMutation({
    mutationFn: (name: string | null) => setGlobalBackground({ name }),
    onSuccess: async (_r, name) => {
      said(name, '全站');
      await refresh();
    },
    onError: warn,
  });

  const fitting = useMutation({
    mutationFn: (f: Fitting) => setGlobalBackground({ fitting: f }),
    onSuccess: refresh,
    onError: warn,
  });

  const pickChat = useMutation({
    mutationFn: (name: string | null) => setChatBackground(chatId ?? '', name),
    onSuccess: async (_r, name) => {
      // `null` 在對話層的意思是「回去跟隨全站」，不是「沒有背景」—— 文案要分得出來。
      if (name) said(name, '這一間的');
      else pushToast({ severity: 'success', text: '這一間改回跟隨全站背景' });
      await refresh();
    },
    onError: warn,
  });

  const upload = useMutation({
    mutationFn: (file: File) => uploadBackground(file),
    onSuccess: async (r) => {
      pushToast({ severity: 'success', text: `已加入 ${r.name}` });
      await refresh();
    },
    onError: warn,
  });

  /**
   * 🔴 **刪掉的如果正在用，後端會一併把設定清乾淨**（`routes/backgrounds.ts` 的 DELETE）。
   * 前端不必自己補那一步 —— 補了就變成兩份規則，而它們遲早會不一致。
   */
  const remove = useMutation({
    mutationFn: (name: string) => deleteBackground(name),
    onSuccess: async (_r, name) => {
      pushToast({ severity: 'success', text: `已刪除 ${name}` });
      await refresh();
    },
    onError: warn,
  });

  return { pickGlobal, pickChat, fitting, upload, remove };
}
