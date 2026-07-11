import { QUESTIONS } from "./questions.js";

const STORAGE_KEY = "eintest_progress";
const OPTION_KEYS = ["a", "b", "c", "d"];
const CATEGORY_ORDER = [
  "General",
  "History & Geography",
  "Law & Governance",
  "Democracy & Politics",
  "Rights & Freedoms",
  "Constitution",
  "Federal System",
  "Elections",
  "Education & Religion",
  "Economy & Employment",
  "Press Freedom",
  "Assembly & Protests"
];

const CATEGORY_META = {
  "General": { label: "Allgemein", icon: "layers", color: "#68aaff" },
  "History & Geography": { label: "Geschichte & Geografie", icon: "landmark", color: "#a980ff" },
  "Law & Governance": { label: "Recht & Staat", icon: "scale", color: "#4ad9e8" },
  "Democracy & Politics": { label: "Demokratie & Politik", icon: "parliament", color: "#68aaff" },
  "Rights & Freedoms": { label: "Rechte & Freiheiten", icon: "shield", color: "#45d79a" },
  "Constitution": { label: "Grundgesetz", icon: "document", color: "#ffad63" },
  "Federal System": { label: "Föderales System", icon: "network", color: "#8e9dff" },
  "Elections": { label: "Wahlen", icon: "check-square", color: "#59d5bd" },
  "Education & Religion": { label: "Bildung & Religion", icon: "book", color: "#dc8aff" },
  "Economy & Employment": { label: "Wirtschaft & Arbeit", icon: "briefcase", color: "#f1b45f" },
  "Press Freedom": { label: "Pressefreiheit", icon: "newspaper", color: "#64b6f4" },
  "Assembly & Protests": { label: "Versammlung & Protest", icon: "users", color: "#f48493" }
};

