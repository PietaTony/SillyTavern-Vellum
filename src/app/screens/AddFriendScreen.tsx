import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { AddFriendForm, createCharacter, type Draft } from '@/features/characters';
import { createChat } from '@/features/chat';
import { Screen } from '@/shared/ui/Screen';

/**
 * 加入好友的版面。🔴 **同一張畫面掛在兩個 route 上**：
 *   `/first-run/add-friend` —— 首次啟動流程裡的第三步
 *   `/add-friend`           —— 設定完成之後從列表進來
 * 內容完全相同，**差別只有從哪裡來** ⇒ 版面只有這一份。
 */
export function AddFriendScreen({ onBack }: { onBack: () => void }) {
  const nav = useNavigate();

  // 建立角色 → 直接開對話 → 進對話串（F22–F28：按下去直接開始對話）
  const m = useMutation({
    mutationFn: async ({ draft }: { draft: Draft; clearDraft: () => void }) => {
      const ch = await createCharacter(draft);
      return createChat(ch.id);
    },
    // 🔴 **建立成功之後才清草稿。** 失敗就留著 —— 打過的字不可以因為送出失敗而消失。
    onSuccess: (chat, { clearDraft }) => {
      clearDraft();
      void nav({ to: '/chat/$chatId', params: { chatId: chat.id } });
    },
  });

  return (
    <Screen title="加入好友" onBack={onBack}>
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
      <AddFriendForm
        busy={m.isPending}
        onCreate={(draft, clearDraft) => m.mutate({ draft, clearDraft })}
      />
    </Screen>
  );
}
