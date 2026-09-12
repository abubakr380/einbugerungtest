# Einbürgerungstest Berlin

A mobile-first Progressive Web App for practising the German naturalization exam in Berlin. The frontend uses vanilla HTML, CSS, and JavaScript. Optional username-based progress sync uses a dedicated Cloudflare Worker and D1 database. There are no passwords or analytics.

Published app: [EinTest Berlin](https://abubakr380.github.io/einbugerungtest/).

## Features

- 310-question bank: 300 general questions and 10 Berlin-specific questions
- Four practice modes: all questions, mock exam, weak areas, and not yet mastered
- Realistic mock exams with 30 general questions, 3 Berlin questions, and a 60-minute timer
- Theme practice from Home or the Themen tab, with all / unmastered-only filters and per-theme progress in Statistics
- German explanations and optional English translations
- Immediate correct/incorrect feedback and wrong-answer review
- Persistent mastery, accuracy, streak, and mock-exam history statistics
- Offline support through a service worker and locally stored question images
- Installable PWA with safe-area support, long-word wrapping, saved quiz sessions, and background-safe mock-exam deadlines
- Username-based cloud sync with offline retries, local migration backups, and JSON export
- Accessible, keyboard-friendly controls and reduced-motion support

## Quick start

No build step is required for the frontend. Use Node 22+ for checks and Cloudflare tooling. Serve the project over HTTP:

```bash
npm run serve
```

Then open [http://localhost:4173](http://localhost:4173).

The development server command uses Python's built-in HTTP server, so Python 3 must be available on your system.

For local sync, run `npm ci`, `npm run db:local`, and `npm run dev:api` in a second terminal. The frontend uses the local Worker at port 8787 when opened on localhost or 127.0.0.1. It uses the public API in `sync-config.js` elsewhere.

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
- Missing/copied English text in all six translation fields, with reviewed exceptions for numbers and names
- Legacy migration, offline retries, profile isolation, concurrent device merging, and reset behavior

With the local Worker running, run `node tests/api-integration.mjs` for actual D1 integration checks. The integration script refuses non-local URLs.

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

## Progress storage and migration

Choose **Fortschritt mit Benutzernamen sichern** on Home, or **Statistik → Dein Lernprofil**. Enter the same nickname on every device. This is a shared progress label, not authentication: anyone who knows the name can read, modify, or reset its progress. Names are case-insensitive and accept 3–32 ASCII letters, digits, underscores, and hyphens. No email address is needed.

Progress is always saved locally first. The app stores:

- mastered question numbers
- incorrect-answer frequencies
- answered, correct, and wrong totals
- current and best correct-answer streaks
- mock-exam history

`scripts/migrate-localstorage.js` runs automatically on the original app origin. It copies the existing `eintest_progress` data into a v2 local document, preserving the original key and an `eintest_progress_v1_backup` backup. Choosing a username imports that local history and uploads it automatically. Existing iPhone installations migrate their own storage when reopened and connected; the deployment cannot read an iPhone's local storage remotely.

The local import is assigned to the first chosen username. Returning to that name can merge further guest practice; switching to another name never copies the previous person's history. Named profiles have separate local keys. Backup export includes the current v2 document and original v1 backup.

Each device maintains monotonic counters. The Worker merges device contributions using an optimistic database revision check, so simultaneous saves and retries do not overwrite or double-count answers. Legacy v1 snapshots lack event IDs: overlapping legacy imports use the union of mastered questions and maximum counters instead of summing potentially duplicated history. Distinct pre-upgrade device histories can therefore undercount historical answer totals. New v2 device answers add correctly. Resetting advances a generation; stale offline data cannot bring cleared progress back. Exam history keeps the most recent 20 unique exams. Correct-answer streaks follow the latest active device.

Sync retries after failures and on reconnect/foregrounding. Until a successful sync, the latest data remains on that device. No list of usernames is exposed. Only learning statistics are stored in the dedicated database, under a hash of the username. The hash does not make a guessable username private.

## Cloudflare backend

`wrangler.jsonc` binds `DB` to the dedicated `eintest-progress` database. `migrations/0001_progress.sql` creates one indexed JSON row per username. No account credentials or D1 secrets are sent to the browser. The API is intentionally usable without authentication.

Deploy with the official Wrangler CLI:

```bash
npm ci
npx wrangler login
npm run db:remote
npm run deploy:api
```

The frontend remains on GitHub Pages at its existing address; publishing `main` updates that app. The Worker is deployed separately. `ALLOWED_ORIGINS` permits the existing GitHub Pages origin and local development. Request and document sizes are bounded at 256 KiB, with at most 100 device contributions per profile. Database outages or exhausted quotas leave progress queued locally. Repeated unchanged syncs perform no database writes.

The [D1 free tier](https://developers.cloudflare.com/d1/platform/pricing/) includes 5 million rows read/day, 100,000 rows written/day, and 5 GB total storage; [Workers Free](https://developers.cloudflare.com/workers/platform/pricing/) includes 100,000 requests/day. These limits are shared across the Cloudflare account. No paid plan or add-on is required by this implementation.

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
  category: "History",
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

This migration release activates automatically once so devices running the old silent-update service worker are not stranded on stale files. Subsequent updates wait for the user to tap **Aktualisieren**. Quiz progress and translation preference survive reloads, and a mock exam uses a wall-clock deadline even if iOS suspends the app. Only app files are cached; remote progress responses are never cached. Cache cleanup only touches this app's cache prefix.

On iPhone, open the existing app in Safari and use Share → Add to Home Screen. The app offers installation guidance outside standalone mode and requests persistent storage when running standalone. Safari and an installed home-screen app can have separate storage, so connect each using the same username. Do not remove the installed app or clear its storage before the first successful migration/sync.

## Updating question data

The rebuild script deliberately uses empty strings for missing translations instead of falling back to German. After rebuilding `questions.js`, run `npm run translations` to apply the reviewed corrections in `scripts/translation-overrides.json` and `scripts/theme-overrides.json`, then `npm run check`. Every question, answer choice and explanation must contain English; only reviewed identical names, numbers and shared English words are exempt. The theme overrides split Geschichte from Geografie and Recht from Staat, and combine the former sub-five categories under Sonstiges. Verification rejects any general practice theme with fewer than five questions.

## Data attribution and disclaimer

The question bank was adapted from the public [Leben in Deutschland project](https://github.com/leben-in-deutschland/leben-in-deutschland-app) and follows the [BAMF preparation catalogue](https://oet.bamf.de/ords/oetut/f?p=514:1) format.

Theme names and question-to-theme assignments are maintained by this app as learning aids; they are not official BAMF categories.

This is an unofficial learning tool and is not affiliated with the Bundesamt für Migration und Flüchtlinge. For authoritative and current exam information, consult BAMF directly.
