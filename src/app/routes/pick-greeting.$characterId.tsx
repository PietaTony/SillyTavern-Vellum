import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { fetchCharacter, fetchGreetings, nameOf } from '@/features/characters';
import { createChat } from '@/features/chat';
import { Screen } from '@/shared/ui/Screen';

export const Route = createFileRoute('/pick-greeting/$characterId')({
  component: PickGreetingPage,
});

/**
 * 選開場白。**落點是「剛建立好角色、進入對話之前」**（Peter 2026-08-25 指定）。
 *
 * 🔴 **為什麼是一張獨立的畫面而不是進去再切**：這張卡的 9 則開場白**分屬不同的線**
 * （成年／大一／大二／童年），每一則帶自己的 `<!-- lore -->` 標籤，
 * 選哪一則就決定世界書開哪幾條。**那是「要玩哪一條故事線」的選擇，不是「換句話說」。**
 * 進去之後才發現選錯，前面聊的都白費了。
 *
 * ⚠️ 外觀是粗胚（U7 未定案，階段八重做）。現在的判準是**功能真的通**。
 */
function PickGreetingPage() {
  const { characterId } = Route.useParams();
  const nav = useNavigate();
  const ch = useQuery({
    queryKey: ['character', characterId],
    queryFn: () => fetchCharacter(characterId),
  });
  const gs = useQuery({
    queryKey: ['greetings', characterId],
    queryFn: () => fetchGreetings(characterId),
  });

  const start = useMutation({
    mutationFn: (index: number) => createChat(characterId, index),
    onSuccess: (chat) => void nav({ to: '/chat/$chatId', params: { chatId: chat.id } }),
  });

  const greetings = gs.data ?? [];

  return (
    <Screen title="選一個開場" onBack={() => void nav({ to: '/friends' })}>
      {ch.isPending ? <CircularProgress size={24} /> : null}
      {ch.isError ? <Alert severity="warning">讀不到這個角色</Alert> : null}
      {ch.data ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {nameOf(ch.data)} 有 {greetings.length} 種開場。
          <Box component="span" sx={{ fontWeight: 600 }}>
            {' '}
            不同的開場會開啟不同的世界書設定
          </Box>
          ，選好再開始。
        </Typography>
      ) : null}
      {start.isError ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          開始失敗：{start.error instanceof Error ? start.error.message : '未知錯誤'}
        </Alert>
      ) : null}
      <Stack spacing={1.5}>
        {greetings.map((g) => (
          <Paper key={g.index} variant="outlined" sx={{ p: 1.5 }}>
            {/*
             * 🔴 編號與「額外問候語」那一層對齊（GAP-67）——
             * 在此之前這裡寫「第 N 種」用的是含第一則的索引，
             * 同一則內容在前後兩頁差 1，看起來像兩則不同的東西。
             */}
            <Typography variant="subtitle2">
              {g.title ?? (g.alt === null ? '原本的開場' : `額外問候語 第 ${g.alt} 則`)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              會開啟 {g.lore} 條世界書設定
            </Typography>
            <Box sx={{ maxHeight: 120, overflow: 'hidden', my: 0.5 }}>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {g.preview.slice(0, 240)}
                {g.preview.length > 240 ? '⋯' : ''}
              </Typography>
            </Box>
            <Button
              size="small"
              variant="contained"
              loading={start.isPending && start.variables === g.index}
              onClick={() => start.mutate(g.index)}
            >
              用這個開始
            </Button>
          </Paper>
        ))}
      </Stack>
    </Screen>
  );
}
