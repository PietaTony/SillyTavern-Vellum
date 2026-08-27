import { ApiError } from '@/shared/lib/http';

/** 一次「整頁打不開」要對使用者說的三件事。 */
export type AppFailure = {
  /** 發生什麼事。**一句人話**，不是 `Something went wrong`。 */
  title: string;
  /** 現在該做什麼。給不出可靠的下一步就留空 —— 亂猜的建議比沉默更浪費時間。 */
  what: string;
  /** 🔴 **原文一定要留。** 猜錯病因而把上游的訊息丟掉，比多幾個括號糟得多。 */
  detail: string;
  /** 「再試一次」有沒有意義。Vellum 沒回應有；被拒絕、找不到沒有。 */
  retryable: boolean;
};

/**
 * 把一個丟出來的例外翻成畫面上該說的話。
 *
 * 🔴 **文案裡不可以出現「後端」。**（Peter 2026-08-27：「user 的角度並沒有後端的概念，
 * 他們在執行面上是 exe 掛掉了才對」。）打包版裡前端與 API 本來就是**同一支程式**
 *（`server/index.ts` 在 production 會自己端 `dist/`）—— 對使用者來說只有一件事：
 * **Vellum 這個程式還在不在跑**。前端／後端是我們的分工，不是他的世界。
 * ⇒ 講的是「那台電腦上的 Vellum 關掉了或當掉了」，而三位數的狀態碼留在原文那一行給我們看。
 *
 * 🔴 **「沒回應」與「它自己出錯」要分開講。** 5xx（500）＝ Vellum 活著、這件事做壞了
 *（下一步是把原文複製給我們）；502／503／504 與連不上 ＝ 根本沒接到人
 *（下一步是回去看那台電腦）。兩者的下一步完全不同。
 *
 * ⚠️ `fetch` 連不上時丟的是 `TypeError`，訊息是瀏覽器各自的英文
 *（`Failed to fetch`／`Load failed`）——那句話對使用者沒有意義，但**照樣要留在原文裡**。
 */
export function describeFailure(e: unknown): AppFailure {
  if (e instanceof ApiError) return ofApi(e);
  if (e instanceof TypeError) return gone(e.message || String(e));
  if (e instanceof Error)
    return { title: '出了點問題', what: '', detail: e.message || String(e), retryable: true };
  return { title: '出了點問題', what: '', detail: String(e), retryable: true };
}

/**
 * 「Vellum 這個程式不在了」——連不上、或是連到了但沒有人回應，對使用者是同一件事。
 * ⚠️ 這一頁還看得到，是因為它早就載進瀏覽器了；**不要讓他以為程式還活著**。
 */
const gone = (detail: string): AppFailure => ({
  title: 'Vellum 沒有回應',
  what: '跑 Vellum 的那台電腦上，程式可能被關掉或當掉了（也可能是電腦睡著、或 Tailscale／網路斷了）。確認 Vellum 的視窗還開著，再按「再試一次」。',
  detail,
  retryable: true,
});

function ofApi(e: ApiError): AppFailure {
  const detail = e.message;
  if (e.status === 502 || e.status === 503 || e.status === 504) return gone(detail);
  if (e.status >= 500)
    return {
      title: 'Vellum 出錯了',
      // 🔴 這一種**程式還活著**，叫他去重開反而是把他支開。他能做的是把原文交給我們。
      what: 'Vellum 還在跑，是這件事本身出了錯。下面那段原文複製給我們就查得到。',
      detail,
      retryable: true,
    };
  if (e.status === 404)
    return { title: '找不到這個東西', what: '它可能已經被刪掉了。', detail, retryable: false };
  if (e.status === 401 || e.status === 403)
    return { title: '沒有權限', what: '', detail, retryable: false };
  return { title: '這個要求沒有被接受', what: '', detail, retryable: false };
}
