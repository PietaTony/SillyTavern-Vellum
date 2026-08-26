import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { fetchGreetings } from '@/features/characters';
import { FullScreenLayer } from '@/shared/ui/FullScreenLayer';
import type { Message } from '../model';

/**
 * 候選清單層（swipe picker）。
 *
 * 🔴 **這是原本 `/pick-greeting` 那一頁降下來的**（M12 G1／G6，Peter 2026-08-26 裁定）。
 * 上一版它是**擋在進對話之前的路由頁**，ST 沒有那道關卡。
 * ST 有的是 `public/scripts/swipe-picker.js` 的「Jump to swipe history」——
 * **進對話之後、從訊息叫出來的疊層彈窗**，而且不限第一則訊息：
 * 任何 `swipes.length > 1` 的訊息都能開（`swipe-picker.js:17-34`）。
 *
 * 🔴 **我們比 ST 多的那一欄要留著**：每則開場白帶自己的 `<!-- lore -->` 標籤，
 * 選哪一則決定世界書開哪幾條 —— 那是當初做 `/pick-greeting` 的理由，
 * 關卡拿掉了，但**資訊不能跟著消失**。
 */
export function SwipePicker({
  open,
  onClose,
  message,
  characterId,
  isGreeting,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  message: Message;
  /** 沒給就只列文字（那代表這則訊息的候選不是開場白）。 */
  characterId?: string | undefined;
  /**
   * 🔴 **這則是不是對話的第一則**。只有第一則的候選是照角色的 `greetings` 建的
   * （`server/routes/chats.ts:73`），別則就算候選數一樣也不是同一份東西。
   */
  isGreeting: boolean;
  onPick: (index: number) => void;
}) {
  const swipes = message.swipes ?? [];
  const at = message.swipeIndex ?? 0;
  const gs = useQuery({
    queryKey: ['greetings', characterId],
    queryFn: () => fetchGreetings(characterId ?? ''),
    enabled: Boolean(characterId) && isGreeting,
  });

  /**
   * 🔴 **只守長度是不夠的**（敵意審查 2026-08-26 B3）。
   * 角色的問候語清單與這則訊息的候選是**兩份資料**，長度相等只是碰巧：
   * 匯入的 ST 對話裡，中段某則剛好有 3 個候選、而角色剛好有 3 則問候語 ⇒
   * 上一版就會把「額外問候語 第 N 則」「會開啟 X 條世界書設定」硬套上去，
   * 而且 `m?.preview ?? text` 會**用問候語的內容蓋掉真正的候選文字** ——
   * 使用者看到的三則根本不是這則訊息的候選。
   * ⇒ 先問「是不是第一則」，再問長度。兩個都成立才敢用。
   */
  const meta = isGreeting && gs.data && gs.data.length === swipes.length ? gs.data : null;

  return (
    // 🔴 標題要跟著內容誠實（T7）：不是開場白的時候切的就不是「開場」。
    <FullScreenLayer open={open} title={meta ? '切換開場' : '切換候選'} onClose={onClose}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        這則訊息有 {swipes.length} 個候選。
        {meta ? (
          <Box component="span" sx={{ fontWeight: 600 }}>
            {' '}
            不同的開場會開啟不同的世界書設定。
          </Box>
        ) : null}
      </Typography>
      <Stack spacing={1.5}>
        {swipes.map((text, i) => {
          const m = meta?.[i];
          const current = i === at;
          return (
            <Paper
              // 🔴 **候選的 index 就是它的身分**，不是「順序碰巧長這樣」——
              // ST 的 `swipe_id` 也是 index（`script.js:6941-6956`），切換端點收的也是 index。
              // biome-ignore lint/suspicious/noArrayIndexKey: 同 GreetingsLayer：index 是這份資料的主鍵
              key={`${message.id}-${i}`}
              variant="outlined"
              component="button"
              type="button"
              onClick={() => onPick(i)}
              sx={{
                p: 1.5,
                textAlign: 'left',
                width: '100%',
                cursor: 'pointer',
                font: 'inherit',
                color: 'inherit',
                // 🔴 目前這一則要看得出來，否則使用者不知道自己站在哪
                borderColor: current ? 'primary.main' : undefined,
                borderWidth: current ? 2 : 1,
              }}
            >
              <Typography variant="subtitle2">
                {m?.title ??
                  (m && m.alt === null ? '原本的開場' : null) ??
                  (m ? `額外問候語 第 ${m.alt} 則` : `候選 ${i + 1}`)}
                {current ? '（目前）' : ''}
              </Typography>
              {m ? (
                <Typography variant="caption" color="text.secondary">
                  會開啟 {m.lore} 條世界書設定
                </Typography>
              ) : null}
              <Box sx={{ maxHeight: 120, overflow: 'hidden', my: 0.5 }}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {(m?.preview ?? text).slice(0, 240)}
                  {(m?.preview ?? text).length > 240 ? '⋯' : ''}
                </Typography>
              </Box>
            </Paper>
          );
        })}
      </Stack>
    </FullScreenLayer>
  );
}
