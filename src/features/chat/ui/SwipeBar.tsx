import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import type { Message } from '../model';
import { SwipePicker } from './SwipePicker';

/**
 * 同一則訊息的候選切換（swipe）。**版面照 ST**（M12 G4，實查 `public/style.css`）：
 *   左箭頭貼訊息**左緣**（`.swipe_left { left: 20px }`，`:1312-1315`）
 *   右箭頭與計數器貼**右下角**（`.swipeRightBlock { right:0; bottom:0 }`，`:1259-1264`）
 *   常駐但淡（`opacity: .3`，`:1238-1251`）—— **不是 hover 才出現**
 * ⚠️ **一處刻意不照抄**：ST 是 `position:absolute` 疊在訊息上，我們的他方訊息是
 * 「左豎線＋無容器」（D31 A3），疊上去會壓到字 ⇒ **改成順流的一條，左右對齊兩端**。
 * 讀起來的結果一樣（左邊一顆、右邊計數器＋一顆、淡的），碰撞風險沒有。
 *
 * 🔴 **只有真的有候選才顯示** —— 沒有候選卻畫出箭頭，等於告訴使用者「這裡可以切」然後按了沒反應。
 * 🔴 **計數器本身是按鈕**：點下去開候選清單層（ST 的 `swipe-picker.js`「Jump to swipe history」）。
 */
export function SwipeBar({
  message,
  characterId,
  isGreeting,
  onSwipe,
}: {
  message: Message;
  characterId?: string | undefined;
  /** 這則是不是對話的第一則 —— 只有它的候選才是角色的開場白（見 `SwipePicker`）。 */
  isGreeting: boolean;
  onSwipe: (messageId: string, index: number) => void;
}) {
  // 🔴 hook 一定在早退之前（M4c 踩過：`useMutation` 插在 return 之後 ⇒ 整頁 crash）。
  const [picking, setPicking] = useState(false);
  const total = message.swipes?.length ?? 0;
  if (total < 2) return null;
  const at = message.swipeIndex ?? 0;
  const go = (d: number) => onSwipe(message.id, (at + d + total) % total);

  return (
    <>
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          mt: 0.5,
          opacity: 0.3,
          transition: 'opacity .15s',
          '&:hover, &:focus-within': { opacity: 1 },
        }}
      >
        <IconButton size="small" aria-label="上一個候選" onClick={() => go(-1)}>
          <ChevronLeftIcon fontSize="small" />
        </IconButton>
        <Stack direction="row" sx={{ alignItems: 'center' }}>
          <ButtonBase
            aria-label={`全部 ${total} 個候選`}
            onClick={() => setPicking(true)}
            sx={{ px: 0.75, py: 0.25, borderRadius: 1 }}
          >
            <Typography variant="caption" color="text.secondary">
              {at + 1} / {total}
            </Typography>
          </ButtonBase>
          <IconButton size="small" aria-label="下一個候選" onClick={() => go(1)}>
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>
      {/*
        🔴 **關著的時候完全不掛。** 上一版無條件 render，`SwipePicker` 內的 `useQuery`
        就變成 `Thread` 的硬相依 ⇒ **沒有 `QueryClientProvider` 就 render 不出對話串**
        （測試當場炸出來的；產品裡因為外面剛好包著 provider 所以看不出來）。
        代價只有關閉動畫少了一段，換掉的是一條看不見的耦合。
      */}
      {picking ? (
        <SwipePicker
          open
          onClose={() => setPicking(false)}
          message={message}
          characterId={characterId}
          isGreeting={isGreeting}
          onPick={(i) => {
            onSwipe(message.id, i);
            setPicking(false);
          }}
        />
      ) : null}
    </>
  );
}
