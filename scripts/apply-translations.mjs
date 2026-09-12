import { readFileSync, writeFileSync } from 'node:fs';
import { QUESTIONS } from '../questions.js';
const overrides = JSON.parse(readFileSync(new URL('./translation-overrides.json', import.meta.url)));
for (const question of QUESTIONS) {
  Object.assign(question.en, overrides[question.num] || {});
  question.category = question.category.replace(/^'|'$/g, '');
}
writeFileSync(new URL('../questions.js', import.meta.url), `export const QUESTIONS = ${JSON.stringify(QUESTIONS, null, 2)};\n`);
