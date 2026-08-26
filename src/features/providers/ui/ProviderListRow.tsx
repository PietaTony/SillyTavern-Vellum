import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Chip from '@mui/material/Chip';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Radio from '@mui/material/Radio';
import Stack from '@mui/material/Stack';
import type { ToastMsg } from '@/shared/ui/Toast';
import { type ProviderRow as Row, STATUS_COPY } from '../registryApi';
import { InlineModelPicker } from './InlineModelPicker';

/**
 * 清單的一列。**名字刻意不叫 `ProviderRow`** —— 那是資料型別的名字，撞名會很難讀。
 * **radio ＝ 切換「對話現在打誰」，其餘區域 ＝ 進設定頁。**
 * （Peter 2026-08-26 選的方案：「點 ◉ 切換；點其他任何地方進設定」。）
 *
 * 🔴 **radio 要 `stopPropagation`**：它坐在 `ListItemButton` 裡面，
 * 不擋的話點一下會同時「切換」＋「跳頁」，而使用者只會看到跳頁 ——
 * 切換成功與否完全看不到。
 *
 * 🔴 **不能用的 radio 一律停用**：`planned`（送不出去）與**沒有金鑰**的都算
 * （Peter 2026-08-26 裁定，推翻了我「沒金鑰的可以點、點了帶去設定」那一版）。
 * ⚠️ 🔴 **停用的 radio 預設是一塊死區** —— 實測點下去 URL 完全不變，
 * 既不切換也不進設定頁。**那比灰圓鈕更糟**：使用者以為自己點到了什麼。
 * ⇒ 停用時加 `pointerEvents: 'none'`，讓點擊落到外層的 `ListItemButton`，
 * 照樣進得去設定頁。出口還在，只是不再假裝那顆圓鈕可以選。
 */
export function ProviderListRow({
  p,
  onOpen,
  onPick,
  onNotify,
}: {
  p: Row;
  onOpen: () => void;
  onPick: () => void;
  onNotify: (m: ToastMsg) => void;
}) {
  const copy = STATUS_COPY[p.status];
  // 送不出去（planned）或送出去必失敗（沒金鑰）—— 兩種都不給選。
  const blocked = p.status === 'planned' || !p.keySet;

  return (
    <ListItemButton onClick={onOpen}>
      <Radio
        checked={p.active}
        disabled={blocked}
        size="small"
        edge="start"
        onClick={(e) => {
          e.stopPropagation();
          onPick();
        }}
        slotProps={{
          input: { 'aria-label': `用 ${p.displayName} 對話` },
        }}
        sx={{ mr: 1, ...(blocked ? { pointerEvents: 'none' } : {}) }}
      />
      <ListItemText
        primary={p.displayName}
        /*
         * 使用中的那一家把「使用中」寫在最前面 —— 徽章講的是「金鑰設好了」，
         * 那與「對話現在打誰」是兩件事，混在一起看不出差別。
         */
        secondary={
          p.active ? (
            <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>使用中 ·</span>
              {/*
               * 🔴 **只有使用中那一列才有下拉**（Peter 2026-08-26）。
               * 26 列都放下拉的話會拉 26 次 models 端點，而且畫面變成一片選單。
               */}
              <InlineModelPicker
                provider={p.id}
                chosen={p.model}
                fallback={p.defaultModel}
                onNotify={onNotify}
                consoleUrl={p.consoleUrl}
              />
            </Stack>
          ) : p.model ? (
            `模型 ${p.model}`
          ) : (
            /*
             * 🔴 **沒選過就標「未驗證」**：`defaultModel` 是 registry 寫死的猜測，
             * 而那份會過期（實測 Anthropic 的 `claude-sonnet-4-5` 已下架）。
             * 標出來比假裝它是事實好。
             */
            `預設模型 ${p.defaultModel}（未驗證）`
          )
        }
        slotProps={{ secondary: { variant: 'caption', component: 'div' } }}
      />
      {/*
       * 🔴 **狀態徽章靠右、緊鄰箭頭**（Peter 2026-08-26）。
       * 掛在名字旁邊時，名字長短不一 ⇒ 徽章的左緣每一列都不同，掃視時要一列一列找。
       * 靠右對齊之後 26 列的徽章在同一條線上。
       */}
      <Stack direction="row" sx={{ gap: 0.5, alignItems: 'center', flex: 'none', ml: 1 }}>
        {copy.label ? (
          <Chip size="small" label={copy.label} {...(copy.color ? { color: copy.color } : {})} />
        ) : null}
        {p.keySet ? <Chip size="small" color="success" label="已設定金鑰" /> : null}
      </Stack>
      <ChevronRightIcon color="disabled" />
    </ListItemButton>
  );
}
