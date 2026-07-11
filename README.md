# Einbürgerungstest Berlin

A polished, mobile-first Progressive Web App for practising the German naturalization exam in Berlin. It is built with vanilla HTML, CSS, and JavaScript—without frameworks, build tooling, accounts, or analytics.

## Features

- 310-question bank: 300 general questions and 10 Berlin-specific questions
- Four practice modes: all questions, mock exam, weak areas, and not yet mastered
- Realistic mock exams with 30 general questions, 3 Berlin questions, and a 60-minute timer
- Category-based practice with per-category mastery progress
- German explanations and optional English translations
- Immediate correct/incorrect feedback and wrong-answer review
- Persistent mastery, accuracy, streak, and mock-exam history statistics
- Offline support through a service worker and locally stored question images
- Installable PWA with safe-area support for modern mobile devices
- Accessible, keyboard-friendly controls and reduced-motion support

## Quick start

No package installation or build step is required. Serve the project over HTTP so JavaScript modules and the service worker work correctly:

```bash
npm run serve
```

Then open [http://localhost:4173](http://localhost:4173).

The development server command uses Python's built-in HTTP server, so Python 3 must be available on your system.

## Validation

Run the included syntax and integrity checks:

```bash
npm run check
```

The verification covers:

- JavaScript syntax
- The 300 general + 10 Berlin question split
- Unique question numbers and required data fields
- Valid answer keys and English translation data
- Mock-exam selection invariants
- Local question images and service-worker cache assets
- HTML IDs referenced by the application logic
- Required PWA manifest fields

## Project structure

```text
.
├── index.html              # Single-page application and overlay structure
├── style.css               # Design tokens, layout, responsive UI, and animation
├── app.js                  # State, quiz logic, persistence, stats, and rendering
├── questions.js            # Complete Berlin question bank
├── manifest.json           # PWA metadata and install icons
├── sw.js                   # Offline application-shell cache
├── assets/
│   ├── app-icon.svg
│   ├── icon-192.png
│   ├── icon-512.png
│   └── questions/          # Local illustrations for image-based questions
└── scripts/
    ├── build-questions.jq  # Rebuilds the normalized question data
    └── verify.mjs          # Project integrity checks
```

## Progress storage

All progress remains in the browser under the `eintest_progress` local-storage key. The app stores:

- mastered question numbers
- incorrect-answer frequencies
- answered, correct, and wrong totals
- current and best correct-answer streaks
- mock-exam history

No account or remote backend is used. Progress can be cleared from the Statistics tab.

## Question format

Every entry in `questions.js` follows this structure:

```javascript
{
  num: "1",
  question: "Was war am 8. Mai 1945?",
  a: "Ende des Zweiten Weltkriegs in Europa",
  b: "Tod Adolf Hitlers",
  c: "Wahl von Konrad Adenauer zum Bundeskanzler",
  d: "Beginn des Berliner Mauerbaus",
  solution: "a",
  image: null,
  category: "History & Geography",
  context: "Erklärung auf Deutsch.",
  en: {
    question: "What happened on May 8, 1945?",
    a: "End of World War II in Europe",
    b: "Death of Adolf Hitler",
    c: "Election of Konrad Adenauer as Federal Chancellor",
    d: "Beginning of the construction of the Berlin Wall",
    context: "Explanation in English."
  }
}
```

## PWA and offline use

The service worker caches the application shell, question bank, icons, and question illustrations. After the first successful load, the installed app can be used without a network connection.

When changing cached files, increment `CACHE_NAME` in `sw.js` so existing installations receive the new version.

## Data attribution and disclaimer

The question bank was adapted from the public [Leben in Deutschland project](https://github.com/leben-in-deutschland/leben-in-deutschland-app) and follows the [BAMF preparation catalogue](https://oet.bamf.de/ords/oetut/f?p=514:1) format.

This is an unofficial learning tool and is not affiliated with the Bundesamt für Migration und Flüchtlinge. For authoritative and current exam information, consult BAMF directly.

