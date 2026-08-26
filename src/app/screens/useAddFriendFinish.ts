import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  createCharacter,
  type Draft,
  greetingsOf,
  type ImportedCharacter,
  updateCharacter,
} from '@/features/characters';
import { createChat } from '@/features/chat';

/**
 * 「加入好友」那顆送出鈕背後的兩條路。**抽出來的理由有兩個**：
 * ① `AddFriendScreen` 撞到 150 行上限（`gate:file-size`）
 * ② 🔴 **匯入那條路原本是射後不理** —— `void updateCharacter(...)` 之後立刻導航，
 *    PATCH 還在飛、失敗也沒有人會知道。使用者在上一頁編了半天的問候語，
 *    按下去看起來成功了，實際上沒存進去（總則五的形狀）。
 *    ⇒ 改成 mutation：**等它回來再導航**，錯誤交給畫面顯示。
 */
export function useAddFriendFinish(onDone: () => void) {
  const nav = useNavigate();

  /** 從零建立：建角色 → 開對話 → 進對話串（F22–F28：按下去直接開始對話）。 */
  const create = useMutation({
    mutationFn: async (d: Draft) => {
      // 🔴 後端的 `greetings` **含第一則**，這裡才組起來（見 `model.ts` 的 `greetingsOf`）。
      const ch = await createCharacter({ ...d, greetings: greetingsOf(d) });
      return createChat(ch.id);
    },
    onSuccess: (chat) => {
      onDone();
      void nav({ to: '/chat/$chatId', params: { chatId: chat.id } });
    },
  });

  /**
   * 匯入的角色**已經建立好了** —— 這顆鈕的意義是「確認並開始」，不是再建一個。
   * 但這一頁可以改額外問候語 ⇒ 要先寫回去。
   */
  const finishImported = useMutation({
    mutationFn: async (v: { imported: ImportedCharacter; draft: Draft }) => {
      const greetings = greetingsOf(v.draft);
      await updateCharacter(v.imported.id, { greetings });
      return { id: v.imported.id, count: greetings.length };
    },
    onSuccess: (r) => {
      onDone();
      // 🔴 只有一則就沒什麼好選的，直接回列表（多開一張「選開場」的空畫面是死路）。
      if (r.count > 1)
        void nav({ to: '/pick-greeting/$characterId', params: { characterId: r.id } });
      else void nav({ to: '/friends' });
    },
  });

  return { create, finishImported };
}
