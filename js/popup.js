"use strict";
const api = typeof browser !== "undefined" ? browser : chrome;
const languages = [{ code: "en", label: "English" }, { code: "fa", label: "فارسی" }, { code: "ar", label: "العربية" }, { code: "es", label: "Español" }, { code: "fr", label: "Français" }, { code: "de", label: "Deutsch" }, { code: "tr", label: "Türkçe" }, { code: "sv", label: "Svenska" }, { code: "et", label: "Eesti" }, { code: "ja", label: "日本語" }, { code: "ko", label: "한국어" }, { code: "zh", label: "中文" }, { code: "it", label: "Italiano" }];
let settings = { language: "en", digitStyle: "latin", sound: true, difficulty: "beginner" };
let stats = { score: 0, streak: 0, bestScore: 0, bestStreak: 0, correct: 0, attempts: 0, totalResponseMs: 0 };
let dict = {};
let puzzle;
let selected = [];
const $ = (id) => document.getElementById(id);
const digits = { latin: "0123456789", persian: "۰۱۲۳۴۵۶۷۸۹", arabic: "٠١٢٣٤٥٦٧٨٩" };
const fallbackTranslations = { resetGame: { en: "Reset game", fa: "شروع دوباره", ar: "إعادة اللعبة", es: "Reiniciar juego", fr: "Réinitialiser le jeu", de: "Spiel zurücksetzen", tr: "Oyunu sıfırla", sv: "Återställ spel", et: "Alusta mäng uuesti", ja: "ゲームをリセット", ko: "게임 초기화", zh: "重置游戏", it: "Reimposta gioco" } };
function shown(n) { return String(n).replace(/\d/g, d => digits[settings.digitStyle][Number(d)]); }
function t(k) { return dict[k] || fallbackTranslations[k]?.[settings.language] || fallbackTranslations[k]?.en || k; }
async function load() { const stored = await api.storage.local.get(["settings", "stats"]); settings = { ...settings, ...stored.settings }; stats = { ...stats, ...stored.stats }; await loadLocale(); setup(); newPuzzle(); }
async function loadLocale() {
    const language = settings.language;
    document.documentElement.lang = language;
    document.documentElement.classList.toggle("fa-font", language === "fa");
    const response = await fetch(`locales/${language}.json`);
    dict = await response.json();
    document.documentElement.dir = ["fa", "ar"].includes(language) ? "rtl" : "ltr";
    document.title = t("appName");
    document.querySelectorAll("[data-i18n]").forEach(el => el.textContent = t(el.dataset.i18n));
}
function setup() {
    const language = $("language");
    language.replaceChildren(...languages.map(({ code, label }) => {
        const option = document.createElement("option");
        option.value = code;
        option.textContent = label;
        return option;
    }));
    language.value = settings.language;
    $("digitStyle").value = settings.digitStyle;
    $("sound").checked = settings.sound;
    $("difficulty").value = settings.difficulty;

    $("settingsButton").addEventListener("click", () => toggle(true));
    $("backButton").addEventListener("click", () => { toggle(false); render(); });
    $("resetGameButton").addEventListener("click", resetGame);
    language.addEventListener("change", async event => {
        settings.language = event.target.value;
        await save();
        await loadLocale();
        render();
    });
    $("digitStyle").addEventListener("change", async event => {
        settings.digitStyle = event.target.value;
        await save();
        render();
    });
    $("sound").addEventListener("change", async event => {
        settings.sound = event.target.checked;
        await save();
    });
    $("difficulty").addEventListener("change", async event => {
        settings.difficulty = event.target.value;
        await resetGame();
    });
}
function toggle(on) { $("game").hidden = on; $("settings").hidden = !on; renderStats(); }
async function resetGame() { stats = { ...stats, score: 0, streak: 0, correct: 0, attempts: 0, totalResponseMs: 0 }; await save(); newPuzzle(); }
function makePuzzle() {
    const advanced = settings.difficulty === "adaptive" && stats.correct >= 10; const target = advanced ? [10, 12, 15][Math.min(2, Math.floor(stats.correct / 10))] : 10; const a = 1 + Math.floor(Math.random() * (target - 1)), b = target - a; const values = [a, b]; while (values.length < 9) {
        let n = 1 + Math.floor(Math.random() * Math.max(9, target - 1));
        if (values.filter(x => x === n).length < 2)
            values.push(n);
    } for (let i = values.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [values[i], values[j]] = [values[j], values[i]];
    } return { target, values, solution: [a, b], startedAt: performance.now() };
}
function newPuzzle() { puzzle = makePuzzle(); selected = []; $("feedback").textContent = ""; $("equation").textContent = ""; render(); }
function renderStats() { $("score").textContent = shown(stats.score); $("streak").textContent = shown(stats.streak); $("accuracy").textContent = stats.attempts ? `${shown(Math.round(stats.correct / stats.attempts * 100))}%` : "—"; $("bestScore").textContent = shown(stats.bestScore); $("bestStreak").textContent = shown(stats.bestStreak); $("avgTime").textContent = stats.correct ? `${shown((stats.totalResponseMs / stats.correct / 1000).toFixed(1))}s` : "—"; }
function render() {
    if (!puzzle)
        return; $("targetValue").textContent = shown(puzzle.target); renderStats(); const grid = $("tileGrid"); grid.innerHTML = ""; puzzle.values.forEach((value, i) => { const b = document.createElement("button"); b.className = `tile ${selected.includes(i) ? "selected" : ""}`; b.textContent = shown(value); b.dataset.index = String(i); b.setAttribute("aria-label", `${t("number")} ${shown(value)}`); b.setAttribute("aria-pressed", String(selected.includes(i))); b.onclick = () => choose(i); grid.append(b); });
}
function choose(i) {
    if (selected.includes(i))
        selected = selected.filter(x => x !== i);
    else if (selected.length < 2)
        selected.push(i); render(); if (selected.length === 2)
        check();
}
async function check() {
    stats.attempts++; const vals = selected.map(i => puzzle.values[i]); const ok = vals[0] + vals[1] === puzzle.target; const buttons = selected.map(i => document.querySelector(`.tile[data-index="${i}"]`)); if (ok) {
        stats.correct++;
        stats.score++;
        stats.streak++;
        stats.bestScore = Math.max(stats.bestScore, stats.score);
        stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
        stats.totalResponseMs += performance.now() - puzzle.startedAt;
        renderStats();
        $("equation").textContent = `${shown(vals[0])} + ${shown(vals[1])} = ${shown(puzzle.target)}`;
        $("feedback").textContent = t("correct");
        buttons.forEach(b => b.classList.add("correct"));
        beep(740);
        await save();
        setTimeout(newPuzzle, 650);
    }
    else {
        stats.streak = 0;
        renderStats();
        $("feedback").textContent = t("incorrect");
        buttons.forEach(b => b.classList.add("wrong"));
        beep(180);
        await save();
        setTimeout(() => { selected = []; render(); }, 600);
    }
}
function beep(freq) {
    if (!settings.sound)
        return; try {
            const c = new AudioContext(), o = c.createOscillator(), g = c.createGain();
            o.frequency.value = freq;
            g.gain.value = .04;
            o.connect(g).connect(c.destination);
            o.start();
            o.stop(c.currentTime + .08);
        }
    catch { }
}
function save() { return api.storage.local.set({ settings, stats }); }
document.addEventListener("keydown", e => {
    if (e.key >= "1" && e.key <= "9" && !$("game").hidden)
        choose(Number(e.key) - 1);
});
load();
