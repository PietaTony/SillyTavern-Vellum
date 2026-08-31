import { BackgroundsLayer } from '@/features/backgrounds';
import { CompanionLayer, OutputRulesLayer, VariablesLayer } from '@/features/chat';
import { ChatPersona } from '@/features/persona';
import { ProvidersLayer } from '@/features/providers';
import type { ChatMenuLayer } from './ChatMenuLayer';

/**
 * `ChatMenu.tsx` 的 overlay layer 實際渲染在這裡（原本五個，D1 加「輸出規則」變六個）。
 *
 * 🔴 **純粹是 `gate:file-size` 的搬遷**（E1，2026-08-28）：`ChatMenu.tsx` 頂到 150 行
 * 上限，新增「桌寵」這一項再放不下自己的渲染區塊。行為與搬之前逐字相同——
 * 誰開哪一層、怎麼關，邏輯全部還在 `ChatMenu.tsx`，這裡只管「畫哪一層」。
 */
export function ChatMenuLayers({
  layer,
  close,
  chatId,
  persona,
  onPersonaChanged,
}: {
  layer: ChatMenuLayer | null;
  close: () => void;
  chatId: string;
  persona?: { id?: string | undefined; name?: string | undefined; layer: string } | undefined;
  onPersonaChanged: () => void;
}) {
  return (
    <>
      <ChatPersona
        open={layer === 'persona'}
        onClose={close}
        chatId={chatId}
        persona={persona}
        onChanged={onPersonaChanged}
      />
      <BackgroundsLayer open={layer === 'backgrounds'} onClose={close} chatId={chatId} />
      <ProvidersLayer open={layer === 'providers'} onClose={close} />
      <VariablesLayer open={layer === 'variables'} onClose={close} chatId={chatId} />
      <CompanionLayer open={layer === 'companion'} onClose={close} />
      <OutputRulesLayer open={layer === 'outputRules'} onClose={close} />
    </>
  );
}
