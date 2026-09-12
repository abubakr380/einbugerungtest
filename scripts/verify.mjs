import { existsSync, readFileSync } from "node:fs";
import { QUESTIONS } from "../questions.js";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const serviceWorker = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
const root = new URL("../", import.meta.url);
const failures = [];

const ids = [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicateIds.length) failures.push(`Duplicate HTML ids: ${[...new Set(duplicateIds)].join(", ")}`);

const appIdReferences = [...app.matchAll(/\$\("#([A-Za-z0-9_-]+)/g)].map((match) => match[1]);
const missingIds = [...new Set(appIdReferences.filter((id) => !ids.includes(id)))];
if (missingIds.length) failures.push(`Missing HTML ids referenced by app.js: ${missingIds.join(", ")}`);

const requiredQuestionKeys = ["num", "question", "a", "b", "c", "d", "solution", "image", "category", "context", "en"];
const general = QUESTIONS.filter((question) => !question.num.startsWith("BE-"));
const berlin = QUESTIONS.filter((question) => question.num.startsWith("BE-"));
if (QUESTIONS.length !== 310 || general.length !== 300 || berlin.length !== 10) failures.push("Question split is not 300 general + 10 Berlin.");
if (new Set(QUESTIONS.map((question) => question.num)).size !== 310) failures.push("Question numbers are not unique.");
if (QUESTIONS.some((question) => requiredQuestionKeys.some((key) => !(key in question)))) failures.push("At least one question is missing a required key.");
if (QUESTIONS.some((question) => !["a", "b", "c", "d"].includes(question.solution))) failures.push("At least one solution key is invalid.");
const identicalEnglish = new Set(['Willy Brandt', 'Konrad Adenauer', 'Kurt Georg Kiesinger', 'Helmut Schmidt', 'Japan', 'USA', 'Dresden', 'Frankfurt/Oder', 'Berlin', 'Konrad Adenauer.', 'Willy Brandt.', 'Ludwig Erhard.', 'Gerhard Schröder.', 'Saarland', 'Brandenburg', 'Bremen', 'Baden-Württemberg', 'Schleswig-Holstein', 'Mecklenburg-Vorpommern', 'Gerhard Schröder', 'Helmut Kohl', 'Ludwig Erhard', 'tolerant.', 'Angela Merkel', 'Friedrich Merz', 'Ursula von der Leyen', 'Bärbel Bas', 'Bodo Ramelow', 'Frank-Walter Steinmeier', 'Joachim Gauck', 'Opposition', 'Portugal', 'Paris', 'London', 'Euro Union', 'Pankow', 'Prignitz', 'Altona']);
for (const question of QUESTIONS) {
  for (const key of ['question', 'a', 'b', 'c', 'd', 'context']) {
    const en = question.en?.[key]?.trim();
    if (!en) failures.push(`Missing English ${key} for ${question.num}`);
    else if (en === question[key].trim() && (key === 'question' || key === 'context' || (!/^[0-9%]+$/.test(en) && !identicalEnglish.has(en)))) failures.push(`German copied into English ${key} for ${question.num}`);
  }
  if (!/^[A-Za-z &]+$/.test(question.category)) failures.push(`Invalid theme: ${question.num} ${question.category}`);
}
if (QUESTIONS.some((question) => question.image && !existsSync(new URL(`../${question.image}`, import.meta.url)))) failures.push("At least one local question image is missing.");

for (let run = 0; run < 500; run += 1) {
  const mock = [...general].sort(() => Math.random() - 0.5).slice(0, 30)
    .concat([...berlin].sort(() => Math.random() - 0.5).slice(0, 3));
  if (mock.length !== 33 || mock.filter((question) => question.num.startsWith("BE-")).length !== 3) {
    failures.push("Mock exam selection invariant failed.");
    break;
  }
}

const cachedPaths = [...serviceWorker.matchAll(/"\.\/(.*?)"/g)].map((match) => match[1]).filter(Boolean);
const missingCachedFiles = cachedPaths.filter((path) => !existsSync(new URL(`../${path}`, import.meta.url)));
if (missingCachedFiles.length) failures.push(`Missing service-worker assets: ${missingCachedFiles.join(", ")}`);
if (!manifest.icons?.length || manifest.display !== "standalone" || manifest.start_url !== "./") failures.push("Manifest installability fields are incomplete.");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    questions: QUESTIONS.length,
    general: general.length,
    berlin: berlin.length,
    localQuestionImages: QUESTIONS.filter((question) => question.image).length,
    htmlIds: ids.length,
    appIdReferences: new Set(appIdReferences).size,
    cachedAssets: cachedPaths.length,
    manifestIcons: manifest.icons.length
  }, null, 2));
}
