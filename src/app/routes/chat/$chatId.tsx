import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { CardBackground } from '@/app/screens/CardBackground';
import { CardFrontend } from '@/app/screens/CardFrontend';
import { ChatFailure } from '@/app/screens/ChatFailure';
import { ChatMenu } from '@/app/screens/ChatMenu';
import { ChatLoading, ChatUnavailable } from '@/app/screens/ChatUnavailable';
import { chatMessageActions } from '@/app/screens/messageActions';
import { useBack } from '@/app/screens/useBack';
import { useChatBackgroundOverride } from '@/app/screens/useChatBackgroundOverride';
import { useChatCards } from '@/app/screens/useChatCards';
import { ConsentDialog, useCardEvents } from '@/features/cardscripts';
import { CharacterLayer, fetchCharacter } from '@/features/characters';
import {
  Composer,
  dropUnknownSwipeIndex,
  fetchChat,
  SwipePicker,
  Thread,
  UsageReadout,
  useChatStream,
  useSwipeMessage,
} from '@/features/chat';
import { Screen } from '@/shared/ui/Screen';

export const Route = createFileRoute('/chat/$chatId')({ component: ChatPage });

function ChatPage() {
  const { chatId } = Route.useParams();
  const onBack = useBack();
  const q = useQuery({ queryKey: ['chat', chatId], queryFn: () => fetchChat(chatId) });
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
  // 🔴 生成完要重讀（理由見 `useChatStream` 的 `onDone`）。
  const { messages, streaming, generation, failure, setFailure, send, regenerate, reset, stop } =
    useChatStream(chatId, q.data?.messages, () => q.refetch());
  const swipe = useSwipeMessage(chatId, () => q.refetch(), reset);

  // 🔴 型別邊界不是動 H6：dropUnknownSwipeIndex 理由見 `features/chat/swipeDisplay.ts`。
  useCardEvents(chatId, dropUnknownSwipeIndex(messages)); // 發事件給卡片腳本

  const actions = chatMessageActions(chatId, () => q.refetch(), reset, regenerate);

  // 🔴 卡片程式與變數（M13）。**必須在所有早退之前呼叫**（hooks 規則）。`edit` 直接接
  //    長按選單那一支 —— **改訊息只留一條路**，不然卡片改的與人改的遲早分岔。
  const cards = useChatCards({
    chatId,
    chat: q.data,
    messages: () => messages,
    swipe: (messageId, index) => swipe.mutateAsync({ messageId, index }),
    edit: actions.onEdit,
  });

  if (q.isPending) return <ChatLoading />;
  if (q.isError)
    return (
      <ChatUnavailable why={q.error instanceof Error ? q.error.message : ''} onBack={onBack} />
    );

  // 🔴 只有第一則、而且真的有多個候選，☰ 才長出「換開場」——
  // 沒有候選卻列出來，就是一顆點了沒東西的選單項。
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
          {...(cards.enabled ? { onRevokeScripts: cards.revoke } : {})}
        />
      }
      scroll={false}
      // 🔴 **失敗橫幅在 footer，不在捲動區**：這一頁 `scroll={false}` ＋ `Thread` 佔滿高度
      // ⇒ 擺在 children 裡會被擠出容器、疊到輸入框上（Peter 2026-08-27 的截圖）。
      footer={
        <>
          {failure ? <ChatFailure message={failure} onDismiss={() => setFailure(null)} /> : null}
          <UsageReadout usage={generation.usage} />
          <Composer chatId={chatId} busy={streaming !== null} onSend={send} />
        </>
      }
    >
      <Thread
        messages={messages}
        streaming={streaming}
        thinking={generation.thinking}
        avatar={char.data?.avatar || undefined}
        name={q.data.characterName}
        characterId={q.data.characterId}
        onSwipe={(messageId, index) => void swipe.mutate({ messageId, index })}
        onAvatarClick={() => setShowChar(true)}
        actions={actions}
        onStop={stop}
        // 卡片自己的前端區塊怎麼呈現：見 `CardFrontend`（那一層才認識 cardscripts）。
        frontend={(part) => (
          <CardFrontend cards={cards} characterId={q.data.characterId} {...part} />
        )}
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
      <CardBackground cards={cards} characterId={q.data.characterId} />
      {cards.inventory ? (
        <ConsentDialog
          open={cards.asking}
          inventory={cards.inventory}
          characterName={q.data.characterName}
          busy={cards.busy}
          onClose={cards.close}
          onConfirm={cards.confirm}
        />
      ) : null}
    </Screen>
  );
}
