import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useMutation } from '@tanstack/react-query';
import { readImageScaled } from '@/shared/lib/image';
import { draftFromImage } from '../api';
import type { Draft } from '../model';

/**
 * D20b：表單只留 頭像・名稱・描述・初始訊息。
 * 🔴 「透過圖片自動生成內容」是**新功能，ST 沒有**（實查 202 個檔零命中）。
 *
 * 🔴 **草稿不住在這裡**，住在畫面層 —— 因為送出鈕釘在 footer、不在捲動區內，
 * 兩邊要看同一份值。
 */
export function AddFriendForm({
  draft,
  setDraft,
  imported = false,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  /**
   * 🔴 匯入的卡片**本來就有內容**，「透過圖片自動生成」會把它蓋掉。
   * 這種按鈕不該只是「按了會壞」——直接關掉，並說明原因（Peter 2026-08-25）。
   */
  imported?: boolean;
}) {
  const gen = useMutation({
    mutationFn: (dataUrl: string) => draftFromImage(dataUrl),
    onSuccess: (r) =>
      setDraft({
        ...draft,
        name: r.name,
        description: r.description,
        firstMessage: r.firstMessage,
      }),
  });

  const set = (k: keyof Draft) => (e: { target: { value: string } }) =>
    setDraft({ ...draft, [k]: e.target.value });

  async function pickImage(file: File | undefined) {
    if (!file) return;
    const avatar = await readImageScaled(file);
    setDraft({ ...draft, avatar });
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <Button component="label" sx={{ p: 0, borderRadius: '50%', minWidth: 0 }}>
          <Avatar src={draft.avatar || undefined} sx={{ width: 64, height: 64 }}>
            頭像
          </Avatar>
          <input
            hidden
            type="file"
            accept="image/*"
            aria-label="上傳角色頭像"
            onChange={(e) => void pickImage(e.target.files?.[0])}
          />
        </Button>
        <TextField
          fullWidth
          size="small"
          label="角色名稱"
          value={draft.name}
          onChange={set('name')}
          placeholder="為此角色命名"
        />
      </Stack>

      <Button
        variant="outlined"
        size="small"
        loading={gen.isPending}
        disabled={imported || !draft.avatar}
        onClick={() => gen.mutate(draft.avatar)}
      >
        透過圖片自動生成內容
      </Button>
      {imported ? (
        <Typography variant="caption" color="text.secondary">
          這是匯入的角色卡，內容已經有了 —— 用 AI 生成會把卡片原本的內容蓋掉。
        </Typography>
      ) : !draft.avatar ? (
        <Typography variant="caption" color="text.secondary">
          先放一張圖，就能請 AI 幫你把下面兩欄填好。
        </Typography>
      ) : null}
      {gen.isError ? (
        <Alert
          severity="warning"
          action={
            <Button size="small" onClick={() => gen.reset()}>
              再試一次
            </Button>
          }
        >
          生成失敗：{gen.error instanceof Error ? gen.error.message : '未知錯誤'}
        </Alert>
      ) : null}

      <TextField
        fullWidth
        multiline
        minRows={3}
        label="角色描述"
        value={draft.description}
        onChange={set('description')}
        placeholder="在此描述角色的身體和心理特徵。"
      />
      <TextField
        fullWidth
        multiline
        minRows={3}
        label="初始訊息"
        value={draft.firstMessage}
        onChange={set('firstMessage')}
        placeholder="這將是每次聊天開始時角色傳送的第一則訊息。"
      />
    </Stack>
  );
}