const ICONS = {
  layers: '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
  landmark: '<path d="m3 9 9-5 9 5M5 10v8m5-8v8m4-8v8m5-8v8M3 21h18"/>',
  scale: '<path d="M12 3v18M5 6h14M5 6l-3 7h6L5 6Zm14 0-3 7h6l-3-7ZM8 21h8"/>',
  parliament: '<path d="M4 21h16M6 18h12M7 18V9m5 9V9m5 9V9M4 9h16L12 3 4 9Z"/>',
  shield: '<path d="M12 3 4 6v5c0 5 3.2 8.6 8 10 4.8-1.4 8-5 8-10V6l-8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>',
  document: '<path d="M6 3h9l4 4v14H6V3Z"/><path d="M14 3v5h5M9 12h6m-6 4h6"/>',
  network: '<circle cx="12" cy="5" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/><path d="M12 7v4M5 16v-3h14v3"/>',
  "check-square": '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m7 12 3 3 7-8"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11a3 3 0 0 1 3 3v14a3.5 3.5 0 0 0-3.5-3.5H4V5.5Z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H14v17a3.5 3.5 0 0 1 3.5-3.5H20v-11Z"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3M3 12h18M10 12v2h4v-2"/>',
  newspaper: '<path d="M5 4h14v16H5a2 2 0 0 1-2-2V6"/><path d="M8 8h7M8 12h8M8 16h5"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m1 3a5 5 0 0 1 4 5"/>',
  arrow: '<path d="m9 5 7 7-7 7"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  clipboard: '<path d="M8 3h8v3H8zM6 5h12a2 2 0 0 1 2 2v14H4V7a2 2 0 0 1 2-2Z"/><path d="m8 13 3 3 5-6"/>'
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const svgIcon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.layers}</svg>`;
const isBerlin = (question) => question.num.startsWith("BE-");
const generalQuestions = QUESTIONS.filter((question) => !isBerlin(question));
const berlinQuestions = QUESTIONS.filter(isBerlin);

const state = {
  activeTab: "home",
  progress: loadProgress(),
  quiz: null,
  translation: false,
  lastRun: null,
  result: null,
  dialogAction: null,
  deferredInstall: null,
  toastTimer: null
};

function emptyProgress() {
  return {
    mastered: new Set(),
    incorrect: new Map(),
    totals: { answered: 0, correct: 0, wrong: 0 },
    streaks: { current: 0, best: 0 },
    examHistory: []
  };
}

function loadProgress() {
  const fallback = emptyProgress();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object") return fallback;
    const mastered = Array.isArray(saved.mastered) ? saved.mastered.filter((num) => typeof num === "string") : [];
    const incorrectEntries = saved.incorrect && typeof saved.incorrect === "object"
      ? Object.entries(saved.incorrect).filter(([, count]) => Number.isFinite(Number(count)))
      : [];
    return {
      mastered: new Set(mastered),
      incorrect: new Map(incorrectEntries.map(([num, count]) => [num, Number(count)])),
      totals: {
        answered: Math.max(0, Number(saved.totals?.answered) || 0),
        correct: Math.max(0, Number(saved.totals?.correct) || 0),
        wrong: Math.max(0, Number(saved.totals?.wrong) || 0)
      },
      streaks: {
        current: Math.max(0, Number(saved.streaks?.current) || 0),
        best: Math.max(0, Number(saved.streaks?.best) || 0)
      },
      examHistory: Array.isArray(saved.examHistory) ? saved.examHistory.slice(0, 20) : []
    };
  } catch {
    return fallback;
  }
}

function saveProgress() {
  const { progress } = state;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    version: 1,
    mastered: [...progress.mastered],
    incorrect: Object.fromEntries(progress.incorrect),
    totals: progress.totals,
    streaks: progress.streaks,
    examHistory: progress.examHistory
  }));
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

function percentage(part, total) {
  return total ? Math.round((part / total) * 100) : 0;
}

function categoryLabel(category) {
  return CATEGORY_META[category]?.label || category || "Allgemein";
}

function getAccuracy() {
  return percentage(state.progress.totals.correct, state.progress.totals.answered);
}

function showToast(message) {
  const toast = $("#toast");
  clearTimeout(state.toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  state.toastTimer = setTimeout(() => { toast.hidden = true; }, 2800);
}

function switchTab(tab, updateHash = true) {
  if (!["home", "practice", "stats"].includes(tab)) tab = "home";
  state.activeTab = tab;
  $$(".tab-view").forEach((view) => {
    const active = view.dataset.view === tab;
    view.hidden = !active;
    view.classList.toggle("is-active", active);
  });
  $$(".tab-button").forEach((button) => {
    const active = button.dataset.tab === tab;
    button.classList.toggle("is-active", active);
    active ? button.setAttribute("aria-current", "page") : button.removeAttribute("aria-current");
  });
  if (updateHash && location.hash !== `#${tab}`) history.replaceState(null, "", `#${tab}`);
  if (tab === "practice") renderPractice();
  if (tab === "stats") renderStats();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderHome() {
  const mastered = state.progress.mastered.size;
  const remaining = Math.max(0, QUESTIONS.length - mastered);
  const accuracy = getAccuracy();
  const weakCount = [...state.progress.incorrect.keys()].filter((num) => QUESTIONS.some((question) => question.num === num)).length;
  $("#home-mastered").textContent = mastered;
  $("#home-remaining").textContent = remaining;
  $("#home-accuracy").textContent = `${accuracy}%`;
  $("#header-mastered").textContent = mastered;
  $("#weak-count").textContent = weakCount;
  $("#unmastered-count").textContent = remaining;
  $("#all-progress-fill").style.width = `${percentage(mastered, QUESTIONS.length)}%`;
  $("#mini-ring-fill").parentElement.style.setProperty("--ring-angle", `${percentage(mastered, QUESTIONS.length) * 3.6}deg`);
}

