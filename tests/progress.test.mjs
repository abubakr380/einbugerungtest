import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { emptyDocument, mergeDocuments, summarize, recordAnswer, recordExam, cleanDocument, normalizeUsername } from '../progress-model.js';
import { ProgressStore } from '../progress-store.js';
import { migrateLocalStorage } from '../scripts/migrate-localstorage.js';
const a = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', b = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const legacy = { version: 1, mastered: ['260'], incorrect: { '28': 2 }, totals: { answered: 5, correct: 3, wrong: 2 }, streaks: { current: 2, best: 3 }, examHistory: [{ date: '2026-07-01T12:00:00Z', score: 28, total: 33, passed: true }] };
class Storage {
  constructor(initial = {}) { this.data = new Map(Object.entries(initial)); }
  getItem(key) { return this.data.get(key) || null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}
const stop = store => clearTimeout(store.timer);
const response = progress => new Response(JSON.stringify({ progress }), { headers: { 'Content-Type': 'application/json' } });

test('migration preserves the original, every statistic, and is idempotent', () => {
  const storage = new Storage({ eintest_progress: JSON.stringify(legacy) });
  const first = migrateLocalStorage(storage), second = migrateLocalStorage(storage);
  assert.deepEqual(first, second);
  assert.equal(storage.getItem('eintest_progress_v1_backup'), storage.getItem('eintest_progress'));
  assert.deepEqual(summarize(first).totals, legacy.totals);
  assert.deepEqual(summarize(first).mastered, ['260']);
  assert.equal(summarize(first).examHistory.length, 1);
});
test('malformed legacy data is preserved, with no successful migration marker', () => {
  const storage = new Storage({ eintest_progress: '{broken' });
  assert.throws(() => migrateLocalStorage(storage));
  assert.equal(storage.getItem('eintest_progress'), '{broken');
  assert.equal(storage.getItem('eintest_progress_v1_backup'), '{broken');
  assert.equal(storage.getItem('eintest_progress_v2:guest'), null);
});
test('independent devices merge, retries are idempotent, stale replies preserve new answers', () => {
  const first = recordAnswer(emptyDocument(), a, '260', true, 1);
  const second = recordAnswer(emptyDocument(), b, '28', false, 2);
  const merged = mergeDocuments(first, second);
  assert.deepEqual(summarize(merged).totals, { answered: 2, correct: 1, wrong: 1 });
  assert.deepEqual(mergeDocuments(merged, first), merged);
  assert.deepEqual(mergeDocuments(first, second), mergeDocuments(second, first));
  const newer = recordAnswer(merged, a, '42', true, 3);
  assert.equal(summarize(mergeDocuments(newer, merged)).totals.answered, 3);
});
test('conflicting same-timestamp snapshots merge deterministically', () => {
  const left = recordAnswer(emptyDocument(), a, '1', true, 10);
  const right = recordAnswer(emptyDocument(), a, '2', false, 10);
  assert.deepEqual(mergeDocuments(left, right), mergeDocuments(right, left));
});
test('copied legacy data is not added twice across devices', () => {
  const doc = migrateLocalStorage(new Storage({ eintest_progress: JSON.stringify(legacy) }));
  const merged = mergeDocuments(recordAnswer(doc, a, '1', true, 1), recordAnswer(doc, b, '2', true, 2));
  assert.equal(summarize(merged).totals.answered, 7);
  assert.equal(summarize(merged).examHistory.length, 1);
});
test('reset generations reject old offline data and allow fresh practice', () => {
  const old = recordAnswer(emptyDocument(), a, '1', true, 1);
  const reset = emptyDocument(1);
  assert.equal(summarize(mergeDocuments(old, reset)).totals.answered, 0);
  const fresh = recordAnswer(reset, b, '260', true, 2);
  assert.equal(summarize(mergeDocuments(fresh, old)).totals.answered, 1);
});
test('exam history is deduplicated, validated and capped', () => {
  let doc = emptyDocument();
  for (let i = 1; i <= 24; i++) doc = recordExam(doc, a, { id: `test-${i}`, date: `2026-08-${String(i).padStart(2, '0')}T12:00:00Z`, score: 20, total: 33 });
  assert.equal(summarize(mergeDocuments(doc, doc)).examHistory.length, 20);
  assert.equal(summarize(doc).examHistory[0].id, 'test-24');
});
test('usernames normalize and invalid input is rejected', () => {
  assert.equal(normalizeUsername('  My-Name_12 '), 'my-name_12');
  for (const value of ['', 'ab', '../bob', '<script>', '__proto__', 'x'.repeat(33)]) assert.throws(() => normalizeUsername(value));
  assert.throws(() => cleanDocument({ version: 2, generation: 0, devices: { invalid: {} } }));
});
test('first connection migrates locally, name switching keeps profiles isolated', async () => {
  const remote = new Map();
  const storage = new Storage({ eintest_progress: JSON.stringify(legacy) });
  const store = new ProgressStore({ storage, uuid: () => a, api: 'https://example.test', fetcher: async (url, options) => {
    const name = url.split('/').at(-1), merged = mergeDocuments(remote.get(name) || emptyDocument(), JSON.parse(options.body));
    remote.set(name, merged); return response(merged);
  } });
  await store.connect('Alice');
  assert.equal(store.summary().totals.answered, 5);
  await store.connect('Bobby');
  assert.equal(store.summary().totals.answered, 0);
  await store.answer('1', true); stop(store);
  await store.connect('Alice');
  assert.equal(store.summary().totals.answered, 5);
  await store.connect('guest');
  assert.equal(store.summary().totals.answered, 0, 'a user named guest must not access local guest storage');
  stop(store);
});
test('offline connection persists its username and queued answers, then retries without duplicates', async () => {
  const storage = new Storage(); let online = false, remote = emptyDocument();
  const store = new ProgressStore({ storage, uuid: () => a, api: 'https://example.test', fetcher: async (url, options) => {
    if (!online) throw new TypeError('Offline');
    remote = mergeDocuments(remote, JSON.parse(options.body)); return response(remote);
  } });
  await store.answer('260', true);
  await store.connect('Alice'); stop(store);
  assert.equal(storage.getItem('eintest_username'), 'alice');
  await store.answer('42', false); stop(store);
  online = true;
  await store.sync(); await store.sync(); stop(store);
  assert.equal(summarize(remote).totals.answered, 2);
});
test('an answer made while sync is pending survives the older response', async () => {
  let finish;
  const storage = new Storage({ eintest_username: 'alice' });
  const store = new ProgressStore({ storage, uuid: () => a, api: 'https://example.test', fetcher: async (url, options) => new Promise(resolve => { finish = () => resolve(response(JSON.parse(options.body))); }) });
  await store.answer('1', true); stop(store);
  const syncing = store.sync();
  await new Promise(resolve => setTimeout(resolve, 0));
  await store.answer('2', false); stop(store);
  finish(); await syncing; stop(store);
  assert.equal(store.summary().totals.answered, 2);
});
test('in-flight response cannot overwrite a switched profile', async () => {
  let finish;
  const storage = new Storage({ eintest_username: 'alice' });
  const store = new ProgressStore({ storage, uuid: () => a, api: 'https://example.test', fetcher: async (url, options) => new Promise(resolve => { finish = () => resolve(response(JSON.parse(options.body))); }) });
  await store.answer('1', true); stop(store);
  const syncing = store.sync(); await new Promise(resolve => setTimeout(resolve, 0));
  await store.connect('Bobby'); stop(store);
  finish(); await syncing; stop(store);
  assert.equal(store.name, 'bobby'); assert.equal(store.summary().totals.answered, 0);
  assert.equal(summarize(store.read('alice')).totals.answered, 1);
});
test('quota failure keeps progress in memory and reports the local save failure', async () => {
  const storage = new Storage();
  const store = new ProgressStore({ storage, uuid: () => webcrypto.randomUUID() });
  storage.setItem = () => { throw new Error('Quota exceeded'); };
  await store.answer('260', true);
  assert.equal(store.summary().totals.answered, 1); assert.match(store.storageError, /Backup/);
});
