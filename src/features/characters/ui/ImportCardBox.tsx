import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { readDraft } from '@/shared/lib/draftStore';
import { readImageScaled } from '@/shared/lib/image';
import { DraftField } from '@/shared/ui/DraftField';
import { pushToast } from '@/shared/ui/toastStore';
import { type ImportedCharacter, importCardByUrl, importCardFile } from '../api';

/**
 * 匯入現成的角色卡。**放在加入好友頁最上方**（Peter 指定）。
 *
 * 🔴 **不做衝突判斷**（裁定 D-e）：同一張卡可以加入多次，各自獨立。
 * 貼到已經有的卡＝再長出一個好友，不問「要覆蓋嗎」。
 *
 * ⚠️ 外觀是粗胚，階段八會重做。**現在的判準是「功能真的通」**。
 */
/** 貼進來的網址常常很長（含 query string），打一半被殺掉要救得回來。 */
const URL_DRAFT = 'vellum.draft.import-card.url';

export function ImportCardBox({
  onImported,
  onUseAsAvatar,
  imported = null,
  onReset,
}: {
  onImported: (c: ImportedCharacter) => void;
  /**
   * 🔴 **這一頁已經匯入過的那位。** 有值時「匯入」那顆鈕的意義變成**重設**
   * （Peter 2026-08-26：「要是本地有角色卡，不會重新再下載一個，
   * 而是再次 reset 改過的資料，包含了角色描述等等」）。
   * ⚠️ 再下載一次的話會**再建一個新角色**（每次匯入都是新的 UUID），
   *    使用者只是想把改壞的內容還原，結果多出一位好友。
   */
  imported?: ImportedCharacter | null;
  /** 把表單重設回卡片原本的內容。`imported` 有值時必須給。 */
  onReset?: (() => void) | undefined;
  /** 🔴 **死路要有出口**：不是卡片的圖，就讓它變成頭像，不要只留一句錯誤訊息。 */
  onUseAsAvatar?: ((dataUrl: string) => void) | undefined;
}) {
  // 還原在 initializer 同步做完（`useDraftWriter` 檔頭寫了為什麼不放在 effect）。
  const [url, setUrl] = useState<string>(() => readDraft<string>(URL_DRAFT) ?? '');
  const [lastFile, setLastFile] = useState<File | null>(null);
  const m = useMutation({
    mutationFn: (input: string | ArrayBuffer) =>
      typeof input === 'string' ? importCardByUrl(input) : importCardFile(input),
    onSuccess: (c) => {
      /*
       * 🔴 **成功走 tips，不留橫幅**（Peter 2026-08-26）。
       * 上一版是一條綠色 `Alert` 釘在匯入框下面，**而且不會自己消失** ——
       * 使用者已經看到下面的欄位被填好了，那條橫幅只是把表單往下推。
       * ⚠️ 「匯入完不跳走、也不另外做一張預覽卡」（Peter 2026-08-25）仍然成立：
       *    下面本來就有四個欄位，填進去就好，不要讓同一份資料有兩個長相。
       */
      pushToast({
        severity: 'success',
        text: `已加入「${c.displayName ?? c.name}」，內容已經填在下面`,
      });
      /*
       * 🔴 **匯入成功不清空網址**（Peter 2026-08-26）。
       * 同一張卡常常要加入好幾次（不同的 persona、不同的開場線各開一段），
       * 清掉的話每次都要重貼一次網址。留著 ⇒「匯入」那顆鈕可以直接再按一次。
       * ⚠️ 這也表示 `disabled` 只能看「網址是不是空的」與「正在跑」，
       *    **不可以加上「已經匯入過」** —— 那正是我們要拿掉的行為。
       */
      onImported(c);
    },
  });

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        已經有角色卡？貼上網址或選檔案
      </Typography>
      <Stack direction="row" spacing={1}>
        <DraftField
          draftKey={URL_DRAFT}
          fullWidth
          size="small"
          label="角色卡網址"
          value={url}
          onChange={setUrl}
          placeholder="https://…/角色卡.png"
          disabled={m.isPending}
        />
        {/*
         * 🔴 **本地已經有這張卡 ⇒ 這顆鈕不再下載，改成「重設」。**
         * 判準是「這一頁匯入過了沒」，不是「網址一不一樣」——
         * 使用者按第二次的意圖是「把我改壞的還原」，不是「再加一個」。
         */}
        <Button
          variant="contained"
          loading={m.isPending}
          disabled={imported ? false : url.trim() === ''}
          onClick={() => (imported ? onReset?.() : m.mutate(url.trim()))}
        >
          {imported ? '重設' : '匯入'}
        </Button>
      </Stack>
      <Button component="label" size="small" sx={{ mt: 1 }} disabled={m.isPending}>
        或選擇檔案（.png）
        <input
          hidden
          type="file"
          accept="image/png"
          aria-label="選擇角色卡檔案"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setLastFile(f);
            void f.arrayBuffer().then((b) => m.mutate(b));
          }}
        />
      </Button>
      {m.isError ? (
        <Alert
          severity="warning"
          sx={{ mt: 1 }}
          action={
            // 🔴 不是卡片的圖 ≠ 這條路走不下去。**把它接到「自己建角色」那條路上。**
            lastFile && onUseAsAvatar ? (
              <Button
                size="small"
                onClick={() => {
                  void readImageScaled(lastFile).then((dataUrl) => {
                    onUseAsAvatar(dataUrl);
                    m.reset();
                  });
                }}
              >
                改用這張圖當頭像
              </Button>
            ) : null
          }
        >
          {m.error instanceof Error ? m.error.message : '匯入失敗'}
        </Alert>
      ) : null}
    </Paper>
  );
}
