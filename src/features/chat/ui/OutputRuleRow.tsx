import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import IconButton from '@mui/material/IconButton';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Switch from '@mui/material/Switch';
import type { StoredOutputRule } from '../outputRulesApi';

const TARGET_LABEL = { display: '顯示', prompt: '送給模型', both: '兩者皆是' } as const;

/**
 * `OutputRulesLayer` 清單裡的一列。抽出來是 `gate:file-size`
 * （清單容器加了新增／編輯 Dialog／刪除確認之後放不下這段 JSX）。
 */
export function OutputRuleRow({
  rule: r,
  onEdit,
  onDelete,
  onToggle,
  toggling,
}: {
  rule: StoredOutputRule;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  toggling: boolean;
}) {
  return (
    <ListItem
      divider
      secondaryAction={
        <>
          <IconButton edge="end" aria-label={`編輯「${r.name}」`} onClick={onEdit}>
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
          <IconButton edge="end" aria-label={`刪除「${r.name}」`} onClick={onDelete}>
            <DeleteOutlineOutlinedIcon fontSize="small" />
          </IconButton>
          <Switch
            edge="end"
            checked={r.enabled}
            disabled={toggling}
            onChange={onToggle}
            slotProps={{ input: { 'aria-label': `${r.enabled ? '停用' : '啟用'}「${r.name}」` } }}
          />
        </>
      }
    >
      <ListItemText
        primary={r.name || '（未命名）'}
        secondary={`${TARGET_LABEL[r.target]} · ${r.find || '（空）'} → ${r.replace}`}
      />
    </ListItem>
  );
}
