import { useMutation } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { AddFriendForm, createCharacter, type Draft } from '@/features/characters';
import { createChat } from '@/features/chat';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Screen } from '@/shared/ui/Screen';

export const Route = createFileRoute('/first-run/add-friend')({ component: AddFriendPage });

/** `First-Run--4 / --6 / --7` —— 一份版面三個狀態。 */
function AddFriendPage() {
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
    <Screen
      title="加入好友"
      // 返回落點來自設計正本 back.json：First-Run--4/6/7 → First-Run--3c（金鑰頁）
      onBack={() => {
        void nav({ to: '/first-run/key' });
      }}
    >
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
