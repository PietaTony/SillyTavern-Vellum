import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ProviderInfo } from '../model';

/**
 * 點卡片＝**選取**，不是直接進下一步（F1／`GAP-21`）——
 * 使用者要來得及比較兩家的差別，那正是這張畫面存在的理由。
 * 🔴 徽章**永遠顯示**：「有免費額度」／「需要先儲值」是撞牆警告，藏起來違反「誠實標示差別」。
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
  return (
    <Card variant="outlined" sx={{ borderColor: selected ? 'primary.main' : 'divider' }}>
      <CardActionArea onClick={onToggle} aria-pressed={selected}>
        <CardContent>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Typography sx={{ fontWeight: 600 }}>{info.name}</Typography>
            <Chip
              size="small"
              label={info.badge}
              color={info.badgeTone === 'good' ? 'success' : 'default'}
            />
          </Stack>
          {selected ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {info.detail}
            </Typography>
          ) : null}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
