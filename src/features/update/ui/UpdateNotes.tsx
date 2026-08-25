import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';

/**
 * 「這一版做了什麼」—— **人寫的重點，不是 commit 訊息**（設計正本 U-D3）。
 * 依據：更新可能弄壞東西，盲目按的代價太高，而 commit 訊息是寫給開發者看的。
 *
 * 🔴 **破壞性變更單獨標出來，不埋在清單裡。** 埋進去等於沒講。
 */
export function UpdateNotes({ notes, breaking }: { notes: string | null; breaking: boolean }) {
  if (!notes) return null;
  return (
    <>
      {breaking ? (
        <Alert severity="warning" variant="outlined" sx={{ py: 0 }}>
          <Typography variant="caption">
            這一版有<strong>破壞性變更</strong>，更新前先看清楚下面寫了什麼。
          </Typography>
        </Alert>
      ) : null}
      <Accordion disableGutters sx={{ bgcolor: 'transparent', '&::before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0, minHeight: 0 }}>
          <Typography variant="body2">這一版做了什麼</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 0, pt: 0 }}>
          <Typography variant="caption" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {notes}
          </Typography>
        </AccordionDetails>
      </Accordion>
    </>
  );
}
