import UploadIcon from '@mui/icons-material/Upload';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchChat } from '@/features/chat';
import { DraftField } from '@/shared/ui/DraftField';
import { FullScreenLayer } from '@/shared/ui/FullScreenLayer';
import { fetchBackgrounds } from '../api';
import { FITTING_LABEL, FITTINGS, type Fitting } from '../model';
import { useBackgroundActions } from '../useBackgroundActions';
import { BackgroundGrid } from './BackgroundGrid';

/**
 * 背景的全螢層。**兩個分頁照抄 ST**（實查 `index.html:5684-5730`）：
 *   **全域** —— 所有對話的預設，存 `settings.json`
 *   **這段對話** —— 只有這一間，存對話檔自己（ST 的 `chat_metadata.custom_background`）
 * 對話層有值就蓋過全域；**「跟隨全域」是對話分頁的第一個選項**，
 * 沒有它的話對話一旦設過就永遠脫鉤。
 *
 * 🔴 **縮放模式只有一個、屬於全域**（與 ST 相同）—— 它是顯示偏好，不是「這張圖的屬性」。
 */
export function BackgroundsLayer({
  open,
  onClose,
  chatId,
}: {
  open: boolean;
  onClose: () => void;
  /** 沒給就只有「全域」分頁（例：從設定頁打開）。 */
  chatId?: string | undefined;
}) {
  const [tab, setTab] = useState<'global' | 'chat'>('global');
  const list = useQuery({ queryKey: ['backgrounds'], queryFn: fetchBackgrounds });
  const chat = useQuery({
    queryKey: ['chat', chatId],
    queryFn: () => fetchChat(chatId ?? ''),
    enabled: Boolean(chatId) && open,
  });
  const act = useBackgroundActions(chatId);

  const items = list.data?.items ?? [];
  const globalName = list.data?.global.name;
  const chatName = chat.data?.background;
  const onGlobal = tab === 'global' || !chatId;

  return (
    <FullScreenLayer
      open={open}
      title="背景"
      onClose={onClose}
      action={
        <Button
          component="label"
          size="small"
          startIcon={act.upload.isPending ? <CircularProgress size={16} /> : <UploadIcon />}
          disabled={act.upload.isPending}
        >
          上傳
          {/* 🔴 `accept` 要與後端白名單一致（`server/lib/backgrounds.ts` 的 `ALLOWED`）。 */}
          <input
            hidden
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.gif,.avif"
            onChange={(e) => {
              const f = e.target.files?.[0];
              // 🔴 選同一個檔第二次也要觸發 ⇒ 清掉 value，否則 change 不會再發生。
              e.target.value = '';
              if (f) act.upload.mutate(f);
            }}
          />
        </Button>
      }
    >
      <Stack spacing={1.5}>
        {chatId ? (
          <Tabs value={tab} onChange={(_e, v: 'global' | 'chat') => setTab(v)}>
            <Tab value="global" label="全域" />
            <Tab value="chat" label="這段對話" />
          </Tabs>
        ) : null}

        {onGlobal ? (
          <DraftField
            select
            noDraft="下拉選單，沒有打到一半的字可以掉"
            size="small"
            label="縮放方式"
            value={list.data?.global.fitting ?? 'classic'}
            onChange={(v) => act.fitting.mutate(v as Fitting)}
            helperText="「經典」貼齊左上，「填滿」置中裁切 —— 直式的圖差別最明顯"
          >
            {FITTINGS.map((f) => (
              <MenuItem key={f} value={f}>
                {FITTING_LABEL[f]}
              </MenuItem>
            ))}
          </DraftField>
        ) : (
          <Button
            size="small"
            variant={chatName ? 'outlined' : 'contained'}
            onClick={() => act.pickChat.mutate(null)}
          >
            {chatName ? '改回跟隨全域' : '目前跟隨全域'}
          </Button>
        )}

        {list.isPending ? <CircularProgress size={24} /> : null}
        <BackgroundGrid
          items={items}
          current={onGlobal ? globalName : chatName}
          onPick={(n) => (onGlobal ? act.pickGlobal.mutate(n) : act.pickChat.mutate(n))}
          {...(onGlobal ? { onDelete: (n: string) => act.remove.mutate(n) } : {})}
        />

        <Typography variant="caption" color="text.secondary">
          圖檔存在這台機器的 <code>data/backgrounds/</code>，內建的 23 張來自 SillyTavern。
        </Typography>
      </Stack>
    </FullScreenLayer>
  );
}
