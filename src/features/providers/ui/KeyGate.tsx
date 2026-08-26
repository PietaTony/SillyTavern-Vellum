import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useMachine } from '@xstate/react';
import { useState } from 'react';
import { DraftField } from '@/shared/ui/DraftField';
import { Screen } from '@/shared/ui/Screen';
import { pushToast } from '@/shared/ui/toastStore';
import { keyGateMachine } from '../keyGate.machine';
import { makeTestKeyActor } from '../keyGateActor';
import { applyMaskedEdit, DEFAULT_MODEL_BY_PROVIDER, maskKey, type ProviderInfo } from '../model';
import { keyOkAdornment } from './KeyOk';
import { KeySteps } from './KeySteps';
import { ModelPicker } from './ModelPicker';

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
  // 預設就是 registry 的預設模型；選了會由 `ModelPicker` 自己存下來。
  // 沒選過是 `null`；`ModelPicker` 會用官方清單的第一個當預設。
  const [model, setModel] = useState<string | null>(null);
  const [state, send] = useMachine(
    keyGateMachine.provide({
      actors: { testKey: makeTestKeyActor(info.id, info.consoleUrl) },
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
        {/* 🔴 與設定頁共用同一個元件 —— 同一件事在兩個入口不可以長得不一樣。 */}
        <KeySteps
          providerId={info.id}
          displayName={info.name}
          consoleUrl={info.consoleUrl}
          keyHint={info.keyHint}
        />

        <DraftField
          /**
           * 🔴 **金鑰刻意不存草稿**（規格 24 §4 層四的白名單，白名單一定要寫理由）：
           * 存進 `localStorage` 就是把 API 金鑰寫成明碼、留在磁碟上，而且**任何同源的
           * script 都讀得到** —— 那是把「打到一半掉字」換成一個安全問題，不划算。
           * ⚠️ 這個框顯示的還是 `maskKey()` 的遮罩字串，真值在 machine 的 context 裡，
           * 存進去也只會存到一串圓點，本來就救不回來。
           * 金鑰掉了重貼一次就好 —— 這是少數「掉了不痛」的輸入。
           */
          noDraft="API 金鑰不落地：存明碼到 localStorage 的風險大於重貼一次的成本"
          fullWidth
          label="API 金鑰"
          placeholder={`貼上金鑰（${info.keyHint}）`}
          autoComplete="off"
          spellCheck={false}
          // 🔴 與設定頁共用同一顆勾勾，兩邊不會漂移。
          slotProps={{
            htmlInput: { autoCapitalize: 'none', autoCorrect: 'off' },
            input: keyOkAdornment(passed),
          }}
          // 🔴 **輸入當下就遮罩**，永遠只露前四後四。真值在 machine 的 context 裡。
          value={maskKey(value)}
          onChange={(next) =>
            send({ type: 'CHANGE', value: applyMaskedEdit(value, maskKey(value), next) })
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

        {/*
         * 🔴 **測過就讓他選模型**（Peter 2026-08-26：「兩邊都要新增選擇模型的功能」）。
         * 在此之前這裡只顯示「N 個模型可用」的**數字** —— 使用者看得到有幾個、選不了任何一個，
         * 而 `listModels()` 早就把清單拉回來了。那是孤兒引擎的又一次。
         *
         * 🔴 **不擋「下一步」**：first-run 的核心不變式是「測過金鑰才能走」，
         * 不是「選過模型才能走」。沒選就用預設 —— 多加一道門會讓引導變長。
         */}
        {passed ? (
          <>
            <Alert severity="success">連線成功 —— {state.context.models.length} 個模型可用</Alert>
            <ModelPicker
              provider={info.id}
              chosen={model}
              fallback={DEFAULT_MODEL_BY_PROVIDER[info.id] ?? ''}
              onChange={setModel}
              onNotify={pushToast}
              consoleUrl={info.consoleUrl}
            />
          </>
        ) : null}
        {/* 🔴 失敗訊息走全站 tips（有「開啟」引導與複製鈕）—— 這裡不再另外畫一則。 */}
      </Stack>
    </Screen>
  );
}
