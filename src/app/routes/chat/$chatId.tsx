import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { ChatFailure } from '@/app/screens/ChatFailure';
import { ChatMenu } from '@/app/screens/ChatMenu';
import { ChatLoading, ChatUnavailable } from '@/app/screens/ChatUnavailable';
import { useBack } from '@/app/screens/useBack';
import { useChatBackgroundOverride } from '@/app/screens/useChatBackgroundOverride';
import { CharacterLayer, fetchCharacter } from '@/features/characters';
import {
  appendMessage,
  Composer,
  fetchChat,
  type Message,
  streamGenerate,
  swipeMessage,
  Thread,
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
  const [local, setLocal] = useState<Message[] | null>(null);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * 切候選。🔴 **`setLocal(null)` 不可以省**（敵意審查 2026-08-26 B1）：
   * `messages` 是 `local ?? q.data.messages`，送過一則訊息之後 `local` 就不是 null，
   * 全檔又沒有別的地方歸零 ⇒ `refetch()` 的新資料被 `??` 短路，
   * **箭頭／鍵盤／清單層三個入口同時變成「按了沒反應」**（伺服器已經換了、畫面不動）。
   * ⚠️ 先 `await refetch()` 再歸零；反過來會閃一下舊資料。
   */
  const swipe = useMutation({
    mutationFn: ({ messageId, index }: { messageId: string; index: number }) =>
      swipeMessage(chatId, messageId, index),
    onSuccess: async () => {
      await q.refetch();
      setLocal(null);
    },
  });

  const messages = local ?? q.data?.messages ?? [];

  async function send(text: string) {
    setFailure(null);
    // 🔴 **這一步失敗就把例外丟回去給 `Composer`**，它才知道「沒送出去，字要留著」。
    // 在此之前 `Composer` 是先清空再送 —— 網路一斷，打過的字就真的沒了。
    let mine: Message;
    try {
      mine = await appendMessage(chatId, 'user', text);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : '送不出去');
      throw e;
    }
    setLocal([...messages, mine]);
    setStreaming('');

    const ac = new AbortController();
    abortRef.current = ac;
    let acc = '';
    await streamGenerate(
      chatId,
      (e) => {
        if (e.type === 'delta') {
          acc += e.text;
          setStreaming(acc);
        } else if (e.type === 'done') {
          setLocal((prev) => [...(prev ?? []), e.message]);
          setStreaming(null);
        } else {
          setStreaming(null);
          setFailure(e.message);
        }
      },
      ac.signal,
    );
  }

  if (q.isPending) return <ChatLoading />;
  if (q.isError)
    return (
      <ChatUnavailable why={q.error instanceof Error ? q.error.message : ''} onBack={onBack} />
    );

  return (
    <Screen
      title={q.data.characterName}
      onBack={onBack}
      action={
        <ChatMenu
          chatId={chatId}
          persona={q.data.persona}
          onPersonaChanged={() => void q.refetch()}
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
