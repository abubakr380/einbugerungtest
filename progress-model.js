// Shared by the browser and Worker. A device owns monotonic counters; merging
// takes their maxima, so retries cannot count an answer twice.
const count = (value) => Number.isSafeInteger(Number(value)) ? Math.min(1e9, Math.max(0, Number(value))) : 0;
const validQuestion = (id) => /^(?:[1-9]\d{0,2}|BE-(?:[1-9]|10))$/.test(id) && (id.startsWith('BE-') || Number(id) <= 300);
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

export function normalizeUsername(value) {
  const name = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{2,31}$/.test(name)) throw new Error('Bitte 3–32 Zeichen verwenden: a–z, 0–9, _ oder -.');
  return name;
}

export function cleanProgress(value = {}) {
  const p = object(value);
  const correct = count(p.totals?.correct), wrong = count(p.totals?.wrong);
  const history = new Map();
  for (const exam of Array.isArray(p.examHistory) ? p.examHistory : []) {
    if (!exam || !Number.isFinite(Date.parse(exam.date)) || exam.total !== 33 || !Number.isInteger(exam.score) || exam.score < 0 || exam.score > 33) continue;
    const id = typeof exam.id === 'string' && /^[a-zA-Z0-9:_-]{1,100}$/.test(exam.id)
      ? exam.id : `legacy:${Date.parse(exam.date)}:${exam.score}`;
    history.set(id, { id, date: new Date(exam.date).toISOString(), score: exam.score, total: 33, passed: exam.score >= 17 });
  }
  return {
    mastered: [...new Set((Array.isArray(p.mastered) ? p.mastered : []).filter(id => typeof id === 'string' && validQuestion(id)))].sort(),
    incorrect: Object.fromEntries(Object.entries(object(p.incorrect)).filter(([id, n]) => validQuestion(id) && count(n) > 0).sort().map(([id, n]) => [id, count(n)])),
    totals: { answered: Math.max(count(p.totals?.answered), correct + wrong), correct, wrong },
    streaks: { current: count(p.streaks?.current), best: Math.max(count(p.streaks?.best), count(p.streaks?.current)) },
    examHistory: [...history.values()].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)).slice(0, 20),
    updatedAt: countTime(p.updatedAt)
  };
}

function countTime(value) { return Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000 ? value : 0; }

function mergeProgress(left, right) {
  const a = cleanProgress(left), b = cleanProgress(right);
  // The lexical tie-break keeps a merge deterministic if cloned storage ever
  // produces two conflicting snapshots with the same device timestamp.
  const newer = (progress) => [
    progress.updatedAt,
    progress.totals.answered,
    progress.totals.correct,
    progress.totals.wrong,
    progress.streaks.best,
    progress.streaks.current,
    JSON.stringify(progress)
  ];
  const compare = (one, two) => {
    const aKey = newer(one), bKey = newer(two);
    for (let index = 0; index < aKey.length; index++) {
      if (aKey[index] > bKey[index]) return 1;
      if (aKey[index] < bKey[index]) return -1;
    }
    return 0;
  };
  const latest = compare(a, b) >= 0 ? a : b;
  return cleanProgress({
    mastered: [...a.mastered, ...b.mastered],
    incorrect: Object.fromEntries([...new Set([...Object.keys(a.incorrect), ...Object.keys(b.incorrect)])].map(id => [id, Math.max(a.incorrect[id] || 0, b.incorrect[id] || 0)])),
    totals: Object.fromEntries(['answered', 'correct', 'wrong'].map(k => [k, Math.max(a.totals[k], b.totals[k])])),
    streaks: { current: latest.streaks.current, best: Math.max(a.streaks.best, b.streaks.best) },
    examHistory: [...a.examHistory, ...b.examHistory], updatedAt: latest.updatedAt
  });
}

export function emptyDocument(generation = 0) {
  return { version: 2, generation, legacy: cleanProgress(), devices: {} };
}

export function cleanDocument(value) {
  if (!value || value.version !== 2 || !Number.isSafeInteger(value.generation) || value.generation < 0 || value.generation > 1e9) throw new Error('Ungültiges Fortschrittsformat.');
  const entries = Object.entries(object(value.devices));
  if (entries.length > 100) throw new Error('Zu viele Geräte in diesem Profil.');
  if (entries.some(([id]) => !/^[a-f0-9-]{36}$/.test(id))) throw new Error('Ungültige Gerätekennung.');
  return { version: 2, generation: value.generation, legacy: cleanProgress(value.legacy), devices: Object.fromEntries(entries.sort().map(([id, p]) => [id, cleanProgress(p)])) };
}

export function mergeDocuments(left, right) {
  const a = cleanDocument(left), b = cleanDocument(right);
  // A reset advances the generation. An old offline device cannot resurrect it.
  if (a.generation !== b.generation) return a.generation > b.generation ? a : b;
  const devices = Object.fromEntries([...new Set([...Object.keys(a.devices), ...Object.keys(b.devices)])].sort().map(id => [id, mergeProgress(a.devices[id], b.devices[id])]));
  return cleanDocument({ version: 2, generation: a.generation, legacy: mergeProgress(a.legacy, b.legacy), devices });
}

export function summarize(document) {
  const doc = cleanDocument(document);
  const parts = [doc.legacy, ...Object.values(doc.devices)];
  const latest = parts.reduce((a, b) => b.updatedAt > a.updatedAt ? b : a);
  return cleanProgress({
    mastered: parts.flatMap(p => p.mastered),
    incorrect: Object.fromEntries([...new Set(parts.flatMap(p => Object.keys(p.incorrect)))].map(id => [id, parts.reduce((n, p) => n + (p.incorrect[id] || 0), 0)])),
    totals: Object.fromEntries(['answered', 'correct', 'wrong'].map(k => [k, parts.reduce((n, p) => n + p.totals[k], 0)])),
    streaks: { current: latest.streaks.current, best: Math.max(...parts.map(p => p.streaks.best)) },
    examHistory: parts.flatMap(p => p.examHistory), updatedAt: latest.updatedAt
  });
}

export function recordAnswer(document, deviceId, questionId, correct, now = Date.now()) {
  if (!validQuestion(questionId) || typeof correct !== 'boolean') throw new Error('Ungültige Antwort.');
  const doc = cleanDocument(document), summary = summarize(doc);
  const p = cleanProgress(doc.devices[deviceId]);
  p.totals.answered++;
  if (correct) { p.totals.correct++; p.mastered.push(questionId); }
  else { p.totals.wrong++; p.incorrect[questionId] = (p.incorrect[questionId] || 0) + 1; }
  p.streaks.current = correct ? summary.streaks.current + 1 : 0;
  p.streaks.best = Math.max(p.streaks.best, p.streaks.current);
  p.updatedAt = Math.max(now, summary.updatedAt + 1);
  doc.devices[deviceId] = cleanProgress(p);
  return cleanDocument(doc);
}

export function recordExam(document, deviceId, exam) {
  const doc = cleanDocument(document), p = cleanProgress(doc.devices[deviceId]);
  p.examHistory.unshift(exam);
  doc.devices[deviceId] = cleanProgress(p);
  return cleanDocument(doc);
}
