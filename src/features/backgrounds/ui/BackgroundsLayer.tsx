import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { fetchChat } from '@/features/chat';
import { FullScreenLayer } from '@/shared/ui/FullScreenLayer';
import { fetchBackgrounds } from '../api';
import type { Fitting } from '../model';
import { useBackgroundActions } from '../useBackgroundActions';
import { BackgroundGrid } from './BackgroundGrid';
import { ScopeRow } from './ScopeRow';
import { UploadButton } from './UploadButton';

/**
 * 背景的全螢層。**沒有分頁 —— 由入口決定它在管誰**
 * （Peter 2026-08-26：「對話頁這邊調整背景永遠是調整這段對話，不能調整全域；
 * /settings 這邊就永遠是全域」）。
 *
 * 🔴 **上一版是「全域／這段對話」兩個分頁，已作廢。** 那個設計讓同一個畫面
 * 可能在改兩種東西，而使用者要先看分頁才知道自己在改哪一個 ——
 * 從對話裡打開卻改到全域，是「按了才發現改錯範圍」的典型。
 *
 * 🔴 **縮放方式兩邊各自獨立**（同一句裁定）：
 * 對話層寫 `chat.backgroundFitting`，全站寫 `settings.background.fitting`；
 * 對話層沒設就跟隨全站。
 */
export function BackgroundsLayer({
  open,
  onClose,
  chatId,
}: {
  open: boolean;
  onClose: () => void;
  /** 有給 ＝ 只管這一間；沒給 ＝ 只管全站。 */
  chatId?: string | undefined;
}) {
  const list = useQuery({ queryKey: ['backgrounds'], queryFn: fetchBackgrounds });
  const chat = useQuery({
    queryKey: ['chat', chatId],
    queryFn: () => fetchChat(chatId ?? ''),
    enabled: Boolean(chatId) && open,
  });
  const act = useBackgroundActions(chatId);

  const forChat = Boolean(chatId);
  const globalFitting = list.data?.global.fitting ?? 'classic';
  // 這一間沒設過就跟隨全站 —— 與 name 同一條 cascade。
  const fitting = (forChat ? (chat.data?.backgroundFitting ?? globalFitting) : globalFitting) as
    | Fitting
    | undefined;
  const globalName = list.data?.global.name;
  const current = forChat ? chat.data?.background : globalName;
  /**
   * 🔴 **跟隨全站＝圖與縮放「都」沒有自己的值**（Peter 2026-08-26）。
   * 只看 `background` 的話，改了縮放之後勾還是打著的，
   * 但那一間其實已經不跟隨了 —— 勾在說謊。
   * ⇒ 改動縮放會寫進 `backgroundFitting`，這個判斷自然就 uncheck，不必另外寫邏輯。
   */
  const follows = forChat && !chat.data?.background && !chat.data?.backgroundFitting;

  return (
    <FullScreenLayer
      open={open}
      title={forChat ? '對話背景' : '全站背景'}
      onClose={onClose}
      action={<UploadButton busy={act.upload.isPending} onPick={(f) => act.upload.mutate(f)} />}
    >
      <Stack spacing={1.5}>
        {/*
         * 🔴 **只有全站這一邊留說明。** Peter 2026-08-26 指名刪掉的是對話頁那句
         * 「只改這一間。其他對話與其他頁面用全站背景（設定 → 背景）」——
         * 對話頁的標題「對話背景」＋那顆「跟隨全站」已經把範圍講完了。
         * 全站這邊沒有勾選鈕，範圍要靠這句講。
         */}
        {forChat ? null : (
          <Typography variant="body2" color="text.secondary">
            所有頁面與沒有自訂背景的對話都用這一張。
          </Typography>
        )}

        <ScopeRow
          fitting={(fitting ?? 'classic') as Fitting}
          onFitting={(f) => (forChat ? act.chatFitting.mutate(f) : act.fitting.mutate(f))}
          {...(forChat
            ? {
                follow: {
                  checked: follows,
                  canUnfollow: Boolean(globalName),
                  onChange: (checked: boolean) =>
                    act.followChat.mutate(
                      checked
                        ? { name: null, fitting: null }
                        : { name: globalName ?? null, fitting: globalFitting },
                    ),
                },
              }
            : {})}
        />

        {list.isPending ? <CircularProgress size={24} /> : null}
        <BackgroundGrid
          items={list.data?.items ?? []}
          current={current}
          onPick={(n) => (forChat ? act.pickChat.mutate(n) : act.pickGlobal.mutate(n))}
          {...(forChat ? {} : { onDelete: (n: string) => act.remove.mutate(n) })}
        />

        <Typography variant="caption" color="text.secondary">
          圖檔存在這台機器的 <code>data/backgrounds/</code>，內建的 23 張來自 SillyTavern。
        </Typography>
      </Stack>
    </FullScreenLayer>
  );
}
