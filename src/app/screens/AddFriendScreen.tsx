import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { AddFriendForm, createCharacter, type Draft } from '@/features/characters';
import { createChat } from '@/features/chat';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Screen } from '@/shared/ui/Screen';

/**
 * `First-Run--4 / --6 / --7` —— 一份版面三個狀態。
 *
 * 🔴 **同一張畫面掛在兩個 route 上**（Peter 2026-08-25）：
 *   `/first-run/add-friend` —— 首次啟動流程裡的第三步，返回落點是金鑰頁
 *   `/add-friend`           —— 設定完成之後從聊天列表進來，返回落點是聊天列表
 * 內容完全相同，**差別只有從哪裡來、退回哪裡去** ⇒ 版面只有這一份，`onBack` 由 route 傳進來。
 */
export function AddFriendScreen({ onBack }: { onBack: () => void }) {
  const nav = useNavigate();

  // 建立角色 → 直接開對話 → 進對話串（F22–F28：按下去直接開始對話）
  const m = useMutation({
    mutationFn: async (d: Draft) => {
      const ch = await createCharacter(d);
      return createChat(ch.id);
    },
    onSuccess: (chat) => {
      void nav({ to: '/chat/$chatId', params: { chatId: chat.id } });
    },
  });

  return (
    <Screen title="加入好友" onBack={onBack}>
      {m.isError ? (
        <ErrorState
          title="建立失敗"
          detail={m.error instanceof Error ? m.error.message : '未知錯誤'}
          action={{ label: '再試一次', onAct: () => m.reset() }}
        />
      ) : (
        <AddFriendForm busy={m.isPending} onCreate={(d) => m.mutate(d)} />
      )}
    </Screen>
  );
}
