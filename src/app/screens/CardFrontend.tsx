import { type CardScriptsView, ScriptFrame } from '@/features/cardscripts';
import { FrontendNotice } from '@/features/chat';

/**
 * 一則訊息裡的「卡片自己的前端區塊」要畫成什麼（M13 第二期）。
 *
 * 🔴 **這一支住 `app/screens/` 不住 `features/chat/`。**
 * `cardscripts/runtime/bridge.ts` 要 import `@/features/chat` 的型別，
 * chat 再 import 回 cardscripts 就是**循環相依**（閘門 A2 會擋，而且擋得對）。
 * ⇒ 決策放在「把兩個 feature 組起來」的這一層，`Thread`／`MessageContent` 只管切段。
 *
 * 🔴 **同意過才真的跑。** 沒同意就是引導卡 ＋ 一顆通往同意視窗的鈕；
 * 而 `cards.ask` 是 `undefined` 時（這張卡根本沒有可同意的程式）連鈕都不畫 ——
 * 一顆點了沒東西的鈕比不能點更糟。
 */
export function CardFrontend({
  cards,
  characterId,
  code,
  index,
}: {
  cards: CardScriptsView;
  characterId: string;
  code: string;
  index: number;
}) {
  if (!cards.enabled) return <FrontendNotice bytes={code.length} onEnable={cards.ask} />;
  return (
    <ScriptFrame
      mode="inline"
      code={code}
      allow={cards.allow}
      name={`card-${characterId}-${index}`}
    />
  );
}
