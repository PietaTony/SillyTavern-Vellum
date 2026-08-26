import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { isReady, type ProviderInfo } from '../model';

/**
 * 點卡片＝**選取**，不是直接進下一步（F1／`GAP-21`）——
 * 使用者要來得及比較兩家的差別，那正是這張畫面存在的理由。
 * 🔴 徽章**永遠顯示**：「有免費額度」／「需要先儲值」是撞牆警告，藏起來違反「誠實標示差別」。
 *
 * 🔴 **`status: 'planned'` 的不可點，但也不藏**（2026-08-25）。
 * 在此之前 Anthropic 是完全可選的，選了 → 貼金鑰 → 測試連線 → 後端回 400 →
 * machine 停在 `failed` → **「下一步」永遠解不開**。
 * 那比「沒有這個選項」糟得多：使用者不是看到沒有，是**選了、照做了、然後出不去**，
 * 而那條路正是他第一次用這個產品的路徑。
 */
export function ProviderCard({
  info,
  selected,
  onToggle,
}: {
  info: ProviderInfo;
  selected: boolean;
  onToggle: () => void;
}) {
  const ready = isReady(info);
  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: selected ? 'primary.main' : 'divider',
        ...(ready ? {} : { opacity: 0.6 }),
      }}
    >
      <CardActionArea onClick={onToggle} aria-pressed={selected} disabled={!ready}>
        <CardContent>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Typography sx={{ fontWeight: 600 }}>{info.name}</Typography>
            <Chip
              size="small"
              label={ready ? info.badge : '尚未支援'}
              color={ready && info.badgeTone === 'good' ? 'success' : 'default'}
            />
          </Stack>
          {/*
           * 🔴 不可選的那張**要說明為什麼**，而且要說得出「之後會有」。
           * 只是灰掉的話，使用者會以為是自己哪裡沒設定好。
           */}
          {!ready ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Vellum 尚未支援這一家，選了也送不出去，所以先不開放。接上之後這裡就會亮起來。
            </Typography>
          ) : selected ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {info.detail}
            </Typography>
          ) : null}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
