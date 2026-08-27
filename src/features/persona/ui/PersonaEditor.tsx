import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { draftFromImage } from '@/features/characters';
import { WorldPicker } from '@/features/worldbook';
import { readImageScaled, toDataUrl } from '@/shared/lib/image';
import { DraftField } from '@/shared/ui/DraftField';
import { pushToast } from '@/shared/ui/toastStore';
import type { PersonaDraft } from '../api';

/**
 * 「我是誰」的編輯器。
 *
 * 🔴 **名字與自我介紹是兩條不同的路**：名字驅動 `{{user}}`（對方怎麼稱呼你），
 * 自我介紹會整段進 prompt（對方知道你是什麼樣的人）。分開說明，不要合成一句。
 */
/** 🔴 還原在 `me.tsx`（父層）做 —— 兩個欄位各自在 effect 裡還原會互相蓋掉。 */
export const PERSONA_DRAFT = {
  name: 'vellum.draft.persona.name',
  description: 'vellum.draft.persona.description',
} as const;

export function PersonaEditor({
  value,
  onChange,
  onSave,
  saving,
  renamed,
}: {
  value: PersonaDraft;
  onChange: (d: PersonaDraft) => void;
  onSave: () => void;
  saving: boolean;
  /** 剛剛改過名字 —— 要告知歷史訊息不會跟著變（驗收 C6）。 */
  renamed?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const set = (k: keyof PersonaDraft) => (next: string) => onChange({ ...value, [k]: next });

  /**
   * 🔴 **與「加入好友」同一支端點、同一顆按鈕的措辭**（Peter 2026-08-27：「這邊也要有
   * 圖片自動生成文字」）。同一件事在兩個入口不可以長得不一樣，也不該各接一條路。
   *
   * 🔴 **只取 `name` 與 `description`** —— 回來的 `firstMessage` 是「角色開口的第一句話」，
   * persona 沒有那個欄位。丟掉它，不要硬塞進自我介紹。
   *
   * ⚠️ **已知的不對味**：後端那句 prompt 寫的是「看這張**角色**圖…描述寫外貌與性格」
   * （`server/adapters/gemini.ts`），所以生出來的自我介紹會像第三人稱的角色簡介，
   * 而這一格要的是「你是誰」。欄位可以直接改所以不擋人，但要真的對味
   * 得請主執行線加一句 persona 版的 prompt（那支是他們的地盤）。
   * 🔴 失敗走 tips 不佔版面 —— 下一步是「換一張圖再按一次」，橫幅擋在中間反而礙事。
   */
  const gen = useMutation({
    // 🔴 **先轉成 data URL** —— 存著的頭像可能是一個路徑，直接送過去會被擋。
    mutationFn: async (src: string) => draftFromImage(await toDataUrl(src)),
    onError: (e: Error) => pushToast({ severity: 'warning', text: `生成失敗：${e.message}` }),
    onSuccess: (r) => onChange({ ...value, name: r.name, description: r.description }),
  });

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <Button component="label" sx={{ p: 0, borderRadius: '50%', minWidth: 0 }} disabled={busy}>
          <Avatar src={value.avatar || undefined} sx={{ width: 64, height: 64 }}>
            我
          </Avatar>
          <input
            hidden
            type="file"
            accept="image/*"
            aria-label="上傳我的頭像"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setBusy(true);
              void readImageScaled(f)
                .then((avatar) => onChange({ ...value, avatar }))
                .finally(() => setBusy(false));
            }}
          />
        </Button>
        <DraftField
          draftKey={PERSONA_DRAFT.name}
          fullWidth
          size="small"
          label="你的名字"
          value={value.name}
          onChange={set('name')}
          placeholder="對方會這樣稱呼你"
        />
      </Stack>

      <Button
        variant="outlined"
        size="small"
        loading={gen.isPending}
        disabled={!value.avatar || busy}
        onClick={() => value.avatar && gen.mutate(value.avatar)}
      >
        透過圖片自動生成內容
      </Button>

      {renamed ? (
        <Alert severity="info">
          改名之後，<b>之前訊息裡的舊名字不會跟著改</b>。對方可能會把舊名字當成另一個人。
        </Alert>
      ) : null}

      {/* 🔴 這是全站**唯一會打很長**的欄位（金鑰跟名字掉了重貼就好，這個掉了很痛）。 */}
      <DraftField
        draftKey={PERSONA_DRAFT.description}
        fullWidth
        multiline
        minRows={3}
        label="自我介紹"
        value={value.description ?? ''}
        onChange={set('description')}
        placeholder="你想讓對方知道的事。留空也可以。"
      />
      <Typography variant="caption" color="text.secondary">
        名字決定對方怎麼稱呼你；自我介紹會整段讓對方知道。兩者可以只填一個。
      </Typography>

      {/*
       * 🔴 **C6 把 `lorebookId` 這個孤兒欄位接起來**（階段八）。
       * 在此之前欄位做好了、prompt 也真的會讀它，但沒有任何地方可以選 ——
       * 對使用者來說等於這個功能不存在（總則四）。
       */}
      <Divider />
      <WorldPicker
        label="我的世界書"
        value={value.lorebookId}
        onChange={(id) => onChange({ ...value, ...(id ? { lorebookId: id } : { lorebookId: '' }) })}
        hint="跟著「你」走的設定，不管跟誰聊天都會生效。選的是某位好友那一本 —— 在那邊改條目，這裡也會跟著變。"
      />

      <Button variant="contained" loading={saving} disabled={!value.name.trim()} onClick={onSave}>
        儲存
      </Button>
    </Stack>
  );
}
