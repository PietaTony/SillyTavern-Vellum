import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  AddFriendForm,
  AddFriendSubmit,
  createCharacter,
  type Draft,
  emptyDraft,
  ImportCardBox,
} from '@/features/characters';
import { createChat } from '@/features/chat';
import { useDraft } from '@/shared/lib/useDraft';
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
  const [draft, setDraft, clearDraft] = useDraft<Draft>('vellum.draft.add-friend', emptyDraft);

  // 建立角色 → 直接開對話 → 進對話串（F22–F28：按下去直接開始對話）
  const m = useMutation({
    mutationFn: async (d: Draft) => {
      const ch = await createCharacter(d);
      return createChat(ch.id);
    },
    // 🔴 **建立成功之後才清草稿。** 失敗就留著 —— 打過的字不可以因為送出失敗而消失。
    onSuccess: (chat) => {
      clearDraft();
      void nav({ to: '/chat/$chatId', params: { chatId: chat.id } });
    },
  });

  return (
    <Screen
      title="加入好友"
      onBack={onBack}
      footer={<AddFriendSubmit draft={draft} busy={m.isPending} onCreate={() => m.mutate(draft)} />}
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
      <ImportCardBox onImported={() => void qc.invalidateQueries({ queryKey: ['characters'] })} />
      <AddFriendForm draft={draft} setDraft={setDraft} />
    </Screen>
  );
}
