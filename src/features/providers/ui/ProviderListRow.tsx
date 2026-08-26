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
 * 🔴 **只有 `planned` 的四家 radio 停用**（真的送不出去，內頁的 `PlannedNote` 會說還缺什麼）。
 * **「還沒有金鑰」的那些 radio 照樣可以點** —— 點了帶他去設定該家的金鑰。
 * ⚠️ 初版把它們一起停用，畫面上就是 25 顆灰掉的圓鈕、沒有任何說明 ——
 * 那是「畫出引擎不支援的控制項」的鏡像：**畫出一個不告訴你為什麼不能用的控制項**。
 * 本專案的原則是每個死路都要有出口，停用的控制項給不出出口。
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
  // 🔴 只有 planned 是真的不能碰；沒金鑰是「還沒設定」，那是要引導不是要停用。
  const blocked = p.status === 'planned';

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
        sx={{ mr: 1 }}
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
                value={p.model ?? p.defaultModel}
                onNotify={onNotify}
              />
            </Stack>
          ) : p.model ? (
            `模型 ${p.model}`
          ) : (
            `預設模型 ${p.defaultModel}`
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
