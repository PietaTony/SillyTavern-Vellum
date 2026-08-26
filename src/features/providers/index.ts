/**
 * 這個 feature 對外的門面。
 *
 * 🔴 **只列真的有外部使用者的名字**（Peter 2026-08-26 裁定刪掉死 code，GAP-46）。
 * 在此之前這裡匯出 29 個名字，其中 **14 個外部使用為 0** ——
 * feature 內部本來就走相對路徑 import，barrel 只是讓「誰在用什麼」變得看不出來。
 * ⚠️ 要新增匯出之前先確認**真的有 `src/features/providers/` 以外的檔在用**。
 */
export { fetchKeyStatus } from './api';
export { failureToast } from './failureToast';
export { PROVIDERS, providerById } from './model';
export { byUsefulness } from './popularity';
export { fetchProviderRows, STATUS_COPY, setActiveProvider } from './registryApi';
export { useProviderChoice } from './store';
export { verifyProvider } from './switchActive';
export { KeyGate } from './ui/KeyGate';
export { ProviderCard } from './ui/ProviderCard';
export {
  ProviderDetailPane,
  ProviderStatusChip,
  useProviderRow,
} from './ui/ProviderDetailPane';
export { ProviderListPane } from './ui/ProviderListPane';
export { ProviderListRow } from './ui/ProviderListRow';
export { ProviderSetup } from './ui/ProviderSetup';
export { ProvidersLayer } from './ui/ProvidersLayer';
