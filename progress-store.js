import { cleanDocument, emptyDocument, mergeDocuments, normalizeUsername, recordAnswer, recordExam, summarize } from './progress-model.js';
import { migrateLocalStorage } from './scripts/migrate-localstorage.js';

export class ProgressStore {
  constructor({ storage, api = '', fetcher = (...args) => fetch(...args), onChange = () => {}, onStatus = () => {}, locks = globalThis.navigator?.locks, uuid = () => crypto.randomUUID() }) {
    Object.assign(this, { storage, api, fetcher, onChange, onStatus, locks, uuid });
    this.name = ''; this.doc = emptyDocument(); this.status = 'local'; this.retryDelay = 5000;
    try {
      this.deviceId = storage.getItem('eintest_device_id') || uuid();
      storage.setItem('eintest_device_id', this.deviceId);
      migrateLocalStorage(storage);
      const name = storage.getItem('eintest_username');
      if (name) this.name = normalizeUsername(name);
      this.doc = this.read(this.name);
    } catch (error) { this.storageError = error.message; }
    this.deviceId ||= uuid();
  }
  key(name = this.name) { return `eintest_progress_v2:${name ? `user:${name}` : 'guest'}`; }
  read(name = this.name) {
    const value = this.storage.getItem(this.key(name));
    return value ? cleanDocument(JSON.parse(value)) : emptyDocument();
  }
  setStatus(status, message = '') { this.status = status; this.onStatus(status, message); }
  lock(action) { return this.locks ? this.locks.request('eintest-progress', action) : Promise.resolve().then(action); }
  persist(name = this.name, doc = this.doc) {
    try { this.storage.setItem(this.key(name), JSON.stringify(doc)); this.storageError = ''; }
    catch { this.storageError = 'Speichern auf diesem Gerät nicht möglich. Bitte ein Backup exportieren.'; this.setStatus('error', this.storageError); }
  }
  summary() {
    const p = summarize(this.doc);
    return { ...p, mastered: new Set(p.mastered), incorrect: new Map(Object.entries(p.incorrect)) };
  }
  async mutate(change) {
    await this.lock(() => {
      try { this.doc = mergeDocuments(this.doc, this.read()); } catch { /* Keep the in-memory copy if storage is unavailable. */ }
      this.doc = change(this.doc);
      this.persist(); this.onChange();
    });
    this.schedule();
  }
  answer(id, correct) { return this.mutate(doc => recordAnswer(doc, this.deviceId, id, correct)); }
  exam(exam) { return this.mutate(doc => recordExam(doc, this.deviceId, { ...exam, id: this.uuid() })); }
  reset() { return this.mutate(doc => emptyDocument(doc.generation + 1)); }
  async connect(value, importGuest = true) {
    const name = normalizeUsername(value);
    await this.lock(() => {
      let next = this.read(name);
      // Each local history can belong to one name only. Switching names never
      // carries another person's history into the new profile.
      const owner = this.storage.getItem('eintest_guest_owner');
      if (!this.name && importGuest && (!owner || owner === name)) {
        next = mergeDocuments(next, mergeDocuments(this.doc, this.read('')));
        this.storage.setItem(this.key(name), JSON.stringify(next));
        this.storage.setItem('eintest_guest_owner', name);
      }
      this.storage.setItem('eintest_username', name);
      this.name = name; this.doc = next; this.persist(); this.onChange();
    });
    await this.sync();
  }
  async disconnect() {
    clearTimeout(this.timer);
    await this.lock(() => {
      this.storage.removeItem('eintest_username');
      this.name = ''; this.doc = this.read(''); this.onChange();
    });
    this.setStatus('local');
  }
  schedule(delay = 1200) {
    if (!this.name) return;
    clearTimeout(this.timer);
    this.setStatus('pending');
    this.timer = setTimeout(() => { void this.sync(); }, delay);
  }
  async sync() {
    clearTimeout(this.timer);
    if (!this.name) { this.setStatus('local'); return false; }
    if (!this.api) { this.setStatus('error', 'Synchronisierung ist noch nicht eingerichtet.'); return false; }
    if (this.inFlight) { this.schedule(1500); return false; }
    const name = this.name;
    let sent;
    await this.lock(() => {
      try { this.doc = mergeDocuments(this.doc, this.read()); } catch { /* Retry remote save even if local storage is full. */ }
      sent = cleanDocument(this.doc);
    });
    this.inFlight = true;
    this.setStatus('syncing');
    const abort = new AbortController(), timeout = setTimeout(() => abort.abort(), 12000);
    try {
      const response = await this.fetcher(`${this.api}/api/progress/${encodeURIComponent(name)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sent), signal: abort.signal, cache: 'no-store'
      });
      if (!response.ok) throw new Error(response.status === 413 ? 'Das Profil ist zu groß. Bitte ein Backup exportieren.' : 'Verbindung fehlgeschlagen. Fortschritt bleibt lokal gespeichert.');
      const remote = cleanDocument((await response.json()).progress);
      let again = false;
      await this.lock(() => {
        let local = this.name === name ? this.doc : sent;
        try { local = mergeDocuments(local, this.read(name)); } catch { /* Preserve memory on storage failure. */ }
        const merged = mergeDocuments(local, remote);
        this.persist(name, merged);
        if (this.name === name) {
          this.doc = merged; this.onChange();
          again = JSON.stringify(merged) !== JSON.stringify(remote);
        }
      });
      this.retryDelay = 5000;
      if (this.name === name) {
        this.setStatus(this.storageError ? 'error' : 'synced', this.storageError || '');
        if (again) this.schedule();
      }
      return true;
    } catch (error) {
      if (this.name === name) {
        this.setStatus('error', error.name === 'AbortError' ? 'Offline oder Zeitüberschreitung. Fortschritt bleibt lokal gespeichert.' : error.message);
        this.timer = setTimeout(() => { void this.sync(); }, this.retryDelay);
        this.retryDelay = Math.min(this.retryDelay * 2, 60000);
      }
      return false;
    } finally { clearTimeout(timeout); this.inFlight = false; }
  }
  async refreshLocal() {
    await this.lock(() => {
      // Other tabs may have switched profiles. Keep this tab bound to its own name.
      try { this.doc = mergeDocuments(this.doc, this.read()); this.onChange(); } catch { /* Keep current progress. */ }
    });
  }
}