function renderPractice() {
  const berlinMastered = berlinQuestions.filter((question) => state.progress.mastered.has(question.num)).length;
  $("#berlin-category-count").textContent = `${berlinMastered} / ${berlinQuestions.length}`;
  $("#berlin-category-fill").style.width = `${percentage(berlinMastered, berlinQuestions.length)}%`;
  $("#berlin-category-fill").style.setProperty("--progress-color", "#ff6f7b");

  const presentCategories = new Set(generalQuestions.map((question) => question.category));
  const categories = CATEGORY_ORDER.filter((category) => presentCategories.has(category));
  $("#category-list").innerHTML = categories.map((category) => {
    const meta = CATEGORY_META[category] || CATEGORY_META.General;
    const questions = generalQuestions.filter((question) => question.category === category);
    const mastered = questions.filter((question) => state.progress.mastered.has(question.num)).length;
    const progress = percentage(mastered, questions.length);
    return `
      <button class="category-card" type="button" data-category="${escapeHTML(category)}">
        <span class="mode-icon" style="--category-color:${meta.color};color:${meta.color};background:color-mix(in srgb, ${meta.color} 13%, transparent);border-color:color-mix(in srgb, ${meta.color} 19%, transparent)">${svgIcon(meta.icon)}</span>
        <span>
          <span class="category-line"><h2>${escapeHTML(meta.label)}</h2><small>${mastered} / ${questions.length}</small></span>
          <em style="--progress-color:${meta.color}"><i style="width:${progress}%"></i></em>
        </span>
        <span class="mode-arrow">${svgIcon("arrow")}</span>
      </button>`;
  }).join("");
}

function renderStats() {
  const { totals, streaks, examHistory, mastered } = state.progress;
  const accuracy = getAccuracy();
  $("#stats-accuracy").textContent = `${accuracy}%`;
  $("#stats-ring-value").style.strokeDashoffset = String(100 - accuracy);
  $("#stats-answered").textContent = totals.answered;
  $("#stats-correct").textContent = totals.correct;
  $("#stats-wrong").textContent = totals.wrong;
  $("#stats-mastered").textContent = mastered.size;
  $("#current-streak").textContent = streaks.current;
  $("#best-streak").textContent = streaks.best;
  $("#history-count").textContent = `${examHistory.length} ${examHistory.length === 1 ? "Versuch" : "Versuche"}`;

  let message = "Beantworte deine erste Frage, um deine Statistik zu starten.";
  if (totals.answered && accuracy < 60) message = "Deine Fehler zeigen dir genau, was du als Nächstes üben solltest.";
  if (accuracy >= 60) message = "Gute Basis — wiederhole jetzt gezielt deine Schwachstellen.";
  if (accuracy >= 80) message = "Sehr solide. Mit regelmäßigen Probeprüfungen hältst du dein Niveau.";
  if (accuracy >= 90) message = "Prüfungsreif — halte deinen starken Rhythmus bis zum Testtag.";
  $("#accuracy-message").textContent = message;

  const history = $("#exam-history");
  if (!examHistory.length) {
    history.innerHTML = '<div class="history-empty">Noch keine Probeprüfung abgeschlossen.</div>';
    return;
  }
  history.innerHTML = examHistory.slice(0, 8).map((exam) => {
    const date = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(exam.date));
    return `
      <div class="history-item">
        <span class="history-icon">${svgIcon("clipboard")}</span>
        <span><strong>${exam.score} / ${exam.total} richtig</strong><small>${escapeHTML(date)} · ${percentage(exam.score, exam.total)}%</small></span>
        <span class="status-badge${exam.passed ? "" : " failed"}">${exam.passed ? "BESTANDEN" : "NICHT BESTANDEN"}</span>
      </div>`;
  }).join("");
}

function renderAll() {
  renderHome();
  renderPractice();
  renderStats();
}

function selectQuestions(mode, category) {
  if (mode === "mock") {
    return [...shuffle(generalQuestions).slice(0, 30), ...shuffle(berlinQuestions).slice(0, 3)];
  }
  if (mode === "weak") {
    const frequencies = state.progress.incorrect;
    return shuffle(QUESTIONS.filter((question) => frequencies.has(question.num))).sort(
      (first, second) => (frequencies.get(second.num) || 0) - (frequencies.get(first.num) || 0)
    );
  }
  if (mode === "unmastered") {
    return shuffle(QUESTIONS.filter((question) => !state.progress.mastered.has(question.num)));
  }
  if (mode === "category") {
    return shuffle(category === "Berlin (Bundesland)"
      ? berlinQuestions
      : generalQuestions.filter((question) => question.category === category));
  }
  return shuffle(QUESTIONS);
}

