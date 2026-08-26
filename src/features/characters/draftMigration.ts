import { clearDraft, readDraft, writeDraft } from '@/shared/lib/draftStore';
import { type Draft, emptyDraft } from './model';
import { ADD_FRIEND_DRAFT } from './ui/AddFriendForm';

/**
 * 加好友草稿的**一次性搬遷**：上一版存成一筆物件，這一版每欄一筆。
 *
 * 🔴 為什麼非搬不可：不搬的話，**升級當下那份填到一半的表單就變成孤兒**。
 * 使用者看到的是「我打的東西不見了」，而他不會知道那是換 key 造成的。
 * （實際發生過：Peter 的 install 裡就有一份「何思年(4)」填到一半的表單。）
 *
 * 🔴 **搬過來就要當場寫進新 key。** 第一版只是「拿來當初始值」然後把舊 key 刪掉——
 * 值只活在 React state 裡，**使用者一重新載入就真的沒了**。
 * ⚠️ 那個洞單元測試抓不到（測的是 store 本身），是**開瀏覽器看**才發現的。
 *
 * ⚠️ 這支是暫時的。等到不再有人從舊版升上來，整個檔案可以刪掉。
 */
const LEGACY_KEY = 'vellum.draft.add-friend';

export function loadAddFriendDraft(): Draft {
  const legacy = readDraft<Partial<Draft>>(LEGACY_KEY);
  const pick = (k: 'name' | 'description' | 'firstMessage' | 'avatar'): string => {
    const now = readDraft<string>(`${ADD_FRIEND_DRAFT}${k}`);
    if (now !== null) return now;
    const old = legacy?.[k];
    if (old) writeDraft(`${ADD_FRIEND_DRAFT}${k}`, old);
    return old ?? emptyDraft[k];
  };
  const migrated: Draft = {
    ...emptyDraft,
    name: pick('name'),
    description: pick('description'),
    firstMessage: pick('firstMessage'),
    avatar: pick('avatar'),
    // 🔴 額外問候語是陣列，不走 `pick`（那支只處理字串）。舊版沒有這個 key ⇒ 回退成 []。
    greetings: readDraft<string[]>(`${ADD_FRIEND_DRAFT}greetings`) ?? [],
  };
  // 🔴 **搬完才刪** —— 上面任何一步丟例外都不會讓舊資料消失。
  if (legacy) clearDraft(LEGACY_KEY);
  return dropGhost(migrated);
}

/**
 * 丟掉「半張卡」的幽靈草稿（GAP-68）。
 *
 * 🔴 **失敗劇本**：匯入一張卡 → 重新整理。
 * `imported` 這個 React state 沒了，但 `avatar` 與 `greetings` **有持久化**
 * （`AddFriendScreen` 明寫那兩把 key），而 name／description／firstMessage
 * 是 `DraftField` 存**使用者自己打的字** —— 匯入時是程式填的，沒有存。
 * ⇒ 還原出來是**空白表單 ＋ 上一張卡的頭像與額外問候語**。
 * 此時填個名字按「建立角色」，**別張卡的問候語就掛到新角色身上了**。
 *
 * ⇒ 判準：**沒有名字卻有頭像或額外問候語 ＝ 這份草稿是半張卡的殘骸**，整組丟掉。
 * ⚠️ 反過來（有名字、沒頭像）是正常的手打草稿，不可以動。
 */
function dropGhost(d: Draft): Draft {
  const orphan = d.name.trim() === '' && (d.avatar !== '' || d.greetings.length > 0);
  if (!orphan) return d;
  clearDraft(`${ADD_FRIEND_DRAFT}avatar`);
  clearDraft(`${ADD_FRIEND_DRAFT}greetings`);
  return { ...d, avatar: '', greetings: [] };
}
