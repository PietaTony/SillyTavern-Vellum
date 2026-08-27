import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useState } from 'react';
import { failureOf } from '@/features/chat';
import { ProvidersLayer } from '@/features/providers';

/**
 * 「這一輪沒有生成成功」那條橫幅。
 *
 * 🔴 **顯示的是人話，不是 JSON**（Peter 2026-08-27 實機踩到）。
 * 他看到的原文是 `{"error":"尚未設定 Google Gemini 金鑰","action":"setup-…` ——
 * 後端回的是 `c.json({ error, action })`，而串流層在 `!res.ok` 時
 * 把整個 body 原封端上來。解析交給 `failureOf()`（純函式，測得到）。
 *
 * 🔴 **出口要對得上錯誤。** 舊版只有一顆「重新送出上一句」，
 * 而且**它根本沒有重送，只是把橫幅關掉**（上一版的檔頭自己招了，也列給了 Peter）。
 * 缺金鑰的時候再送一百次都是同一個錯 —— 現在缺什麼就給什麼：
 * `action: 'setup-key'` ⇒ 直接開供應商設定層。
 *
 * 🔴 **原地開全螢層，不換路由**（Peter 2026-08-26 對 ☰ 的裁定：關掉回到對話原位）。
 * 導去 `/settings/providers` 會把人帶離這段對話，而他只是要補一把金鑰就回來。
 *
 * 🔴 **按鈕擺在文字下面，不放 `Alert` 的 `action` 欄。**
 * `action` 是右側固定欄，訊息一長就把它擠成兩行、再擠出容器
 * —— Peter 那張截圖上「重新送出／上一句」就是這樣斷成兩截、疊到輸入框上的。
 */
export function ChatFailure({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const [setup, setSetup] = useState(false);
  const f = failureOf(message);

  return (
    <>
      <Alert severity="warning" square sx={{ borderTop: 1, borderColor: 'divider' }}>
        這一輪沒有生成成功：{f.text}
        <Stack direction="row" sx={{ gap: 1, mt: 1, flexWrap: 'wrap' }}>
          {f.setupKey ? (
            <Button size="small" variant="contained" onClick={() => setSetup(true)}>
              去設定金鑰
            </Button>
          ) : null}
          {/* 🔴 名字要與行為一致 —— 它就是把橫幅關掉，不要再叫「重新送出」。 */}
          <Button size="small" onClick={onDismiss}>
            知道了
          </Button>
        </Stack>
      </Alert>
      {/*
       * 關掉設定層時順手收掉橫幅：他要嘛補好了金鑰、要嘛決定先不補，
       * 兩種情況這條「上一輪失敗了」都已經看過了。
       */}
      <ProvidersLayer
        open={setup}
        onClose={() => {
          setSetup(false);
          onDismiss();
        }}
      />
    </>
  );
}
