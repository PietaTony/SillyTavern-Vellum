import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import type { NetworkState } from '../api';
import { NoLoginWarning } from './NoLoginWarning';

/**
 * 「允許其他裝置連線」（Peter 2026-08-27：想用 Tailscale ＋ 手機瀏覽器玩）。
 *
 * 🔴 **這顆開關會把你的全部對話與 API 金鑰放到網路上**，所以文案有三件事不能省：
 *   ① **它不是「只開放給 Tailscale」** —— 綁 `0.0.0.0` 之後同一個 wifi 的人也連得到
 *   ② **遠端連線要有存取密碼** —— 沒設密碼時開關 disabled；設了之後連進來要先登入
 *   ③ **要重啟才生效** —— port 已經綁上去了，中途換介面做不到
 *
 * 🔴 **「設定值」與「實際綁的」要分開顯示。** 只顯示設定值的話，
 * 改完還沒重啟時畫面會說「已開啟」而外面其實連不進來 —— 那是一顆說謊的開關。
 */
const switchDisabled = (
  state: NetworkState | undefined,
  busy: boolean,
  enabled: boolean,
): boolean => busy || state === undefined || state.forcedByEnv || (!enabled && !state.hasPassword);

export function NetworkCard({
  state,
  onToggle,
  busy,
}: {
  state: NetworkState | undefined;
  onToggle: (next: boolean) => void;
  busy: boolean;
}) {
  const enabled = state?.enabled ?? false;
  const live = state !== undefined && state.bound !== '127.0.0.1';
  const pending = state !== undefined && enabled !== live;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
          <Stack sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2">允許其他裝置連線</Typography>
            <Typography variant="body2" color="text.secondary">
              用手機或平板的瀏覽器打開 Vellum（建議搭配 Tailscale）。
            </Typography>
          </Stack>
          <Switch
            checked={enabled}
            disabled={switchDisabled(state, busy, enabled)}
            onChange={(e) => onToggle(e.target.checked)}
            slotProps={{ input: { 'aria-label': '允許其他裝置連線' } }}
          />
        </Stack>

        {/* 🔴 環境變數蓋過設定時，要說得出「這顆開關現在管不到」。 */}
        {state?.forcedByEnv ? (
          <Alert severity="info">
            這台機器用 <code>HOST</code> 環境變數指定了要綁哪裡，<b>這顆開關暫時沒有作用</b>。
            目前綁在 <code>{state.bound}</code>。
          </Alert>
        ) : null}

        {/* 🔴 改完還沒重啟 —— 不可以讓畫面看起來已經生效。 */}
        {pending ? (
          <Alert severity="warning">
            <b>要重新啟動 Vellum 才會生效。</b>
            目前實際上{live ? '仍然開放中' : '只有這台電腦連得到'}。
          </Alert>
        ) : null}

        {/* 🔴 這一段不能省：使用者以為自己只開給了 Tailscale。文案與連進來那台共用。 */}
        <Alert severity={live ? 'warning' : 'info'}>
          <NoLoginWarning hasPassword={Boolean(state?.hasPassword)} />
          <br />
          而且打開之後<b>不只 Tailscale</b>：<b>同一個 wifi 上的人也連得到</b>
          （室友、訪客、被入侵的裝置）。在公共 wifi 上請不要打開。
        </Alert>

        {/*
         * 🔴 **有位址、但沒有 Tailscale 那一條** —— 這是最容易被誤會的狀態
         *（Peter 2026-08-27）：畫面上有網址可以抄，使用者不會發現抄到的是區網那條，
         * 而那條**同一個 wifi 的人都連得到**。舊版只在「一條都沒有」時才說話。
         */}
        {live && state.urls.length > 0 && !state.urls.some((u) => u.kind === 'tailscale') ? (
          <Alert severity="warning">
            <b>找不到 Tailscale 位址 —— 它沒有在這台電腦上跑。</b>
            <br />
            下面只剩區域網路那一條，<b>同一個 wifi 上的人都連得到</b>。
            <Typography variant="body2" component="ol" sx={{ pl: 2.5, m: 0, mt: 1 }}>
              <li>在這台電腦開啟 Tailscale 並登入</li>
              <li>
                手機也裝 Tailscale，登入<b>同一個帳號</b>
              </li>
              <li>回到這一頁重新整理，會多出一條開頭是 100. 的網址</li>
            </Typography>
          </Alert>
        ) : null}

        {live && state.urls.length > 0 ? (
          <Stack spacing={0.5}>
            <Typography variant="body2">在手機的瀏覽器打這個網址：</Typography>
            {state.urls.map((u) => (
              <Typography key={u.url} variant="body2" sx={{ fontFamily: 'vellum.fontMono' }}>
                {u.url}
                <Typography component="span" variant="caption" color="text.secondary">
                  {u.kind === 'tailscale' ? '　← Tailscale（只有你的裝置）' : '　← 區域網路'}
                </Typography>
              </Typography>
            ))}
          </Stack>
        ) : null}

        {live && state.urls.length === 0 ? (
          <Alert severity="warning">
            已經開放，但找不到任何對外的網路位址 —— 這台機器可能沒有連上網路或 Tailscale。
          </Alert>
        ) : null}
      </Stack>
    </Paper>
  );
}