function modeLabel(mode, category) {
  if (mode === "mock") return "Probeprüfung";
  if (mode === "weak") return "Schwachstellen";
  if (mode === "unmastered") return "Nicht gemeistert";
  if (mode === "category") return category === "Berlin (Bundesland)" ? "Berlin" : categoryLabel(category);
  return "Alle Fragen";
}

function startQuiz(mode, category = null) {
  const questions = selectQuestions(mode, category);
  if (!questions.length) {
    const message = mode === "weak"
      ? "Noch keine Schwachstellen — falsch beantwortete Fragen erscheinen hier."
      : "Großartig: In diesem Modus gibt es aktuell keine offenen Fragen.";
    showToast(message);
    return;
  }

  stopTimer();
  state.translation = false;
  state.lastRun = { mode, category };
  state.quiz = {
    mode,
    category,
    label: modeLabel(mode, category),
    questions,
    index: 0,
    answers: [],
    locked: false,
    selected: null,
    startedAt: Date.now(),
    remainingSeconds: mode === "mock" ? 60 * 60 : null,
    timerId: null
  };

  $("#quiz-overlay").hidden = false;
  $("#results-overlay").hidden = true;
  document.body.classList.add("overlay-open");
  $("#translation-toggle").setAttribute("aria-pressed", "false");
  $("#quiz-overlay").classList.remove("translation-visible");
  if (mode === "mock") {
    $("#quiz-timer").classList.remove("is-hidden");
    state.quiz.timerId = window.setInterval(tickTimer, 1000);
    updateTimerDisplay();
  } else {
    $("#quiz-timer").classList.add("is-hidden");
  }
  renderQuestion();
  $("#quiz-overlay").scrollTop = 0;
}

function tickTimer() {
  if (!state.quiz || state.quiz.mode !== "mock") return;
  state.quiz.remainingSeconds = Math.max(0, state.quiz.remainingSeconds - 1);
  updateTimerDisplay();
  if (state.quiz.remainingSeconds === 0) {
    stopTimer();
    showToast("Die Prüfungszeit ist abgelaufen.");
    finishQuiz(true);
  }
}

function updateTimerDisplay() {
  if (!state.quiz || state.quiz.remainingSeconds === null) return;
  const minutes = Math.floor(state.quiz.remainingSeconds / 60);
  const seconds = state.quiz.remainingSeconds % 60;
  $("#quiz-timer b").textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  $("#quiz-timer").classList.toggle("is-urgent", state.quiz.remainingSeconds <= 300);
}

function stopTimer() {
  if (state.quiz?.timerId) window.clearInterval(state.quiz.timerId);
  if (state.quiz) state.quiz.timerId = null;
}

