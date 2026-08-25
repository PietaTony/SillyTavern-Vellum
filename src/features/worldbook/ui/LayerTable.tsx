import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { LayerFact } from '../types';

/**
 * 四層的層序與狀態（C4 的上半）。
 *
 * 🔴 **順序就是它們真的被組進 prompt 的順序**（ST `world-info.js:4606-4624`：
 * chat 永遠最前，其次 persona，剩下的照策略）。使用者問「為什麼這條先進場」，
 * 答案就在這張表上。
 *
 * 🔴 **沒接上的層照樣列出來**（規格總則五）。
 * 藏起來會讓人以為我們只有兩層、跟 ST 不一樣；列出來並標「還沒接上」才誠實。
 */
export function LayerTable({ layers }: { layers: LayerFact[] }) {
  return (
    <Stack spacing={1} sx={{ px: 2, py: 1 }}>
      {layers.map((l, i) => (
        <Stack key={l.id} direction="row" sx={{ gap: 1.5, alignItems: 'flex-start' }}>
          <Typography
            variant="caption"
            sx={{ fontVariantNumeric: 'tabular-nums', color: 'text.secondary', pt: 0.25 }}
          >
            {i + 1}
          </Typography>
          <Stack sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {l.label}
              </Typography>
              {l.wired ? null : <Chip size="small" label="還沒接上" />}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {l.note}
            </Typography>
          </Stack>
        </Stack>
      ))}
    </Stack>
  );
}
