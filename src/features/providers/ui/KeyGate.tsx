import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useMachine } from '@xstate/react';
import { fromPromise } from 'xstate';
import { Screen } from '@/shared/ui/Screen';
import { testKey } from '../api';
import { keyGateMachine, type TestOutcome } from '../keyGate.machine';
import { applyMaskedEdit, maskKey, type ProviderInfo } from '../model';

/**
 * 取得金鑰 —— 四個狀態（空白／已貼上／失敗／成功）共用一份版面。
 *
 * 🔴 不變式：**未測試成功，「下一步」永遠停用**，由 machine 保證，不是靠 UI 自律。
 * X2：打供應商的動作用 `fromPromise` 從外面注入，machine 本身不知道 api 存在。
 */
export function KeyGate({
  info,
  onBack,
  onPassed,
}: {
  info: ProviderInfo;
  onBack: () => void;
  onPassed: () => void;
}) {
  const [state, send] = useMachine(
    keyGateMachine.provide({
      actors: {
        testKey: fromPromise<TestOutcome, { value: string }>(async ({ input }) => {
          const r = await testKey(info.id, input.value);
          return r.ok ? { ok: true, models: r.models } : { ok: false, message: r.message };
        }),
      },
    }),
    { input: { provider: info.id } },
  );

  const testing = state.matches('testing');
  const passed = state.matches('passed');
  const { value } = state.context;

  return (
    <Screen
      title={`取得 ${info.name} 金鑰`}
      onBack={onBack}
      footer={
        <Box sx={{ flex: 'none', p: 2, borderTop: 1, borderColor: 'divider' }}>
          {!passed ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              測試成功之前，「下一步」是停用的。
            </Typography>
          ) : null}
          <Button fullWidth variant="contained" size="large" disabled={!passed} onClick={onPassed}>
            下一步 → 加入好友
          </Button>
        </Box>
      }
    >
      <Stack spacing={2}>
        <Stack component="ol" spacing={1} sx={{ pl: 2.5, m: 0 }}>
          {info.steps.map((s, i) => (
            <Typography component="li" variant="body2" key={s}>
              {s}
              {i === 0 ? (
                <Button size="small" href={info.consoleUrl} target="_blank" rel="noreferrer">
                  開啟
                </Button>
              ) : null}
            </Typography>
          ))}
        </Stack>

        <TextField
          fullWidth
          label="API 金鑰"
          placeholder={`貼上金鑰（${info.keyHint}）`}
          autoComplete="off"
          spellCheck={false}
          slotProps={{ htmlInput: { autoCapitalize: 'none', autoCorrect: 'off' } }}
          // 🔴 **輸入當下就遮罩**，永遠只露前四後四。真值在 machine 的 context 裡。
          value={maskKey(value)}
          onChange={(e) =>
            send({ type: 'CHANGE', value: applyMaskedEdit(value, maskKey(value), e.target.value) })
          }
        />

        <Button
          variant="outlined"
          loading={testing}
          disabled={!value.trim()}
          onClick={() => send({ type: 'TEST' })}
        >
          測試連線
        </Button>

        {passed ? (
          <Alert severity="success">連線成功 —— {state.context.models.length} 個模型可用</Alert>
        ) : null}
        {state.matches('failed') ? (
          <Alert severity="warning">測試沒有通過：{state.context.error}</Alert>
        ) : null}
      </Stack>
    </Screen>
  );
}
