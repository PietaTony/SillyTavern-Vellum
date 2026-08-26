import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { DraftField } from '@/shared/ui/DraftField';
import { FullScreenLayer } from '@/shared/ui/FullScreenLayer';
import { pushToast } from '@/shared/ui/toastStore';
import { fetchCharacter, nameOf, updateCharacter } from '../api';
import { alternatesOf } from '../model';
import { GreetingsSection } from './GreetingsSection';

/**
 * 對話裡點對方的頭像會開的那一層（Peter 2026-08-26 選「進角色設定」）。
 *
 * 🔴 **ST 沒有這個。** 實查（2026-08-26）：ST 點 `.mes .avatar` 只開一張
 * 可拖曳的放大圖浮窗（`script.js:12165` → `#zoomed_avatar_template`），
 * 不是面板也不是選單，而且**沒有**雙擊／右鍵／長按的其他行為。
 * ⇒ 這一層是我們自己加的，不是照抄。
 *
 * 🔴 **改了要按「儲存」才生效**，不是改一個字存一次。
 * 名稱與描述是長文字，逐字 PATCH 等於每次按鍵打一次網路；
 * 而且「還沒想好就先關掉」是常態 —— 沒有儲存鈕就沒有反悔的路。
 * ⚠️ 額外問候語那一層例外：它在**自己的層**裡編，回到這一層才一起存。
 */
export function CharacterLayer({
  open,
  onClose,
  characterId,
  readOnly = false,
}: {
  open: boolean;
  onClose: () => void;
  characterId: string;
  /**
   * 🔴 **對話中是唯讀**（Peter 2026-08-26：「ST 不能對話中編輯的話，
   * 對話中編輯的功能就先鎖起來」）。實查確認 ST 點頭像只開一張放大圖，
   * 沒有任何從對話裡改角色的路徑。
   * ⚠️ 「先」鎖起來 —— 要開放時把這個 prop 拿掉即可，編輯的實作已經在這裡了。
   */
  readOnly?: boolean;
}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['character', characterId],
    queryFn: () => fetchCharacter(characterId),
    enabled: open && characterId !== '',
  });

  /**
   * 🔴 **本地草稿與伺服器狀態分開。** 直接綁 `q.data` 的話，
   * 背景 refetch 會把使用者打到一半的字換掉。
   * ⚠️ 只在「這一層剛打開」時同步一次 —— 依賴放 `open` 與 `q.data?.id`，
   *    不要放整個 `q.data`（每次 refetch 都是新物件，會一直重設）。
   */
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [greetings, setGreetings] = useState<string[]>([]);
  useEffect(() => {
    if (!open || !q.data) return;
    setName(nameOf(q.data));
    setDescription(q.data.description);
    // 🔴 **不可以無條件 `slice(1)`** —— 空 `first_mes` 的卡會砍掉真正的第一則額外問候。
    setGreetings(alternatesOf(q.data));
  }, [open, q.data]);

  const save = useMutation({
    mutationFn: () =>
      updateCharacter(characterId, {
        // 🔴 改名寫 `displayName`，**永不寫回卡片的 `name`**（D-h）。
        displayName: name,
        description,
        // 第一則沿用原本那則（這一層不改它），額外問候語接在後面。空白一律丟掉。
        greetings: [q.data?.firstMessage ?? '', ...greetings].filter((g) => g.trim() !== ''),
      }),
    onSuccess: async () => {
      pushToast({ severity: 'success', text: '角色設定已存好' });
      await qc.invalidateQueries({ queryKey: ['character', characterId] });
      onClose();
    },
    onError: (e: Error) => pushToast({ severity: 'warning', text: e.message }),
  });

  return (
    <FullScreenLayer
      open={open}
      title="角色設定"
      onClose={onClose}
      action={
        readOnly ? null : (
          <Button size="small" loading={save.isPending} onClick={() => save.mutate()}>
            儲存
          </Button>
        )
      }
    >
      {q.isPending ? <CircularProgress size={24} /> : null}
      {q.data ? (
        <Stack spacing={2.5}>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            {/* 🔴 頭像在這裡**只看不改**：換頭像要動卡片，是另一件事（`plans/90-BACKLOG.md`）。 */}
            <Avatar src={q.data.avatar || undefined} sx={{ width: 96, height: 96 }}>
              {nameOf(q.data).slice(0, 1)}
            </Avatar>
          </Box>
          {/* 🔴 `readOnly` 不是 `disabled`：長文字灰掉會很難讀，而唯讀模式的重點就是讀。 */}
          <DraftField
            noDraft="這一層有儲存鈕；沒存就關掉＝刻意放棄，存草稿反而會讓下次打開看到幽靈值"
            fullWidth
            label="角色名稱"
            value={name}
            onChange={setName}
            slotProps={{ input: { readOnly } }}
          />
          <DraftField
            noDraft="同上"
            fullWidth
            multiline
            minRows={3}
            maxRows={12}
            label="角色描述"
            value={description}
            onChange={setDescription}
            slotProps={{ input: { readOnly } }}
          />
          <GreetingsSection greetings={greetings} onChange={setGreetings} readOnly={readOnly} />
        </Stack>
      ) : null}
    </FullScreenLayer>
  );
}
