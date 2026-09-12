import { readFileSync, writeFileSync } from 'node:fs';
import { QUESTIONS } from '../questions.js';
const overrides = JSON.parse(readFileSync(new URL('./translation-overrides.json', import.meta.url)));
const themeOverrides = JSON.parse(readFileSync(new URL('./theme-overrides.json', import.meta.url)));
const themesByQuestion = new Map();

for (const [theme, questionNumbers] of Object.entries(themeOverrides)) {
  for (const questionNumber of questionNumbers) {
    if (themesByQuestion.has(questionNumber)) throw new Error(`Duplicate theme override for ${questionNumber}`);
    themesByQuestion.set(questionNumber, theme);
  }
}

for (const question of QUESTIONS) {
  Object.assign(question.en, overrides[question.num] || {});
  question.category = themesByQuestion.get(question.num) || question.category.replace(/^'|'$/g, '');
}

const knownQuestions = new Set(QUESTIONS.map(question => question.num));
const unknownOverrides = [...themesByQuestion.keys()].filter(questionNumber => !knownQuestions.has(questionNumber));
if (unknownOverrides.length) throw new Error(`Theme overrides reference unknown questions: ${unknownOverrides.join(', ')}`);

const retiredThemes = new Set(['General', 'History & Geography', 'Law & Governance', 'Press Freedom', 'Assembly & Protests']);
const unclassified = QUESTIONS.filter(question => retiredThemes.has(question.category));
if (unclassified.length) throw new Error(`Questions still use retired themes: ${unclassified.map(question => question.num).join(', ')}`);

writeFileSync(new URL('../questions.js', import.meta.url), `export const QUESTIONS = ${JSON.stringify(QUESTIONS, null, 2)};\n`);