function renderQuestion() {
  const quiz = state.quiz;
  if (!quiz) return;
  const question = quiz.questions[quiz.index];
  const current = quiz.index + 1;
  const progress = percentage(current, quiz.questions.length);
  quiz.locked = false;
  quiz.selected = null;

  $("#quiz-progress-text").textContent = `${current} / ${quiz.questions.length}`;
  $("#quiz-mode-badge").textContent = quiz.label;
  $("#quiz-progress-fill").style.width = `${progress}%`;
  $("#question-number").textContent = isBerlin(question) ? `BERLIN · ${question.num}` : `FRAGE ${question.num}`;
  $("#question-category").textContent = isBerlin(question) ? "Berlin (Bundesland)" : categoryLabel(question.category);
  $("#quiz-question").textContent = question.question;
  $("#question-translation p").textContent = question.en?.question || question.question;

  const image = $("#question-image");
  if (question.image) {
    image.src = question.image;
    image.alt = `Abbildung zur Frage ${question.num}`;
    image.hidden = false;
  } else {
    image.hidden = true;
    image.removeAttribute("src");
  }

  $("#quiz-options").innerHTML = OPTION_KEYS.map((key) => `
    <button class="option-button" type="button" data-option="${key}">
      <span class="option-letter">${key.toUpperCase()}</span>
      <span class="option-text"><span>${escapeHTML(question[key])}</span><small class="option-translation">${escapeHTML(question.en?.[key] || question[key])}</small></span>
      <span class="option-status" aria-hidden="true"></span>
    </button>`).join("");
  $("#feedback-panel").hidden = true;
  $("#feedback-panel").classList.remove("is-correct", "is-wrong");
  $("#next-question").hidden = true;
  $("#next-question").firstChild.textContent = quiz.index === quiz.questions.length - 1 ? "Auswertung" : "Weiter";
  $(".quiz-main")?.scrollTo?.({ top: 0 });
  $("#quiz-overlay").scrollTo({ top: 0, behavior: "smooth" });
}

function answerQuestion(selected) {
  const quiz = state.quiz;
  if (!quiz || quiz.locked || !OPTION_KEYS.includes(selected)) return;
  const question = quiz.questions[quiz.index];
  const correct = selected === question.solution;
  quiz.locked = true;
  quiz.selected = selected;
  quiz.answers.push({ question, selected, correct });

  const { progress } = state;
  progress.totals.answered += 1;
  if (correct) {
    progress.totals.correct += 1;
    progress.mastered.add(question.num);
    progress.streaks.current += 1;
    progress.streaks.best = Math.max(progress.streaks.best, progress.streaks.current);
  } else {
    progress.totals.wrong += 1;
    progress.incorrect.set(question.num, (progress.incorrect.get(question.num) || 0) + 1);
    progress.streaks.current = 0;
  }
  saveProgress();
  renderHome();

  $$(".option-button", $("#quiz-options")).forEach((button) => {
    const option = button.dataset.option;
    button.disabled = true;
    if (option === question.solution) {
      button.classList.add("is-correct");
      $(".option-status", button).innerHTML = svgIcon("check");
    } else if (option === selected) {
      button.classList.add("is-wrong");
      $(".option-status", button).innerHTML = svgIcon("x");
    }
  });

  const feedback = $("#feedback-panel");
  feedback.hidden = false;
  feedback.classList.add(correct ? "is-correct" : "is-wrong");
  $("#feedback-icon").innerHTML = svgIcon(correct ? "check" : "x");
  $("#feedback-title").textContent = correct ? "Richtig beantwortet" : "Leider nicht richtig";
  $("#feedback-context").textContent = question.context;
  $("#feedback-translation p").textContent = question.en?.context || question.context;
  $("#next-question").hidden = false;
  window.setTimeout(() => $("#feedback-panel").scrollIntoView({ behavior: "smooth", block: "nearest" }), 120);
}

function nextQuestion() {
  const quiz = state.quiz;
  if (!quiz || !quiz.locked) return;
  if (quiz.index >= quiz.questions.length - 1) {
    finishQuiz(false);
    return;
  }
  quiz.index += 1;
  renderQuestion();
}

function finishQuiz(timedOut = false) {
  const quiz = state.quiz;
  if (!quiz) return;
  stopTimer();
  if (timedOut) {
    for (let index = quiz.answers.length; index < quiz.questions.length; index += 1) {
      quiz.answers.push({ question: quiz.questions[index], selected: null, correct: false, unanswered: true });
    }
  }

  const correct = quiz.answers.filter((answer) => answer.correct).length;
  const total = quiz.questions.length;
  const passed = quiz.mode === "mock" ? correct >= 17 : null;
  state.result = {
    mode: quiz.mode,
    label: quiz.label,
    answers: [...quiz.answers],
    correct,
    total,
    passed,
    timedOut
  };

  if (quiz.mode === "mock") {
    state.progress.examHistory.unshift({
      date: new Date().toISOString(),
      score: correct,
      total,
      passed
    });
    state.progress.examHistory = state.progress.examHistory.slice(0, 20);
    saveProgress();
  }

  state.quiz = null;
  $("#quiz-overlay").hidden = true;
  renderResults();
  $("#results-overlay").hidden = false;
  $("#results-overlay").scrollTop = 0;
}

