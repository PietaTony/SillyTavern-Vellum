import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { fetchCharacter } from '@/features/characters';
import {
  appendMessage,
  Composer,
  fetchChat,
  type Message,
  streamGenerate,
  Thread,
} from '@/features/chat';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Screen } from '@/shared/ui/Screen';

export const Route = createFileRoute('/chat/$chatId')({ component: ChatPage });

function ChatPage() {
  const { chatId } = Route.useParams();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['chat', chatId], queryFn: () => fetchChat(chatId) });
  // 頭像從角色現取，不複製進對話（避免每段對話多帶一份 base64，也避免換圖後過期）
  const char = useQuery({
    queryKey: ['character', q.data?.characterId],
    queryFn: () => fetchCharacter(q.data?.characterId ?? ''),
    enabled: Boolean(q.data?.characterId),
  });

  const [local, setLocal] = useState<Message[] | null>(null);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const messages = local ?? q.data?.messages ?? [];

  async function send(text: string) {
    setFailure(null);
    const mine = await appendMessage(chatId, 'user', text);
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

  if (q.isPending) return <Screen title="⋯">載入中</Screen>;
  if (q.isError)
    return (
      <Screen title="打不開這段對話">
        <ErrorState
          title="找不到這段對話"
          detail={q.error instanceof Error ? q.error.message : ''}
          action={{
            label: '重新加一個好友',
            onAct: () => {
              void nav({ to: '/first-run/add-friend' });
            },
          }}
        />
      </Screen>
    );

  return (
    <Screen
      title={q.data.characterName}
      // 設計正本 back.json：Chat-Thread-Layout--5 → Friends-And-Cards--1（好友列表）。
      // 🔴 進得到對話串就代表首次設定已經結束（Peter 2026-08-25）⇒ 落點是列表，不是 first-run。
      onBack={() => {
        void nav({ to: '/chat-list' });
      }}
      scroll={false}
      footer={<Composer busy={streaming !== null} onSend={(t) => void send(t)} />}
    >
      <Thread
        messages={messages}
        streaming={streaming}
        avatar={char.data?.avatar || undefined}
        name={q.data.characterName}
      />
      {failure ? (
        <ErrorState
          title="這一輪沒有生成成功"
          detail={failure}
          action={{ label: '重新送出上一句', onAct: () => setFailure(null) }}
        />
      ) : null}
    </Screen>
  );
}
