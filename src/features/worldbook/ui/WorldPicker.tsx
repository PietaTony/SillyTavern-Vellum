import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchWorlds } from '../api';
import { subtitleOf } from '../model';

/**
 * 世界書選擇器（C6）。**四層都用同一個**：persona／好友／對話／全域。
 *
 * 🔴 它是 `lorebookId` 那個孤兒欄位的門。M5 把欄位做好了、prompt 也真的會讀它，
 * 但**產品裡沒有任何地方可以選** —— 對使用者來說等於這個功能不存在（總則四）。
 *
 * 🔴 **選的是「別人的那一本」，這件事要說出來。** 現況每本書都屬於某位好友（D-f），
 * 綁上去之後在那位好友的頁面改條目，這裡也會跟著變。
 * 不講的話使用者會以為自己拿到一份獨立的副本 —— 那正是 ST 讓人踩到的陷阱。
 */
export function WorldPicker({
  value,
  onChange,
  label = '世界書',
  hint,
}: {
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  label?: string;
  /** 說明這一層綁定的意思（persona 層與好友層講的不是同一件事）。 */
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  // 🔴 **已經綁了就要先載入清單**，不能只在打開對話框時才載 ——
  // 不然畫面只顯示得出一串 id，使用者看不出自己綁的是哪一本。
  // 沒綁定時不預先載入：清單是這一頁不需要的請求。
  const q = useQuery({
    queryKey: ['worlds'],
    queryFn: fetchWorlds,
    enabled: open || Boolean(value),
  });
  const worlds = q.data ?? [];
  const current = worlds.find((w) => w.id === value);

  return (
    <Stack spacing={0.5}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Stack sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {label}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {/*
             * 🔴 已綁定但清單還沒載入時，**不要顯示「未綁定」** —— 那是謊話。
             * 顯示 id 本身，至少使用者知道有東西在。
             */}
            {value ? (current?.name ?? `已綁定（${value.slice(0, 8)}…）`) : '沒有綁定世界書'}
          </Typography>
        </Stack>
        <Button size="small" onClick={() => setOpen(true)}>
          {value ? '更換' : '選擇'}
        </Button>
      </Stack>
      {hint ? (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      ) : null}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>選擇{label}</DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          {q.isError ? (
            <Alert severity="warning" sx={{ m: 2 }}>
              讀不到世界書清單：{q.error instanceof Error ? q.error.message : ''}
            </Alert>
          ) : null}
          {/*
           * 🔴 **每個死路都要有出口**：一本書都沒有時要說得出「怎麼會有」，
           * 而不是給一個空清單讓人卡在這裡。
           */}
          {!q.isPending && !q.isError && worlds.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
              還沒有任何世界書。世界書是跟著角色卡一起進來的 —— 匯入一張帶世界書的卡就會出現。
            </Typography>
          ) : null}
          <List disablePadding>
            {/* 🔴 「不綁定」要是清單裡的一個選項，不是另外一顆小字連結：解除綁定跟綁定一樣常用 */}
            <ListItemButton
              selected={!value}
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
            >
              <ListItemText primary="不綁定" secondary="這一層不加任何世界書" />
            </ListItemButton>
            {worlds.map((w) => (
              <ListItemButton
                key={w.id}
                selected={w.id === value}
                onClick={() => {
                  onChange(w.id);
                  setOpen(false);
                }}
              >
                <ListItemText primary={w.name} secondary={subtitleOf(w)} />
              </ListItemButton>
            ))}
          </List>
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