function renderResults() {
  const result = state.result;
  if (!result) return;
  const scorePercent = percentage(result.correct, result.total);
  $("#result-percent").textContent = `${scorePercent}%`;
  $("#result-score").textContent = `${result.correct} von ${result.total}`;
  $("#result-ring-value").style.strokeDashoffset = "100";
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
    $("#result-ring-value").style.strokeDashoffset = String(100 - scorePercent);
  }));

  let title = "Weiter üben — du schaffst das!";
  if (scorePercent >= 50) title = "Guter Fortschritt!";
  if (scorePercent >= 75) title = "Stark gemacht!";
  if (scorePercent >= 90) title = "Hervorragend!";
  if (result.mode === "mock") title = result.passed ? "Prüfung bestanden!" : "Fast geschafft!";
  $("#results-title").textContent = title;

  const badge = $("#result-badge");
  if (result.mode === "mock") {
    badge.hidden = false;
    badge.textContent = result.passed ? "BESTANDEN" : "NICHT BESTANDEN";
    badge.classList.toggle("failed", !result.passed);
  } else {
    badge.hidden = true;
  }

  const groups = new Map();
  result.answers.forEach((answer) => {
    const key = isBerlin(answer.question) ? "Berlin (Bundesland)" : answer.question.category;
    if (!groups.has(key)) groups.set(key, { correct: 0, total: 0 });
    const group = groups.get(key);
    group.total += 1;
    if (answer.correct) group.correct += 1;
  });
  $("#category-breakdown").innerHTML = [...groups.entries()].map(([category, values]) => {
    const progress = percentage(values.correct, values.total);
    const color = progress >= 70 ? "#45d79a" : progress >= 45 ? "#68aaff" : "#ff6f7b";
    return `<div class="breakdown-item"><div><strong>${escapeHTML(category === "Berlin (Bundesland)" ? category : categoryLabel(category))}</strong><span>${values.correct} / ${values.total}</span></div><em style="--progress-color:${color}"><i style="width:${progress}%"></i></em></div>`;
  }).join("");

  const wrong = result.answers.filter((answer) => !answer.correct);
  $("#wrong-review-count").textContent = String(wrong.length);
  $("#wrong-review-list").innerHTML = wrong.length ? wrong.map((answer) => {
    const question = answer.question;
    const selectedText = answer.selected ? question[answer.selected] : "Nicht beantwortet";
    return `
      <article class="review-item">
        <span>${isBerlin(question) ? question.num : `FRAGE ${question.num}`} · ${escapeHTML(isBerlin(question) ? "BERLIN" : categoryLabel(question.category))}</span>
        <h3>${escapeHTML(question.question)}</h3>
        <p class="review-en">${escapeHTML(question.en?.question || "")}</p>
        <div class="review-answer wrong"><small>Deine Antwort</small><strong>${escapeHTML(selectedText)}</strong></div>
        <div class="review-answer correct"><small>Richtig</small><strong>${escapeHTML(question[question.solution])}</strong></div>
      </article>`;
  }).join("") : '<div class="review-empty">Perfekt — keine falschen Antworten in dieser Runde.</div>';
}

function closeOverlays(goHome = true) {
  stopTimer();
  state.quiz = null;
  state.result = null;
  $("#quiz-overlay").hidden = true;
  $("#results-overlay").hidden = true;
  document.body.classList.remove("overlay-open");
  renderAll();
  if (goHome) switchTab("home");
}

function retryLastRun() {
  const lastRun = state.lastRun;
  $("#results-overlay").hidden = true;
  state.result = null;
  if (lastRun) startQuiz(lastRun.mode, lastRun.category);
}

