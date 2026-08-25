import TextField, { type TextFieldProps } from '@mui/material/TextField';
import { useEffect } from 'react';
import { useDraftWriter } from '@/shared/lib/useDraftWriter';

/**
 * **所有文字輸入的唯一入口。** 包住 MUI 的 `TextField`，自帶草稿保護。
 *
 * 🔴 為什麼是元件不是 hook：現況正是「`useDraft` 存在，但 8 個輸入點裡 4 個沒接上」。
 * **要記得的東西一定會漏**，而階段八還有 17 個頁面要做（entry 編輯一頁就五個欄位）。
 * ⇒ 把判準交給 `gate:draft`：沒經過這個元件的 `TextField` 直接 FAIL。
 *
 * 🔴 **還原不在這裡**，在父層的 `useState` initializer 用 `readDraft()` 同步做完。
 * 理由見 `useDraftWriter` 檔頭：兩個欄位在 mount effect 裡各自還原會互相蓋掉。
 *
 * 不需要草稿的欄位用 `noDraft="理由"`——**白名單一定要寫理由**（規格 §4 層四）。
 */
type Base = Omit<TextFieldProps, 'value' | 'onChange'> & {
  value: string;
  onChange: (next: string) => void;
};

export type DraftFieldProps = Base &
  (
    | { draftKey: string; noDraft?: never }
    /** 刻意不存草稿。字串是理由，會被人讀到，不是拿來關閘門用的旗標。 */
    | { draftKey?: never; noDraft: string }
  );

export function DraftField({ value, onChange, draftKey, noDraft, ...rest }: DraftFieldProps) {
  const w = useDraftWriter(draftKey ?? null);

  // 父層把值換掉（AI 生成填入、後端載回）時要跟上，否則 ref 停在舊值。
  useEffect(() => w.sync(value), [value, w]);

  return (
    <TextField
      {...rest}
      value={value}
      onChange={(e) => {
        w.onInput(e.target.value);
        onChange(e.target.value);
      }}
      onCompositionStart={() => w.onCompositionStart()}
      onCompositionEnd={(e) => w.onCompositionEnd((e.target as HTMLInputElement).value)}
      onBlur={(e) => {
        w.flush();
        rest.onBlur?.(e);
      }}
      // `noDraft` 是給人看的理由，不進 DOM——但留在 data 屬性讓閘門與 devtools 都看得到。
      {...(noDraft ? { 'data-no-draft': noDraft } : {})}
    />
  );
}
