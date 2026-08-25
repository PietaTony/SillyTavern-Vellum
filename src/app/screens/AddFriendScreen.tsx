import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import {
  ADD_FRIEND_DRAFT,
  AddFriendForm,
  AddFriendSubmit,
  createCharacter,
  type Draft,
  emptyDraft,
  ImportCardBox,
  type ImportedCharacter,
  loadAddFriendDraft,
} from '@/features/characters';
import { createChat } from '@/features/chat';
import { clearDraftPrefix, writeDraft } from '@/shared/lib/draftStore';
import { Screen } from '@/shared/ui/Screen';

/**
 * 加入好友的版面。🔴 **同一張畫面掛在兩個 route 上**：
 *   `/first-run/add-friend` —— 首次啟動流程裡的第三步
 *   `/add-friend`           —— 設定完成之後從列表進來
 * 內容完全相同，**差別只有從哪裡來**。
 *
 * 🔴 草稿住在這一層：送出鈕在固定 footer、表單在捲動區，兩邊要看同一份值。
 * 草稿存進 localStorage —— iOS 把背景分頁重載之後，打過的字要還在。
 */
export function AddFriendScreen({ onBack }: { onBack: () => void }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  // 🔴 還原（含舊 key 的一次性搬遷）在 initializer **同步**做完，不在 effect 裡：
  // 三個 `DraftField` 若各自在 mount effect 裡還原，看到的是同一份 `draft`，
  // **第二個會蓋掉第一個**。同步初始化沒有這個競態。
  const [draft, setDraftState] = useState<Draft>(loadAddFriendDraft);

  /**
   * 三個文字欄由 `DraftField` 自己存；**頭像不是文字輸入**，閘門管不到它，
   * 所以在這裡明寫一次。存的是縮圖過的 data URL。
   */
  const setDraft = (d: Draft) => {
    setDraftState(d);
    if (d.avatar) writeDraft(`${ADD_FRIEND_DRAFT}avatar`, d.avatar);
  };
  const clearAllDrafts = () => clearDraftPrefix(ADD_FRIEND_DRAFT);
  /** 剛匯入的那一位。有值時這一頁的意義從「建立」變成「確認並開始」。 */
  const [imported, setImported] = useState<ImportedCharacter | null>(null);

  // 建立角色 → 直接開對話 → 進對話串（F22–F28：按下去直接開始對話）
  const m = useMutation({
    mutationFn: async (d: Draft) => {
      const ch = await createCharacter(d);
      return createChat(ch.id);
    },
    // 🔴 **建立成功之後才清草稿。** 失敗就留著 —— 打過的字不可以因為送出失敗而消失。
    onSuccess: (chat) => {
      clearAllDrafts();
      setDraftState(emptyDraft);
      void nav({ to: '/chat/$chatId', params: { chatId: chat.id } });
    },
  });

  return (
    <Screen
      title="加入好友"
      onBack={onBack}
      footer={
        <AddFriendSubmit
          draft={draft}
          busy={m.isPending}
          imported={imported !== null}
          greetings={imported?.greetings?.length ?? 0}
          onCreate={() => {
            // 匯入的角色**已經建立好了** —— 這顆鈕的意義是「開始聊天」，不是再建一個。
            if (imported) {
              clearAllDrafts();
              if ((imported.greetings?.length ?? 0) > 1)
                void nav({
                  to: '/pick-greeting/$characterId',
                  params: { characterId: imported.id },
                });
              else void nav({ to: '/friends' });
              return;
            }
            m.mutate(draft);
          }}
        />
      }
    >
      {m.isError ? (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Button size="small" onClick={() => m.reset()}>
              再試一次
            </Button>
          }
        >
          建立失敗：{m.error instanceof Error ? m.error.message : '未知錯誤'}
        </Alert>
      ) : null}
      {/* 🔴 匯入框放最上方（Peter 指定）：大多數人是「已經有卡」而不是「從零捏一個」。 */}
      {/*
       * 🔴 **匯入成功不跳走。** 跳走的話那句「已加入誰」永遠看不到，
       * 而且要連續匯入好幾張時每次都得再走回來。留在原頁，讓好友列表失效就好。
       */}
      <ImportCardBox
        onUseAsAvatar={(avatar) => setDraft({ ...draft, avatar })}
        /**
         * 🔴 **匯入成功不跳走，把資料填進下面既有的欄位**（Peter 2026-08-25）。
         * 那四個框本來就在，再做一張預覽卡等於同一份資料有兩個長相。
         */
        onImported={(c) => {
          void qc.invalidateQueries({ queryKey: ['characters'] });
          setImported(c);
          setDraft({
            name: c.displayName ?? c.name,
            description: c.description,
            firstMessage: c.firstMessage,
            avatar: c.avatar,
          });
        }}
      />
      <AddFriendForm draft={draft} setDraft={setDraft} imported={imported !== null} />
    </Screen>
  );
}
