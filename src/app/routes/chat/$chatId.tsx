import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { CardBackground } from '@/app/screens/CardBackground';
import { CardFrontend } from '@/app/screens/CardFrontend';
import { ChatFailure } from '@/app/screens/ChatFailure';
import { ChatMenu } from '@/app/screens/ChatMenu';
import { ChatLoading, ChatUnavailable } from '@/app/screens/ChatUnavailable';
import { useBack } from '@/app/screens/useBack';
import { useChatBackgroundOverride } from '@/app/screens/useChatBackgroundOverride';
import { ConsentDialog, useCardScripts, useCardVars } from '@/features/cardscripts';
import { CharacterLayer, fetchCharacter } from '@/features/characters';
import {
  Composer,
  fetchChat,
  SwipePicker,
  Thread,
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
  const { messages, streaming, thinking, failure, setFailure, send, reset } = useChatStream(
    chatId,
    q.data?.messages,
  );

  const swipe = useSwipeMessage(chatId, () => q.refetch(), reset);

  // 卡片變數的四種範圍 —— 種什麼進去、寫到哪裡（見 `useCardVars`）。
  const vars = useCardVars({ chatId, characterId: q.data?.characterId ?? '' });

  // 🔴 卡片自己的程式（M13 第二期）。**必須在所有早退之前呼叫**（hooks 規則）
  // ⇒ `characterId` 這時可能還是空字串，`useCardScripts` 自己會擋掉那一輪查詢。
  const cards = useCardScripts({
    chatId,
    characterId: q.data?.characterId ?? '',
    messages: () => messages,
    swipe: (messageId, index) => swipe.mutateAsync({ messageId, index }),
    // 🔴 卡片腳本的狀態（桌寵尺寸就存在這裡）。存檔不重讀對話 ——
    // 重讀會讓 srcdoc 變、iframe 整個重生，桌寵每存一次就閃一次。
    // 範圍決定存到哪一支端點，理由見 `useCardVars`。
    saveVariables: vars.saveVariables,
    initialVars: vars.chatVarsOf(q.data?.variables),
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
          <Composer chatId={chatId} busy={streaming !== null} onSend={send} />
        </>
      }
    >
      <Thread
        messages={messages}
        streaming={streaming}
        thinking={thinking}
        avatar={char.data?.avatar || undefined}
        name={q.data.characterName}
        characterId={q.data.characterId}
        onSwipe={(messageId, index) => void swipe.mutate({ messageId, index })}
        onAvatarClick={() => setShowChar(true)}
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
