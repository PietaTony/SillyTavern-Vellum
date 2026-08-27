import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { type ReactNode, useState } from 'react';
import type { Message } from '../model';
import { SwipePicker } from './SwipePicker';

/**
 * 同一則訊息的候選切換（swipe）。**把訊息內容包起來，上下各放一條，兩條都置中**
 * （Peter 2026-08-27：「最上方置中跟最下方置中，兩個地方都要有」）。
 *
 * 🔴 **上面那一條是為了長訊息。** 只有下面一條時，開場白那種一整頁的訊息
 * 要一路捲到底才切得動 —— 而使用者想換的正是眼前這一段。
 *
 * 🔴 **兩條共用同一個 `picking` state，候選清單層只掛一份。**
 * 各自持有的話會有兩個層可以被打開，而 `useSwipeKeys` 判斷「有層開著就不搶鍵」
 * 只看得到其中一個。
 *
 * 🔴 **兩條的 aria-label 不一樣**（「訊息上方」／「訊息下方」）：
 * 同一個名字出現兩次，讀螢幕的人分不出自己按到哪一顆。
 *
 * ⚠️ **版面刻意不再照 ST。** ST 是 `position:absolute` 疊在訊息上、左箭頭貼左緣、
 * 右箭頭與計數器貼右下角（實查 `public/style.css:1259-1315`）。
 * 我們的他方訊息是「左豎線＋無容器」（D31 A3），沒有容器可以貼四角，
 * 而 Peter 要的是置中 —— 照抄反而會變成兩端各一顆、中間空一大片。
 * 常駐但淡（`opacity: .3`）這一條照留：**不是 hover 才出現**。
 *
 * 🔴 **只有真的有候選才顯示** —— 沒有候選卻畫出箭頭，等於告訴使用者「這裡可以切」然後按了沒反應。
 * 🔴 **計數器本身是按鈕**：點下去開候選清單層（ST 的 `swipe-picker.js`「Jump to swipe history」）。
 */
export function SwipeBar({
  message,
  characterId,
  isGreeting,
  onSwipe,
  children,
}: {
  message: Message;
  characterId?: string | undefined;
  /** 這則是不是對話的第一則 —— 只有它的候選才是角色的開場白（見 `SwipePicker`）。 */
  isGreeting: boolean;
  onSwipe: (messageId: string, index: number) => void;
  /** 被夾在上下兩條之間的訊息內容。 */
  children: ReactNode;
}) {
  // 🔴 hook 一定在早退之前（M4c 踩過：`useMutation` 插在 return 之後 ⇒ 整頁 crash）。
  const [picking, setPicking] = useState(false);
  const total = message.swipes?.length ?? 0;
  // 🔴 沒有候選時**內容照樣要畫出來** —— 這一層是包住內容的，不是附加在旁邊的。
  if (total < 2) return <>{children}</>;
  const at = message.swipeIndex ?? 0;
  const go = (d: number) => onSwipe(message.id, (at + d + total) % total);

  const bar = (where: '訊息上方' | '訊息下方') => (
    <Stack
      direction="row"
      sx={{
        alignItems: 'center',
        justifyContent: 'center',
        [where === '訊息上方' ? 'mb' : 'mt']: 0.5,
        opacity: 0.3,
        transition: 'opacity .15s',
        '&:hover, &:focus-within': { opacity: 1 },
      }}
    >
      <IconButton size="small" aria-label={`上一個候選（${where}）`} onClick={() => go(-1)}>
        <ChevronLeftIcon fontSize="small" />
      </IconButton>
      <ButtonBase
        aria-label={`全部 ${total} 個候選（${where}）`}
        onClick={() => setPicking(true)}
        sx={{ px: 0.75, py: 0.25, borderRadius: 1 }}
      >
        <Typography variant="caption" color="text.secondary">
          {at + 1} / {total}
        </Typography>
      </ButtonBase>
      <IconButton size="small" aria-label={`下一個候選（${where}）`} onClick={() => go(1)}>
        <ChevronRightIcon fontSize="small" />
      </IconButton>
    </Stack>
  );

  return (
    <>
      {bar('訊息上方')}
      {children}
      {bar('訊息下方')}
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
