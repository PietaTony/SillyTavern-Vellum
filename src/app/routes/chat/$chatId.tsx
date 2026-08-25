import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { useBack } from '@/app/screens/useBack';
import { fetchCharacter } from '@/features/characters';
import {
  appendMessage,
  Composer,
  fetchChat,
  type Message,
  streamGenerate,
  swipeMessage,
  Thread,
} from '@/features/chat';
import { ChatPersona } from '@/features/persona';
import { Screen } from '@/shared/ui/Screen';

export const Route = createFileRoute('/chat/$chatId')({ component: ChatPage });

function ChatPage() {
  const { chatId } = Route.useParams();
  const nav = useNavigate();
  const onBack = useBack();
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

  /**
   * 切換開場白的候選。**成功之後要重讀對話**（文字換了）**也要重讀世界書**——
   * 🔴 切開場白會連帶重算世界書開關，那是驗收 B3 的完整路徑。
   */
  const swipe = useMutation({
    mutationFn: ({ messageId, index }: { messageId: string; index: number }) =>
      swipeMessage(chatId, messageId, index),
    onSuccess: () => {
      void q.refetch();
    },
  });

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

  if (q.isPending)
    return (
      <Screen title="⋯">
        <CircularProgress size={24} />
      </Screen>
    );
  if (q.isError)
    return (
      <Screen title="打不開這段對話" onBack={onBack}>
        <Alert
          severity="warning"
          action={
            <Button size="small" onClick={() => void nav({ to: '/add-friend' })}>
              重新加一個好友
            </Button>
          }
        >
          找不到這段對話：{q.error instanceof Error ? q.error.message : ''}
        </Alert>
      </Screen>
    );

  return (
    <Screen
      title={q.data.characterName}
      onBack={onBack}
      action={
        <ChatPersona chatId={chatId} persona={q.data.persona} onChanged={() => void q.refetch()} />
      }
      scroll={false}
      footer={<Composer chatId={chatId} busy={streaming !== null} onSend={(t) => void send(t)} />}
    >
      <Thread
        messages={messages}
        streaming={streaming}
        avatar={char.data?.avatar || undefined}
        name={q.data.characterName}
        onSwipe={(messageId, index) => void swipe.mutate({ messageId, index })}
      />
      {failure ? (
        <Alert
          severity="warning"
          action={
            <Button size="small" onClick={() => setFailure(null)}>
              重新送出上一句
            </Button>
          }
        >
          這一輪沒有生成成功：{failure}
        </Alert>
      ) : null}
    </Screen>
  );
}
