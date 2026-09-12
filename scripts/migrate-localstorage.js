import { cleanProgress, emptyDocument } from '../progress-model.js';

// Runs on the existing origin, including the installed iPhone app. Never deletes
// the v1 key. A durable backup is written before the v2 document can be uploaded.
export function migrateLocalStorage(storage) {
  const existing = storage.getItem('eintest_progress_v2:guest');
  if (existing) return JSON.parse(existing);
  const raw = storage.getItem('eintest_progress');
  const doc = emptyDocument();
  if (raw) {
    if (!storage.getItem('eintest_progress_v1_backup')) storage.setItem('eintest_progress_v1_backup', raw);
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('Lokale Daten konnten nicht gelesen werden. Das Original bleibt erhalten.');
    doc.legacy = cleanProgress(saved);
  }
  storage.setItem('eintest_progress_v2:guest', JSON.stringify(doc));
  return doc;
}
