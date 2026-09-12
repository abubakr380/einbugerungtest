// Public API address only; the D1 binding and account credentials stay server-side.
export const SYNC_API = ['localhost', '127.0.0.1'].includes(globalThis.location?.hostname)
  ? 'http://127.0.0.1:8787'
  : 'https://eintest-progress.abubabakr.workers.dev';
