import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { ChatFailure } from '@/app/screens/ChatFailure';
import { ChatMenu } from '@/app/screens/ChatMenu';
import { ChatLoading, ChatUnavailable } from '@/app/screens/ChatUnavailable';
import { useBack } from '@/app/screens/useBack';
import { useChatBackgroundOverride } from '@/app/screens/useChatBackgroundOverride';
import { CharacterLayer, fetchCharacter } from '@/features/characters';
import {
  Composer,
  fetchChat,
  SwipePicker,
  swipeMessage,
  Thread,
  useChatStream,
} from '@/features/chat';
import { Screen } from '@/shared/ui/Screen';

export const Route = createFileRoute('/chat/$chatId')({ component: ChatPage });

function ChatPage() {
  const { chatId } = Route.useParams();
  const onBack = useBack();
  const q = useQuery({ queryKey: ['chat', chatId], queryFn: () => fetchChat(chatId) });
  // 頭像從角色現取，不複製進對話（避免每段對話多帶一份 base64，也避免換圖後過期）
  const char = useQuery({
    queryKey: ['character', q.data?.characterId],
    queryFn: () => fetchCharacter(q.data?.characterId ?? ''),
    enabled: Boolean(q.data?.characterId),
  });

  // 🔴 這一間自己的背景蓋過全站那張。**必須在所有早退之前**呼叫（理由見該檔檔頭）。
  useChatBackgroundOverride(q.data?.background, q.data?.backgroundFitting);

  // 點對方頭像開的角色設定層。🔴 對話中唯讀（Peter 2026-08-26）。
  const [showChar, setShowChar] = useState(false);
  // ☰ →「換開場」開的候選目錄（M12 第三批）。同一個元件，第三個入口。
  const [showGreetings, setShowGreetings] = useState(false);
  const { messages, streaming, failure, setFailure, send, reset } = useChatStream(
    chatId,
    q.data?.messages,
  );

  /**
   * 切候選。🔴 **`reset()` 不可以省**（敵意審查 2026-08-26 B1）：畫面讀的是
   * 「樂觀暫存 ?? 伺服器那份」，送過一則訊息之後暫存就不是 null，
   * `refetch()` 的新資料會被 `??` 短路 ⇒ **箭頭／鍵盤／目錄三個入口同時「按了沒反應」**。
   * ⚠️ 先 `await refetch()` 再 `reset()`；反過來會閃一下舊資料。
   */
  const swipe = useMutation({
    mutationFn: ({ messageId, index }: { messageId: string; index: number }) =>
      swipeMessage(chatId, messageId, index),
    onSuccess: async () => {
      await q.refetch();
      reset();
    },
  });

  if (q.isPending) return <ChatLoading />;
  if (q.isError)
    return (
      <ChatUnavailable why={q.error instanceof Error ? q.error.message : ''} onBack={onBack} />
    );

  /**
   * 🔴 **只有第一則、而且真的有多個候選，☰ 才長出「換開場」**。
   * 沒有候選卻列出來，就是一顆點了沒東西的選單項（本專案的「說謊的控制項」）。
   */
  const first = messages[0];
  const greeting = first && (first.swipes?.length ?? 0) > 1 ? first : null;

  return (
    <Screen
      title={q.data.characterName}
      onBack={onBack}
      action={
        <ChatMenu
          chatId={chatId}
          persona={q.data.persona}
          onPersonaChanged={() => void q.refetch()}
          {...(greeting ? { onGreetings: () => setShowGreetings(true) } : {})}
        />
      }
      scroll={false}
      footer={<Composer chatId={chatId} busy={streaming !== null} onSend={send} />}
    >
      <Thread
        messages={messages}
        streaming={streaming}
        avatar={char.data?.avatar || undefined}
        name={q.data.characterName}
        characterId={q.data.characterId}
        onSwipe={(messageId, index) => void swipe.mutate({ messageId, index })}
        onAvatarClick={() => setShowChar(true)}
      />
      {greeting && showGreetings ? (
        <SwipePicker
          open
          onClose={() => setShowGreetings(false)}
          message={greeting}
          characterId={q.data.characterId}
          isGreeting
          onPick={(i) => {
            swipe.mutate({ messageId: greeting.id, index: i });
            setShowGreetings(false);
          }}
        />
      ) : null}
      <CharacterLayer
        open={showChar}
        onClose={() => setShowChar(false)}
        characterId={q.data.characterId}
        readOnly
      />
      {failure ? <ChatFailure message={failure} onDismiss={() => setFailure(null)} /> : null}
    </Screen>
  );
}
