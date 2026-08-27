import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { renderNotes } from '../lib/renderNotes';

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
          {/*
            🔴 **這裡以前是 `whiteSpace: pre-wrap` 直接印原文** —— release notes 是 markdown，
            所以 `##`、`**`、`|` 全部露在畫面上，表格更是一堆直線。
            內容已經在 `renderNotes` 裡淨化過（白名單列舉、只准 http(s) 連結）。
          */}
          <Box
            sx={{
              fontSize: 12,
              lineHeight: 1.7,
              color: 'text.secondary',
              wordBreak: 'break-word',
              // 更新說明是「一段話」，不是一份文件 —— 標題不該比周圍的字大很多
              '& h1, & h2, & h3, & h4': { fontSize: 13, fontWeight: 600, m: '10px 0 4px' },
              '& p': { m: '0 0 6px' },
              '& ul, & ol': { m: '0 0 6px', pl: 2.5 },
              '& li': { mb: 0.25 },
              '& strong': { color: 'text.primary' },
              '& code': {
                fontSize: 11,
                px: 0.5,
                py: 0.125,
                borderRadius: 0.5,
                bgcolor: 'action.hover',
              },
              // 🔴 表格要能橫向捲，否則窄畫面會把整頁撐開（外面是橫幅，撐開特別醜）
              '& table': { display: 'block', overflowX: 'auto', borderCollapse: 'collapse', my: 1 },
              '& th, & td': {
                border: 1,
                borderColor: 'divider',
                px: 1,
                py: 0.5,
                textAlign: 'left',
              },
              '& hr': { border: 0, borderTop: 1, borderColor: 'divider', my: 1 },
              '& a': { color: 'primary.main' },
            }}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: 內容經過 renderNotes 的 DOMPurify 白名單淨化
            dangerouslySetInnerHTML={{ __html: renderNotes(notes) }}
          />
        </AccordionDetails>
      </Accordion>
    </>
  );
}
