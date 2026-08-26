import { useMutation, useQueryClient } from '@tanstack/react-query';
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
  const qc = useQueryClient();

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
      /**
       * 🔴 **四個欄位都要送，不是只送 greetings**（敵意審查 2026-08-26 抓到）。
       * 匯入之後那四個框**仍然可以編輯**，但上一版只寫回 `greetings` ⇒
       *   ① 改過的名稱／描述／頭像**靜默丟掉**，而且 `onDone()` 會把草稿一起清掉
       *   ② 更陰的：`greetingsOf` 會把新的初始訊息放進 `greetings[0]`，
       *      但 `firstMessage` 欄位沒送 ⇒ **同一份 JSON 兩個欄位各講各話**
       *      （`chats.ts` 開場讀 greetings、清單 fallback 讀 firstMessage）。
       * 🔴 名字寫 `displayName`，**永不寫回卡片的 `name`**（D-h）。
       */
      await updateCharacter(v.imported.id, {
        displayName: v.draft.name,
        description: v.draft.description,
        firstMessage: v.draft.firstMessage,
        avatar: v.draft.avatar,
        greetings,
        // 🔴 樂觀鎖（GAP-71）。匯入當下那份還沒被改過，通常是 undefined ＝ 不檢查。
        ifUnmodifiedSince: v.imported.updatedAt,
      });
      return { id: v.imported.id, count: greetings.length };
    },
    onSuccess: (r) => {
      // 🔴 好友列表用快取的 `greetingCount` 決定要不要進「選開場」（staleTime 30s）
      //    ⇒ 不失效的話，30 秒內會照舊值走。
      void qc.invalidateQueries({ queryKey: ['characters'] });
      void qc.invalidateQueries({ queryKey: ['character', r.id] });
      onDone();
      // 🔴 只有一則就沒什麼好選的，直接回列表（多開一張「選開場」的空畫面是死路）。
      if (r.count > 1)
        void nav({ to: '/pick-greeting/$characterId', params: { characterId: r.id } });
      else void nav({ to: '/friends' });
    },
  });

  return { create, finishImported };
}