function toggleTranslation() {
  state.translation = !state.translation;
  $("#translation-toggle").setAttribute("aria-pressed", String(state.translation));
  $("#quiz-overlay").classList.toggle("translation-visible", state.translation);
}

function openConfirm({ title, message, confirmLabel, action, reset = false }) {
  state.dialogAction = action;
  $("#dialog-title").textContent = title;
  $("#dialog-message").textContent = message;
  $("#dialog-confirm").textContent = confirmLabel;
  $("#dialog-icon").innerHTML = reset
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-9 0 1 14h10l1-14M10 11v6m4-6v6"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v5m0 3h.01"/></svg>';
  $("#confirm-dialog").showModal();
}

function resetProgress() {
  state.progress = emptyProgress();
  localStorage.removeItem(STORAGE_KEY);
  renderAll();
  showToast("Dein Fortschritt wurde vollständig zurückgesetzt.");
}

function bindEvents() {
  $$(".tab-button").forEach((button) => button.addEventListener("click", () => switchTab(button.dataset.tab)));
  $(".brand").addEventListener("click", (event) => { event.preventDefault(); switchTab("home"); });
  $$('[data-start-mode]').forEach((button) => button.addEventListener("click", () => startQuiz(button.dataset.startMode)));
  $("#practice-title").closest("section").addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (button) startQuiz("category", button.dataset.category);
  });
  $("#quiz-options").addEventListener("click", (event) => {
    const button = event.target.closest("[data-option]");
    if (button) answerQuestion(button.dataset.option);
  });
  $("#next-question").addEventListener("click", nextQuestion);
  $("#translation-toggle").addEventListener("click", toggleTranslation);
  $("#exit-quiz").addEventListener("click", () => openConfirm({
    title: "Quiz verlassen?",
    message: "Deine Antworten sind gespeichert, die aktuelle Runde wird aber beendet.",
    confirmLabel: "Verlassen",
    action: () => closeOverlays(false)
  }));
  $("#close-results").addEventListener("click", () => closeOverlays(false));
  $("#back-home").addEventListener("click", () => closeOverlays(true));
  $("#try-again").addEventListener("click", retryLastRun);
  $("#reset-progress").addEventListener("click", () => openConfirm({
    title: "Fortschritt zurücksetzen?",
    message: "Alle gemeisterten Fragen, Fehler, Serien und Prüfungsergebnisse werden dauerhaft gelöscht.",
    confirmLabel: "Zurücksetzen",
    action: resetProgress,
    reset: true
  }));
  $("#dialog-cancel").addEventListener("click", () => $("#confirm-dialog").close());
  $("#dialog-confirm").addEventListener("click", () => {
    const action = state.dialogAction;
    state.dialogAction = null;
    $("#confirm-dialog").close();
    action?.();
  });
  $("#confirm-dialog").addEventListener("cancel", () => { state.dialogAction = null; });
  window.addEventListener("hashchange", () => {
    if (!state.quiz && !state.result) switchTab(location.hash.slice(1), false);
  });
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredInstall = event;
    $("#install-button").classList.remove("is-hidden");
  });
  $("#install-button").addEventListener("click", async () => {
    if (!state.deferredInstall) return;
    state.deferredInstall.prompt();
    await state.deferredInstall.userChoice;
    state.deferredInstall = null;
    $("#install-button").classList.add("is-hidden");
  });
  window.addEventListener("appinstalled", () => {
    state.deferredInstall = null;
    $("#install-button").classList.add("is-hidden");
    showToast("EinTest Berlin wurde installiert.");
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
}

function init() {
  if (QUESTIONS.length !== 310 || generalQuestions.length !== 300 || berlinQuestions.length !== 10) {
    console.warn("Der Fragenkatalog entspricht nicht der erwarteten Aufteilung 300 + 10.");
  }
  bindEvents();
  renderAll();
  const initialTab = location.hash.slice(1);
  switchTab(["home", "practice", "stats"].includes(initialTab) ? initialTab : "home", false);
  registerServiceWorker();
}

init();
