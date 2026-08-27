import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useMutation } from '@tanstack/react-query';
import { readImageScaled, toDataUrl } from '@/shared/lib/image';
import { DraftField } from '@/shared/ui/DraftField';
import { pushToast } from '@/shared/ui/toastStore';
import { draftFromImage } from '../api';
import type { Draft } from '../model';

/**
 * D20b：表單只留 頭像・名稱・描述・初始訊息。
 * 🔴 「透過圖片自動生成內容」是**新功能，ST 沒有**（實查 202 個檔零命中）。
 *
 * 🔴 **草稿不住在這裡**，住在畫面層 —— 因為送出鈕釘在 footer、不在捲動區內，
 * 兩邊要看同一份值。
 */
/** 🔴 還原在 `AddFriendScreen`（父層）做 —— 三個欄位各自在 effect 裡還原會互相蓋掉。 */
export const ADD_FRIEND_DRAFT = 'vellum.draft.add-friend.';

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
  /*
   * 🔴 **生成失敗走 tips，不佔版面**（Peter 2026-08-26）。
   * 上一版是一條 `Alert` 橫幅釘在按鈕下面 —— 它會把下面兩欄往下推，
   * 而使用者的下一步其實是「換一張圖再按一次」，橫幅擋在中間反而礙事。
   */
  const gen = useMutation({
    // 🔴 **先轉成 data URL** —— 匯入的角色頭像是一個路徑，直接送過去會被擋（見 `toDataUrl`）。
    mutationFn: async (src: string) => draftFromImage(await toDataUrl(src), 'character'),
    onError: (e: Error) => pushToast({ severity: 'warning', text: `生成失敗：${e.message}` }),
    onSuccess: (r) =>
      setDraft({
        ...draft,
        name: r.name,
        description: r.description,
        firstMessage: r.firstMessage,
      }),
  });

  const set = (k: keyof Draft) => (next: string) => setDraft({ ...draft, [k]: next });

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
        <DraftField
          draftKey={`${ADD_FRIEND_DRAFT}name`}
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
        disabled={!draft.avatar}
        onClick={() => gen.mutate(draft.avatar)}
      >
        透過圖片自動生成內容
      </Button>
      {imported ? (
        <Typography variant="caption" color="text.secondary">
          {/*
           * 🔴 **匯入的卡也可以用圖片生成**（Peter 2026-08-26）。
           * 上一版是把按鈕停用掉，理由是「會蓋掉卡片原本的內容」——
           * 但那是**使用者的選擇**，不是我們該替他做的決定。
           * ⇒ 改成照做但講清楚，並且旁邊就有「重設回卡片內容」可以反悔。
           */}
          這是匯入的角色卡 —— 用 AI 生成會蓋掉卡片原本的內容，要還原按上面的「重設」。
        </Typography>
      ) : null}

      <DraftField
        draftKey={`${ADD_FRIEND_DRAFT}description`}
        fullWidth
        multiline
        minRows={3}
        label="角色描述"
        value={draft.description}
        onChange={set('description')}
        placeholder="在此描述角色的身體和心理特徵。"
      />
      <DraftField
        draftKey={`${ADD_FRIEND_DRAFT}firstMessage`}
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
