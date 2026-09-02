import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { FullScreenLayer } from '@/shared/ui/FullScreenLayer';
import { HistoryBudgetSection } from './HistoryBudgetSection';
import { MaxResponseSection } from './MaxResponseSection';

/**
 * A2/GAP-37 ＋ B5（跨層票 2026-08-31，Peter 已簽）：兩個「送出去／收回來各自多大」
 * 的設定並排在同一層。
 *
 * 🔴 **這是甲乙兩案的決定，選了甲**（同一個設定畫面裡的兩個項目，不是兩個獨立
 * 的選單入口）——原因：
 * ① **這兩個概念方向相反、極容易混淆**：歷史上限管**送出去**的對話歷史有多大，
 *    回應上限管**模型回來**的一則多長。分成兩個各自獨立、長得一樣的選單項目
 *    （兩顆滑桿、兩句「上限」）時，使用者只會記得「有一個地方可以調大小」，
 *    分不出調的是哪一頭——並排在同一畫面、各自標「送出」／「收到」，
 *    使用者一次看得到兩者的關係，不必自己在腦中拼兩個入口。
 * ② **兩者會互相影響**（見 `maxResponseTokens.ts` 檔頭）：回應上限調很大、
 *    歷史上限卻留得很緊，單輪仍可能湊不下——並排呈現才講得出這句話，
 *    分成兩層各自為政的話，這句提醒不知道該放在哪一邊。
 * ③ **ST 也是並排**（`index.html:635-654`，"Context Size (tokens)" 緊接著
 *    "Max Response Length (tokens)"，同一個 `#pro-settings-block`）——但 ST 兩個都是
 *    裸滑桿／裸輸入框，沒有任何文字說明兩者的關係。這裡贏過 ST 的地方不是
 *    「分開」，是同樣並排、但把①②兩件事寫清楚。
 *
 * 🔴 **檔案本身很薄**：兩段內容各自抽成 `HistoryBudgetSection.tsx`／
 * `MaxResponseSection.tsx`（各自管自己的 `useQuery`／`useMutation`／文案），
 * 這支只負責外層 `FullScreenLayer`＋標題＋把兩段隔開的說明句——理由是
 * `gate:file-size`：兩段文案＋兩份 useQuery 邏輯全部塞進一支會爆表。
 *
 * 🔴 **只在 `open` 時才 render 兩段**（不是 `FullScreenLayer` 內部的 Dialog
 * `open`）：這支元件本身在設定頁一直掛著（`open` 只是切換要不要顯示），
 * 兩段各自的 `useQuery` 沒有 `enabled` 開關，得由這裡負責「還沒打開就不要打」，
 * 不然使用者一進設定頁就先打兩支不會用到的 API。
 */
export function LengthLimitsLayer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <FullScreenLayer open={open} title="長度與上限" onClose={onClose}>
      {open ? (
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            這裡有兩個方向相反的設定：一個管<b>送出去</b>給 AI 的對話歷史有多大， 一個管 AI{' '}
            <b>回來</b>的一則最多多長。
          </Typography>
          <HistoryBudgetSection />
          <Divider />
          <MaxResponseSection />
        </Stack>
      ) : null}
    </FullScreenLayer>
  );
}
