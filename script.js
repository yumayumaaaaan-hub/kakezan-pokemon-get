/*
  script.js — 掛け算でポケモンゲット
  ─────────────────────────────────
  ゲームの動きを担当するファイルです。
  ・画面の切り替え
  ・掛け算問題の出題
  ・ボール種類・ゲット確率
  ・ポケモンゲット演出
  ・localStorage への保存

  個人学習用プロトタイプです。
*/

// ─────────────────────────────────────────
// 定数（ゲームのルール）
// ─────────────────────────────────────────

const STORAGE_KEY = "pokeMathGame005";
const TOTAL_POKEMON = pokemons.length;
const NORMAL_QUESTIONS = 5;
const LEGENDARY_QUESTIONS = 10;
const LEGENDARY_IDS = [144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 251];
const LEGENDARY_CATCH_INTERVAL = Math.max(
  20,
  Math.floor((TOTAL_POKEMON - LEGENDARY_IDS.length) / LEGENDARY_IDS.length)
);
const MAX_MISTAKE_STORE = 50;
const MAX_MISTAKE_DISPLAY = 10;

// 【テスト用】true = 1匹目から伝説チャレンジ（BGM確認用）。本番に戻すときは false に変更
const LEGENDARY_TEST_MODE = false;

// 【テスト用】true = 全251匹ゲット済みとして表示（確認後 false に戻す）
const ALL_CAUGHT_TEST_MODE = false;

// ボールの種類と CSS クラス・ゲット確率
const BALL_CONFIG = {
  "モンスターボール": {
    cssClass: "pokeball--monster",
    barClass: "quiz-header__bar-fill--monster",
    barColor: "#e53935",
    normalRate: 60,
    legendaryRate: 30,
  },
  "スーパーボール": {
    cssClass: "pokeball--super",
    barClass: "quiz-header__bar-fill--super",
    barColor: "#1565c0",
    normalRate: 75,
    legendaryRate: 45,
  },
  "ハイパーボール": {
    cssClass: "pokeball--hyper",
    barClass: "quiz-header__bar-fill--hyper",
    barColor: "#424242",
    normalRate: 90,
    legendaryRate: 65,
  },
  "プレミアボール": {
    cssClass: "pokeball--premier",
    barClass: "quiz-header__bar-fill--premier",
    barColor: "#f5f5f5",
    normalRate: 95,
    legendaryRate: 80,
  },
  "マスターボール": {
    cssClass: "pokeball--master",
    barClass: "quiz-header__bar-fill--master",
    barColor: "#7e57c2",
    normalRate: 100,
    legendaryRate: 100,
  },
};

// 正解数に応じたメッセージ
const SCORE_MESSAGES = [
  { min: 0, text: "チャレンジ ありがとう！ ポケモン ゲット チャンス！" },
  { min: 1, text: "がんばったね！ ポケモン ゲット チャンス！" },
  { min: 3, text: "いいね！ ポケモン ゲット チャンス！" },
  { min: 4, text: "すごい！ ポケモン ゲット チャンス！" },
  { min: 5, text: "かんぺき！ ポケモン ゲット チャンス！" },
];

// ─────────────────────────────────────────
// ゲームの状態（メモリ上で管理）
// ─────────────────────────────────────────

let gameState = {
  isLegendaryMode: false,
  legendaryMilestone: 0,
  questions: [],
  currentIndex: 0,
  correctCount: 0,
  catchPokemon: null,
  currentBall: "モンスターボール",
  catchSuccess: false,
  pokedexAfterCatch: false,
  practiceDan: null,
  quizPhase: "idle",
  activeQuestion: null,
  quizInputLock: false,
};

// ─────────────────────────────────────────
// localStorage（ブラウザにデータを保存）
// ─────────────────────────────────────────
//
// 保存形式（新）：
// {
//   caughtPokemon: [{ id, ballType, caughtAt }],
//   lastLegendaryMilestone: 0,
//   mistakeHistory: [{ a, b, answer, userAnswer, dan, missedAt }],
//   totalQuestionsAnswered, totalCorrectAnswers, totalChallengeCount
// }
//
// 古い形式（caughtIds だけ）も読み込めるようにしています。

function createEmptySaveData() {
  return {
    caughtPokemon: [],
    lastLegendaryMilestone: 0,
    mistakeHistory: [],
    totalQuestionsAnswered: 0,
    totalCorrectAnswers: 0,
    totalChallengeCount: 0,
  };
}

function createAllCaughtTestSaveData(baseData) {
  const data = baseData || createEmptySaveData();
  const caughtAt = new Date().toISOString();
  const ballTypes = Object.keys(BALL_CONFIG);

  data.caughtPokemon = pokemons.map(function (pokemon, index) {
    const existing = data.caughtPokemon.find(function (item) {
      return item.id === pokemon.id;
    });

    if (existing) {
      return existing;
    }

    return {
      id: pokemon.id,
      ballType: ballTypes[index % ballTypes.length],
      caughtAt: caughtAt,
    };
  });

  data.lastLegendaryMilestone = data.caughtPokemon.length;
  return data;
}

function migrateSaveData(data) {
  const migrated = createEmptySaveData();

  if (Array.isArray(data.caughtPokemon)) {
    migrated.caughtPokemon = data.caughtPokemon;
  } else if (Array.isArray(data.caughtIds)) {
    // 古い形式 → 新しい形式へ変換
    migrated.caughtPokemon = data.caughtIds.map(function (id) {
      return {
        id: id,
        ballType: "モンスターボール",
        caughtAt: new Date().toISOString(),
      };
    });
  }

  migrated.lastLegendaryMilestone = data.lastLegendaryMilestone || 0;
  migrated.mistakeHistory = Array.isArray(data.mistakeHistory)
    ? data.mistakeHistory
    : [];
  migrated.totalQuestionsAnswered = Number(data.totalQuestionsAnswered) || 0;
  migrated.totalCorrectAnswers = Number(data.totalCorrectAnswers) || 0;
  migrated.totalChallengeCount = Number(data.totalChallengeCount) || 0;

  return migrated;
}

function loadSaveData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  let data;

  if (!raw) {
    data = createEmptySaveData();
  } else {
    try {
      data = migrateSaveData(JSON.parse(raw));
    } catch (error) {
      data = createEmptySaveData();
    }
  }

  if (ALL_CAUGHT_TEST_MODE) {
    return createAllCaughtTestSaveData(data);
  }

  return data;
}

function saveSaveData(data) {
  if (ALL_CAUGHT_TEST_MODE) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function resetSaveData() {
  localStorage.removeItem(STORAGE_KEY);
  updateHomeScreen();
}

function isLegendaryId(id) {
  return LEGENDARY_IDS.includes(id);
}

function getNormalPokemonIds() {
  return pokemons.filter(function (p) {
    return !isLegendaryId(p.id);
  }).map(function (p) {
    return p.id;
  });
}

function getUncaughtLegendaryIds() {
  const caught = getCaughtIds();
  return LEGENDARY_IDS.filter(function (id) {
    return !caught.includes(id);
  });
}

function getCaughtIds() {
  return loadSaveData().caughtPokemon.map(function (item) {
    return item.id;
  });
}

function getCaughtRecord(id) {
  return loadSaveData().caughtPokemon.find(function (item) {
    return item.id === id;
  });
}

function isCaught(id) {
  return getCaughtIds().includes(id);
}

function registerCatch(id, ballType) {
  const data = loadSaveData();
  const existing = data.caughtPokemon.find(function (item) {
    return item.id === id;
  });

  if (existing) {
    existing.ballType = ballType;
    existing.caughtAt = new Date().toISOString();
  } else {
    data.caughtPokemon.push({
      id: id,
      ballType: ballType,
      caughtAt: new Date().toISOString(),
    });
  }

  saveSaveData(data);
}

// 間違えた問題を保存する
function saveMistake(question, userAnswer) {
  const data = loadSaveData();

  data.mistakeHistory.push({
    a: question.a,
    b: question.b,
    answer: question.answer,
    userAnswer: userAnswer,
    dan: question.a,
    missedAt: new Date().toISOString(),
  });

  if (data.mistakeHistory.length > MAX_MISTAKE_STORE) {
    data.mistakeHistory = data.mistakeHistory.slice(-MAX_MISTAKE_STORE);
  }

  saveSaveData(data);
}

// 正解・不正解の累計を記録する
function recordAnswerStats(isCorrect) {
  const data = loadSaveData();
  data.totalQuestionsAnswered += 1;
  if (isCorrect) {
    data.totalCorrectAnswers += 1;
  }
  saveSaveData(data);
}

// チャレンジ完了回数を記録する
function recordChallengeComplete() {
  const data = loadSaveData();
  data.totalChallengeCount += 1;
  saveSaveData(data);
}

// ─────────────────────────────────────────
// ボール判定・ゲット成功判定
// ─────────────────────────────────────────

function getBallByScore(correctCount, totalQuestions, isLegendary) {
  if (isLegendary) {
    const rate = (correctCount / totalQuestions) * 100;

    if (rate >= 100) return "マスターボール";
    if (rate >= 80) return "プレミアボール";
    if (rate >= 60) return "ハイパーボール";
    if (rate >= 40) return "スーパーボール";
    return "モンスターボール";
  }

  if (correctCount >= 5) return "マスターボール";
  if (correctCount >= 4) return "プレミアボール";
  if (correctCount >= 3) return "ハイパーボール";
  if (correctCount >= 2) return "スーパーボール";
  return "モンスターボール";
}

function getCatchRatePercent(ballType, isLegendary) {
  const config = BALL_CONFIG[ballType] || BALL_CONFIG["モンスターボール"];
  return isLegendary ? config.legendaryRate : config.normalRate;
}

function judgeCatch(ballType, isLegendary) {
  const rate = getCatchRatePercent(ballType, isLegendary);
  return Math.random() * 100 < rate;
}

function getBallCssClass(ballType) {
  const config = BALL_CONFIG[ballType] || BALL_CONFIG["モンスターボール"];
  return "pokeball " + config.cssClass;
}

function updateQuizProgressBarClass(ballType) {
  const barFill = document.getElementById("quiz-progress-bar");
  if (!barFill) return;

  const config = BALL_CONFIG[ballType] || BALL_CONFIG["モンスターボール"];

  Object.keys(BALL_CONFIG).forEach(function (type) {
    barFill.classList.remove(BALL_CONFIG[type].barClass);
  });

  barFill.classList.add(config.barClass);
  barFill.style.background = config.barColor;
}

// ─────────────────────────────────────────
// 画像 URL（PokeAPI の公開画像）
// ─────────────────────────────────────────

function getPokemonImageCandidates(id) {
  const path = "/other/official-artwork/" + id + ".png";
  const defaultPath = "/" + id + ".png";
  return [
    "https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon" + path,
    "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon" + path,
    "https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon" + defaultPath,
    "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon" + defaultPath,
  ];
}

function getPokemonImageUrl(id) {
  return getPokemonImageCandidates(id)[0];
}

// 読み込み失敗時は別のURLを順番に試す
function setPokemonImage(img, id, options) {
  const opts = options || {};
  const candidates = getPokemonImageCandidates(id);
  let index = 0;

  img.classList.remove("pokemon-img--missing");
  if (opts.lazy) {
    img.loading = "lazy";
  } else {
    img.removeAttribute("loading");
  }

  img.onerror = function () {
    index += 1;
    if (index < candidates.length) {
      img.src = candidates[index];
      return;
    }
    img.onerror = null;
    img.classList.add("pokemon-img--missing");
  };

  img.src = candidates[0];
}

function getPokemonById(id) {
  return pokemons.find(function (p) {
    return p.id === id;
  });
}

function formatNumber(id) {
  return "No." + String(id).padStart(3, "0");
}

function formatCaughtDate(isoString) {
  if (!isoString) return "—";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "—";

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return date.getFullYear() + "年" + month + "月" + day + "日 " + hours + ":" + minutes;
}

// ─────────────────────────────────────────
// 画面切り替え
// ─────────────────────────────────────────

const screens = {
  home: document.getElementById("screen-home"),
  quiz: document.getElementById("screen-quiz"),
  summary: document.getElementById("screen-summary"),
  catch: document.getElementById("screen-catch"),
  pokedex: document.getElementById("screen-pokedex"),
  parentReport: document.getElementById("screen-parent-report"),
};

const rotomDexEl = document.querySelector(".rotom-dex");
const rotomStatusEl = document.getElementById("rotom-status");
const pcHintEl = document.getElementById("pc-keyboard-hint");
const screenInnerEl = document.querySelector(".rotom-dex__screen-inner");

const ROTOM_STATUS = {
  home: "",
  quiz: "",
  summary: "",
  catch: "",
  pokedex: "",
  parentReport: "レポート",
};

function isPcView() {
  return window.matchMedia("(min-width: 600px)").matches;
}

function setRotomStatus(text) {
  if (rotomStatusEl) rotomStatusEl.textContent = text;
}

function setRotomMood(mood) {
  if (!rotomDexEl) return;
  rotomDexEl.classList.remove("rotom-dex--happy", "rotom-dex--sad", "rotom-dex--star-eyes");
  if (mood === "happy") rotomDexEl.classList.add("rotom-dex--happy");
  if (mood === "sad") rotomDexEl.classList.add("rotom-dex--sad");
}

function setRotomStarEyes(on) {
  if (!rotomDexEl) return;
  if (on) {
    rotomDexEl.classList.add("rotom-dex--star-eyes");
    rotomDexEl.classList.remove("rotom-dex--happy", "rotom-dex--sad");
  } else {
    rotomDexEl.classList.remove("rotom-dex--star-eyes");
  }
}

function updateScreenScrollMode(screenName) {
  if (!screenInnerEl) return;
  screenInnerEl.classList.toggle(
    "rotom-dex__screen-inner--pokedex",
    screenName === "pokedex"
  );
  screenInnerEl.classList.toggle(
    "rotom-dex__screen-inner--catch",
    screenName === "catch"
  );
  screenInnerEl.classList.toggle(
    "rotom-dex__screen-inner--quiz",
    screenName === "quiz"
  );
  screenInnerEl.classList.toggle(
    "rotom-dex__screen-inner--parent-report",
    screenName === "parentReport"
  );
  screenInnerEl.classList.remove("rotom-dex__screen-inner--pokedex-detail");
}

function updatePokedexToolbar(screenName, isDetail) {
  const backBtn = document.getElementById("btn-pokedex-back");
  if (!backBtn) return;

  if (screenName === "pokedex") {
    if (gameState.pokedexAfterCatch && !isDetail) {
      backBtn.classList.add("hidden");
      return;
    }

    backBtn.classList.remove("hidden");
    backBtn.textContent = isDetail ? "← 一覧" : "← もどる";
    backBtn.setAttribute("aria-label", isDetail ? "一覧にもどる" : "ホームにもどる");
  } else if (screenName === "parentReport") {
    backBtn.classList.remove("hidden");
    backBtn.textContent = "← もどる";
    backBtn.setAttribute("aria-label", "ホームにもどる");
  } else {
    backBtn.classList.add("hidden");
  }
}

function goHomeFromLogo() {
  SoundManager.init();
  SoundManager.playTap();

  if (screens.home.classList.contains("screen--active")) {
    return;
  }

  if (screens.quiz.classList.contains("screen--active")) {
    const ok = window.confirm("チャレンジを やめて ホームにもどりますか？");
    if (!ok) return;
  }

  const detailView = document.getElementById("pokedex-detail-view");
  if (detailView && !detailView.classList.contains("hidden")) {
    hidePokedexDetail();
  }

  setPokedexAfterCatchMode(false);
  gameState.quizPhase = "answering";
  gameState.quizInputLock = false;
  gameState.activeQuestion = null;
  updateHomeScreen();
  showScreen("home");
}

function focusQuizInput() {
  const input = document.getElementById("quiz-answer");
  if (!input || input.disabled) return;
  if (!screens.quiz.classList.contains("screen--active")) return;
  input.focus({ preventScroll: true });
}

function createMiniBallIcon(ballType) {
  const ball = document.createElement("div");
  ball.className = "pokedex-card__ball-icon " + getBallCssClass(ballType);
  ball.setAttribute("aria-label", ballType + "でゲット");
  ball.innerHTML =
    '<div class="pokeball__top"></div>' +
    '<div class="pokeball__center"></div>' +
    '<div class="pokeball__bottom"></div>';
  return ball;
}

function updateKeyboardHint() {
  if (!pcHintEl) return;

  if (!isPcView()) {
    pcHintEl.classList.add("hidden");
    pcHintEl.textContent = "";
    return;
  }

  pcHintEl.classList.remove("hidden");

  if (screens.quiz.classList.contains("screen--active")) {
    const feedbackHidden = document.getElementById("quiz-feedback").classList.contains("hidden");
    if (feedbackHidden) {
      pcHintEl.textContent = "数字を入れたら Enter キー で こたえられるよ";
    } else {
      pcHintEl.textContent = "Enter キー で 次のもんだいへ";
    }
    return;
  }

  if (screens.summary.classList.contains("screen--active")) {
    pcHintEl.textContent = "Enter キー で ゲット チャンスへ！";
    return;
  }

  if (screens.catch.classList.contains("screen--active")) {
    const actionsHidden = document.getElementById("catch-actions").classList.contains("hidden");
    const catchHint = document.getElementById("catch-enter-hint");
    if (!actionsHidden) {
      if (catchHint) catchHint.classList.toggle("hidden", !isPcView());
      pcHintEl.textContent = gameState.catchSuccess
        ? "Enter キー で ずかんを見る"
        : "Enter キー で ホームにもどる";
      return;
    }
    if (catchHint) catchHint.classList.add("hidden");
  }

  if (screens.pokedex.classList.contains("screen--active")) {
    const inDetail = !document.getElementById("pokedex-detail-view").classList.contains("hidden");
    if (gameState.pokedexAfterCatch && !inDetail) {
      pcHintEl.textContent = "Enter キー で もう一回！";
      return;
    }
  }

  pcHintEl.classList.add("hidden");
}

function showScreen(name) {
  Object.keys(screens).forEach(function (key) {
    const screen = screens[key];
    const isActive = key === name;
    screen.classList.toggle("screen--active", isActive);
    screen.hidden = !isActive;
  });

  setRotomStatus(ROTOM_STATUS[name] || "");
  setRotomMood("normal");
  setRotomStarEyes(false);
  updateScreenScrollMode(name);
  updatePokedexToolbar(name, false);
  updateKeyboardHint();

  if (name === "quiz") {
    SoundManager.updateScreenBgm("quiz", {
      legendary: gameState.isLegendaryMode,
    });
  } else if (name === "home") {
    SoundManager.updateScreenBgm("home");
  } else if (name === "summary") {
    SoundManager.updateScreenBgm("summary");
  } else if (name === "catch") {
    SoundManager.updateScreenBgm("catch");
  } else {
    SoundManager.updateScreenBgm("");
  }
}

// ─────────────────────────────────────────
// にがてリスト
// ─────────────────────────────────────────

function analyzeMistakeTrend(history) {
  if (history.length === 0) {
    return "";
  }

  const danCounts = {};

  history.forEach(function (item) {
    danCounts[item.dan] = (danCounts[item.dan] || 0) + 1;
  });

  let topDan = history[0].dan;
  let topCount = 0;

  Object.keys(danCounts).forEach(function (dan) {
    if (danCounts[dan] > topCount) {
      topCount = danCounts[dan];
      topDan = Number(dan);
    }
  });

  if (topCount >= 2) {
    return (
      topDan +
      "の段が 少し むずかしそう。\nつぎは " +
      topDan +
      "の段を 練習してみよう！"
    );
  }

  return "間違えた問題を もう一度 考えてみよう！";
}

function renderMistakeList(listElementId, tipElementId, maxDisplay) {
  const limit = maxDisplay || MAX_MISTAKE_DISPLAY;
  const listEl = document.getElementById(listElementId);
  const tipEl = document.getElementById(tipElementId);
  const history = loadSaveData().mistakeHistory.slice(-limit).reverse();

  listEl.innerHTML = "";

  if (history.length === 0) {
    listEl.innerHTML = '<p class="mistake-section__empty">まだ にがては ないよ。がんばろう！</p>';
    tipEl.textContent = "";
    return;
  }

  history.forEach(function (item) {
    const row = document.createElement("div");
    row.className = "mistake-item";

    const formula = document.createElement("span");
    formula.className = "mistake-item__formula";
    formula.textContent = item.a + " × " + item.b + " = " + item.answer;

    const user = document.createElement("span");
    user.className = "mistake-item__answer";
    user.textContent = "こたえ：" + item.userAnswer;

    row.appendChild(formula);
    row.appendChild(user);
    listEl.appendChild(row);
  });

  tipEl.textContent = analyzeMistakeTrend(loadSaveData().mistakeHistory);
}

// ─────────────────────────────────────────
// 親向けレポート
// ─────────────────────────────────────────

function getDanCounts(history) {
  const counts = {};

  for (let dan = 1; dan <= 9; dan++) {
    counts[dan] = 0;
  }

  history.forEach(function (item) {
    const dan = Number(item.dan || item.a);
    if (dan >= 1 && dan <= 9) {
      counts[dan] += 1;
    }
  });

  return counts;
}

function getWeakDan(history) {
  const danCounts = getDanCounts(history || []);
  let topDan = null;
  let topCount = 0;

  Object.keys(danCounts).forEach(function (dan) {
    const count = danCounts[dan];
    if (count > topCount) {
      topCount = count;
      topDan = Number(dan);
    }
  });

  if (topCount === 0) {
    return { dan: null, count: 0, danCounts: danCounts };
  }

  return { dan: topDan, count: topCount, danCounts: danCounts };
}

function getMistakeRanking(history, limit) {
  const maxItems = limit || 5;
  const counts = {};

  (history || []).forEach(function (item) {
    const key = item.a + "×" + item.b;
    if (!counts[key]) {
      counts[key] = {
        a: item.a,
        b: item.b,
        answer: item.answer,
        count: 0,
      };
    }
    counts[key].count += 1;
  });

  return Object.keys(counts)
    .map(function (key) {
      return counts[key];
    })
    .sort(function (a, b) {
      return b.count - a.count;
    })
    .slice(0, maxItems);
}

function getWeakDanPracticeExamples(dan, history) {
  if (!dan) return [];

  const inDan = (history || []).filter(function (item) {
    return Number(item.a) === dan;
  });
  const ranking = getMistakeRanking(inDan, 3);

  return ranking.map(function (item) {
    return item.a + "×" + item.b;
  });
}

function getParentAdvice(reportData) {
  const advice = [];
  const history = reportData.mistakeHistory;
  const weak = reportData.weakDan;
  const ranking = reportData.ranking;

  if (history.length === 0) {
    advice.push("まだ間違いデータが少ないので、まずはいつもどおり チャレンジを楽しんでもらうのがおすすめです。");
    advice.push("小さな がんばりも ほめてあげると、九九への 意欲が 続きやすくなります。");
    return advice;
  }

  if (weak.dan && weak.count >= 2) {
    advice.push(
      weak.dan +
        "の段は 覚えにくいことが 多いので、毎日 3問だけ 練習するのが おすすめです。"
    );
  }

  const closeMistakes = history.filter(function (item) {
    const diff = Math.abs(Number(item.userAnswer) - Number(item.answer));
    return diff > 0 && diff <= 2;
  });

  if (closeMistakes.length >= 2) {
    advice.push("答えが 近い 間違いが 多い場合は、九九を 声に出して 確認すると よさそうです。");
  }

  if (ranking.length > 0 && ranking[0].count >= 2) {
    advice.push(
      "同じ問題で つまずいているので、カードや 紙に 書いて 見える 場所に 置くと 効果的です。"
    );
  }

  if (reportData.accuracyRate >= 80) {
    advice.push("正解率が 高い日は、褒める タイミングとして 使えます。");
  }

  if (advice.length === 0) {
    advice.push("間違えた問題を 一緒に 見返すと、次の チャレンジで 自信が つきやすくなります。");
    advice.push("短い 時間でも 毎日 続けると、九九は 自然と 身についていきます。");
  }

  return advice;
}

function getParentReportData() {
  const data = loadSaveData();
  const history = data.mistakeHistory || [];
  const weak = getWeakDan(history);
  const ranking = getMistakeRanking(history, 5);
  const incorrectCount = data.totalQuestionsAnswered - data.totalCorrectAnswers;
  const accuracyRate =
    data.totalQuestionsAnswered > 0
      ? Math.round((data.totalCorrectAnswers / data.totalQuestionsAnswered) * 100)
      : 0;

  return {
    totalChallengeCount: data.totalChallengeCount,
    totalQuestionsAnswered: data.totalQuestionsAnswered,
    totalCorrectAnswers: data.totalCorrectAnswers,
    incorrectCount: incorrectCount,
    accuracyRate: accuracyRate,
    caughtCount: getCaughtIds().length,
    mistakeHistory: history,
    recentMistakes: history.slice(-MAX_MISTAKE_DISPLAY).reverse(),
    weakDan: weak,
    ranking: ranking,
    practiceExamples: getWeakDanPracticeExamples(weak.dan, history),
    advice: [],
  };
}

function renderParentReportOverview(reportData) {
  const overviewEl = document.getElementById("parent-report-overview");
  if (!overviewEl) return;

  const stats = [
    { label: "総チャレンジ回数", value: reportData.totalChallengeCount + " 回" },
    { label: "解いた問題数", value: reportData.totalQuestionsAnswered + " 問" },
    { label: "正解数", value: reportData.totalCorrectAnswers + " 問" },
    { label: "不正解数", value: reportData.incorrectCount + " 問" },
    { label: "正解率", value: reportData.accuracyRate + " %" },
    { label: "ゲット済み", value: reportData.caughtCount + " / " + TOTAL_POKEMON },
  ];

  overviewEl.innerHTML = "";

  stats.forEach(function (stat) {
    const item = document.createElement("div");
    item.className = "parent-report__stat";

    const label = document.createElement("p");
    label.className = "parent-report__stat-label";
    label.textContent = stat.label;

    const value = document.createElement("p");
    value.className = "parent-report__stat-value";
    value.textContent = stat.value;

    item.appendChild(label);
    item.appendChild(value);
    overviewEl.appendChild(item);
  });
}

function renderParentReportRecent(reportData) {
  const recentEl = document.getElementById("parent-report-recent");
  if (!recentEl) return;

  recentEl.innerHTML = "";

  if (reportData.recentMistakes.length === 0) {
    recentEl.innerHTML =
      '<p class="parent-report__empty">まだ 間違いデータが ありません。チャレンジを 続けると ここに 表示されます。</p>';
    return;
  }

  reportData.recentMistakes.forEach(function (item) {
    const row = document.createElement("article");
    row.className = "parent-report__recent-item";

    const formula = document.createElement("p");
    formula.className = "parent-report__recent-formula";
    formula.textContent = "問題：" + item.a + " × " + item.b;

    const correct = document.createElement("p");
    correct.className = "parent-report__recent-meta";
    correct.textContent = "正しい答え：" + item.answer;

    const user = document.createElement("p");
    user.className = "parent-report__recent-meta";
    user.textContent = "入力した答え：" + item.userAnswer;

    const dan = document.createElement("p");
    dan.className = "parent-report__recent-meta";
    dan.textContent = "段：" + (item.dan || item.a) + "の段";

    const date = document.createElement("p");
    date.className = "parent-report__recent-date";
    date.textContent = "日時：" + formatCaughtDate(item.missedAt);

    row.appendChild(formula);
    row.appendChild(correct);
    row.appendChild(user);
    row.appendChild(dan);
    row.appendChild(date);
    recentEl.appendChild(row);
  });
}

function renderParentReportDanChart(reportData) {
  const chartEl = document.getElementById("parent-report-dan-chart");
  const focusEl = document.getElementById("parent-report-focus");
  if (!chartEl || !focusEl) return;

  chartEl.innerHTML = "";
  focusEl.textContent = "";

  const danCounts = reportData.weakDan.danCounts;
  const sortedDans = Object.keys(danCounts)
    .map(function (dan) {
      return { dan: Number(dan), count: danCounts[dan] };
    })
    .sort(function (a, b) {
      return b.count - a.count;
    });

  const maxCount = Math.max.apply(
    null,
    sortedDans.map(function (item) {
      return item.count;
    }).concat([1])
  );

  if (reportData.mistakeHistory.length === 0) {
    chartEl.innerHTML =
      '<p class="parent-report__empty">まだ 間違いデータが ないため、段ごとの 傾向は 表示できません。</p>';
    focusEl.textContent = "チャレンジが 進むと、重点的に 練習したい 段が ここに 表示されます。";
    return;
  }

  sortedDans.forEach(function (item) {
    const row = document.createElement("div");
    row.className = "parent-report__chart-row";

    const label = document.createElement("span");
    label.className = "parent-report__chart-label";
    label.textContent = item.dan + "の段";

    const track = document.createElement("div");
    track.className = "parent-report__chart-track";
    track.setAttribute("aria-hidden", "true");

    const bar = document.createElement("div");
    bar.className = "parent-report__chart-bar";
    bar.style.width = Math.round((item.count / maxCount) * 100) + "%";

    const count = document.createElement("span");
    count.className = "parent-report__chart-count";
    count.textContent = item.count + " 回";

    track.appendChild(bar);
    row.appendChild(label);
    row.appendChild(track);
    row.appendChild(count);
    chartEl.appendChild(row);
  });

  if (reportData.weakDan.dan) {
    const examples = reportData.practiceExamples;
    let focusText =
      reportData.weakDan.dan +
      "の段で つまずきが 多いようです。";

    if (examples.length > 0) {
      focusText +=
        " まずは " +
        examples.join("、") +
        " を 中心に 練習すると よさそうです。";
    } else {
      focusText +=
        " まずは " +
        reportData.weakDan.dan +
        "の段を 中心に 練習すると よさそうです。";
    }

    focusEl.textContent = "今週の重点練習候補：" + focusText;
  } else {
    focusEl.textContent = "まだ 特定の段に 偏りは 見られません。";
  }
}

function renderParentReportRanking(reportData) {
  const rankingEl = document.getElementById("parent-report-ranking");
  if (!rankingEl) return;

  rankingEl.innerHTML = "";

  if (reportData.ranking.length === 0) {
    rankingEl.innerHTML =
      '<li class="parent-report__empty">まだ ランキングを 作れる データが ありません。</li>';
    return;
  }

  reportData.ranking.forEach(function (item, index) {
    const li = document.createElement("li");
    li.className = "parent-report__ranking-item";
    li.textContent =
      index +
      1 +
      "位：" +
      item.a +
      " × " +
      item.b +
      "：" +
      item.count +
      "回";
    rankingEl.appendChild(li);
  });
}

function renderParentReportAdvice(reportData) {
  const adviceEl = document.getElementById("parent-report-advice");
  if (!adviceEl) return;

  const adviceList = getParentAdvice(reportData);
  adviceEl.innerHTML = "";

  adviceList.forEach(function (text) {
    const li = document.createElement("li");
    li.className = "parent-report__advice-item";
    li.textContent = text;
    adviceEl.appendChild(li);
  });
}

function renderParentReport() {
  const reportData = getParentReportData();
  reportData.advice = getParentAdvice(reportData);

  renderParentReportOverview(reportData);
  renderParentReportDanChart(reportData);
  renderParentReportRecent(reportData);
  renderParentReportRanking(reportData);
  renderParentReportAdvice(reportData);

  const recentPanel = document.getElementById("parent-report-recent-panel");
  if (recentPanel) {
    recentPanel.open = false;
  }
}

function openParentReport() {
  SoundManager.init();
  SoundManager.playTap();
  renderParentReport();
  showScreen("parentReport");
}

// ─────────────────────────────────────────
// ホーム画面
// ─────────────────────────────────────────

function updateHomeScreen() {
  const caughtCount = getCaughtIds().length;
  const percent = (caughtCount / TOTAL_POKEMON) * 100;

  document.getElementById("home-caught-count").textContent = caughtCount;
  document.getElementById("home-progress-bar").style.width = percent + "%";

  const totalLabel = document.querySelector(".stats-card__total");
  if (totalLabel) totalLabel.textContent = "/ " + TOTAL_POKEMON;

  const legendaryNotice = document.getElementById("legendary-notice");
  const isLegendary = shouldStartLegendary();

  legendaryNotice.classList.toggle("hidden", !isLegendary);

  const startBtn = document.getElementById("btn-start");
  startBtn.textContent = isLegendary ? "伝説チャレンジ開始！" : "チャレンジ開始！";

  renderMistakeList("home-mistake-list", "home-mistake-tip", 3);

  const homeTip = document.querySelector(".home-tip");
  if (homeTip) {
    homeTip.textContent =
      "5もん → ゲット ／ " + LEGENDARY_CATCH_INTERVAL + "ひき → 伝説！";
  }

  const legendaryNoticeText = document.querySelector("#legendary-notice p");
  if (legendaryNoticeText && isLegendary) {
    legendaryNoticeText.innerHTML =
      "伝説のポケモンが あらわれた！<br>次は <strong>10もん</strong> チャレンジ！";
  }
}

function shouldStartLegendary() {
  if (getUncaughtLegendaryIds().length === 0) return false;

  // テスト用：未ゲットの伝説がいれば常に伝説チャレンジ
  if (LEGENDARY_TEST_MODE) return true;

  const data = loadSaveData();
  const count = data.caughtPokemon.length;

  if (count < LEGENDARY_CATCH_INTERVAL) return false;
  if (count % LEGENDARY_CATCH_INTERVAL !== 0) return false;

  return data.lastLegendaryMilestone < count;
}

// ─────────────────────────────────────────
// 掛け算問題
// ─────────────────────────────────────────

function createQuestion() {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  return { a: a, b: b, answer: a * b };
}

function createQuestionForDan(dan) {
  const b = Math.floor(Math.random() * 9) + 1;
  return { a: dan, b: b, answer: dan * b };
}

function createQuestionSet(count, practiceDan) {
  const list = [];

  for (let i = 0; i < count; i++) {
    if (practiceDan) {
      list.push(createQuestionForDan(practiceDan));
    } else {
      list.push(createQuestion());
    }
  }

  return list;
}

function startQuiz(isLegendary, options) {
  const opts = options || {};
  SoundManager.init();
  SoundManager.playTap();

  gameState.isLegendaryMode = isLegendary;
  gameState.legendaryMilestone = isLegendary ? getCaughtIds().length : 0;
  gameState.correctCount = 0;
  gameState.currentIndex = 0;
  gameState.quizPhase = "answering";
  gameState.activeQuestion = null;
  gameState.quizInputLock = false;
  gameState.practiceDan = opts.practiceDan || null;
  gameState.questions = createQuestionSet(
    isLegendary ? LEGENDARY_QUESTIONS : NORMAL_QUESTIONS,
    gameState.practiceDan
  );

  const modeLabel = document.getElementById("quiz-mode-label");
  if (gameState.practiceDan) {
    modeLabel.textContent = gameState.practiceDan + "の段 練習チャレンジ";
    modeLabel.classList.remove("quiz-header__mode--legendary");
  } else if (isLegendary) {
    modeLabel.textContent = "✨ 伝説チャレンジ ✨";
    modeLabel.classList.add("quiz-header__mode--legendary");
  } else {
    modeLabel.textContent = "通常チャレンジ";
    modeLabel.classList.remove("quiz-header__mode--legendary");
  }

  document.getElementById("quiz-feedback").classList.add("hidden");
  document.getElementById("quiz-form").classList.remove("hidden");

  setRotomStatus("");
  showScreen("quiz");
  renderCurrentQuestion();
}

function renderQuestionPrompt(q) {
  const questionEl = document.getElementById("quiz-question");
  questionEl.textContent = q.a + " × " + q.b + " = ?";
  questionEl.className = "quiz-question";
  updateKukuReading(q.a, q.b);
}

function updateKukuReading(a, b) {
  const readingEl = document.getElementById("quiz-kuku-reading");
  if (!readingEl) return;

  const reading = getProblemKukuReading(a, b);
  if (!reading) {
    readingEl.textContent = "";
    readingEl.classList.add("hidden");
    readingEl.setAttribute("aria-hidden", "true");
    return;
  }

  readingEl.textContent = reading;
  readingEl.classList.remove("hidden");
  readingEl.setAttribute("aria-hidden", "false");
}

function renderQuestionResult(q, isCorrect, userAnswer) {
  const questionEl = document.getElementById("quiz-question");
  updateKukuReading(q.a, q.b);

  if (isCorrect) {
    questionEl.textContent = q.a + " × " + q.b + " = " + q.answer;
    questionEl.className = "quiz-question quiz-question--correct";
    return;
  }

  const wrongText = Number.isFinite(userAnswer) ? String(userAnswer) : "?";
  questionEl.innerHTML =
    q.a +
    " × " +
    q.b +
    " = " +
    '<span class="quiz-question__wrong-num">' +
    wrongText +
    "</span>" +
    ' <span class="quiz-question__arrow">→</span> ' +
    '<span class="quiz-question__correct-num">' +
    q.answer +
    "</span>";
  questionEl.className = "quiz-question quiz-question--wrong";
}

// 進捗バー：正解数に応じてたまる。色はその時点のボール色
function updateQuizProgressUI() {
  const total = gameState.questions.length;
  if (total <= 0) return;

  const correctCount = gameState.correctCount;
  const percent = Math.round((correctCount / total) * 100);
  const ballType = getBallByScore(correctCount, total, gameState.isLegendaryMode);

  document.getElementById("quiz-progress").textContent =
    "せいかい " + correctCount + " / " + total;
  document.getElementById("quiz-progress-bar").style.width = percent + "%";
  updateQuizProgressBarClass(ballType);
}

function renderCurrentQuestion() {
  const total = gameState.questions.length;
  const index = gameState.currentIndex;
  const q = gameState.questions[index];
  const mainEl = document.querySelector(".quiz-screen__main");

  gameState.quizPhase = "answering";
  gameState.activeQuestion = q;
  gameState.quizInputLock = false;

  updateQuizProgressUI();
  renderQuestionPrompt(q);

  const input = document.getElementById("quiz-answer");
  input.value = "";
  input.disabled = false;

  if (mainEl) mainEl.classList.remove("quiz-screen__main--feedback");
  document.getElementById("quiz-form").classList.remove("hidden");
  document.getElementById("quiz-feedback").classList.add("hidden");
  updateKeyboardHint();

  requestAnimationFrame(function () {
    requestAnimationFrame(focusQuizInput);
  });
  setTimeout(focusQuizInput, 80);
}

function handleAnswerSubmit(event) {
  event.preventDefault();
  SoundManager.init();

  if (gameState.quizPhase !== "answering" || gameState.quizInputLock) {
    return;
  }

  const input = document.getElementById("quiz-answer");
  const userAnswer = Number(input.value);
  const q = gameState.activeQuestion;

  if (!q) {
    return;
  }

  gameState.quizInputLock = true;
  gameState.quizPhase = "feedback";

  const isCorrect = userAnswer === q.answer;

  if (isCorrect) {
    gameState.correctCount += 1;
    recordAnswerStats(true);
    SoundManager.playCorrect();
  } else {
    saveMistake(q, userAnswer);
    recordAnswerStats(false);
    SoundManager.playWrong();
  }

  input.disabled = true;
  document.getElementById("quiz-form").classList.add("hidden");

  const mainEl = document.querySelector(".quiz-screen__main");
  if (mainEl) mainEl.classList.add("quiz-screen__main--feedback");

  const feedback = document.getElementById("quiz-feedback");
  const feedbackText = document.getElementById("quiz-feedback-text");
  const feedbackAnswer = document.getElementById("quiz-feedback-answer");

  renderQuestionResult(q, isCorrect, userAnswer);
  feedback.classList.remove("hidden");
  feedbackAnswer.classList.add("hidden");
  feedbackAnswer.textContent = "";

  if (isCorrect) {
    setRotomMood("happy");
    setRotomStatus("");
    feedbackText.textContent = "せいかい！";
    feedbackText.className = "quiz-feedback__text quiz-feedback__text--correct";
  } else {
    setRotomMood("sad");
    setRotomStatus("");
    feedbackText.textContent = "おしい！";
    feedbackText.className = "quiz-feedback__text quiz-feedback__text--wrong";
  }

  updateQuizProgressUI();
  updateKeyboardHint();

  // Enter送信直後にフォーカスが移ると「次へ」も押されることがあるので少し遅らせる
  setTimeout(function () {
    gameState.quizInputLock = false;
    const nextBtn = document.getElementById("btn-next-question");
    if (nextBtn && gameState.quizPhase === "feedback") {
      nextBtn.focus({ preventScroll: true });
    }
  }, 120);
}

function goNextQuestion() {
  if (gameState.quizPhase !== "feedback") {
    return;
  }

  SoundManager.playTap();
  gameState.currentIndex += 1;

  if (gameState.currentIndex >= gameState.questions.length) {
    showSummary();
    return;
  }

  renderCurrentQuestion();
}

// ─────────────────────────────────────────
// 結果サマリー
// ─────────────────────────────────────────

function showSummary() {
  recordChallengeComplete();

  const total = gameState.questions.length;
  const correct = gameState.correctCount;
  const ball = getBallByScore(correct, total, gameState.isLegendaryMode);
  const catchRate = getCatchRatePercent(ball, gameState.isLegendaryMode);

  gameState.currentBall = ball;

  document.getElementById("summary-score").textContent =
    total + "問中 " + correct + "問 正解！";

  let message = SCORE_MESSAGES[0].text;
  const scaledCorrect = Math.round((correct / total) * 5);

  SCORE_MESSAGES.forEach(function (item) {
    if (scaledCorrect >= item.min) {
      message = item.text;
    }
  });

  if (!gameState.isLegendaryMode && correct === 0) {
    message = "チャレンジしたことが えらい！ ポケモン ゲット チャンス！";
  }

  if (gameState.isLegendaryMode) {
    message = "伝説チャレンジ おつかれさま！ " + message;
  }

  document.getElementById("summary-message").textContent = message;
  document.getElementById("summary-ball").textContent = ball + "が 使えるよ";
  document.getElementById("summary-rate").textContent =
    "ゲットできる 確率：" + catchRate + "%";

  const starsEl = document.getElementById("summary-stars");
  starsEl.innerHTML = "";

  const starCount = Math.max(1, Math.ceil((correct / total) * 5));

  for (let i = 0; i < starCount; i++) {
    const star = document.createElement("span");
    star.textContent = "⭐";
    starsEl.appendChild(star);
  }

  SoundManager.playSummary();
  showScreen("summary");
  document.getElementById("btn-go-catch").focus();
}

// ─────────────────────────────────────────
// ポケモン選び
// ─────────────────────────────────────────

function pickCatchPokemon() {
  const caught = getCaughtIds();

  if (gameState.isLegendaryMode) {
    const pool = getUncaughtLegendaryIds();
    const ids = pool.length > 0 ? pool : LEGENDARY_IDS;
    const id = ids[Math.floor(Math.random() * ids.length)];
    return getPokemonById(id);
  }

  const normalIds = getNormalPokemonIds();
  const normalPool = normalIds.filter(function (id) {
    return !caught.includes(id);
  });

  let id;

  if (normalPool.length > 0) {
    id = normalPool[Math.floor(Math.random() * normalPool.length)];
  } else {
    id = normalIds[Math.floor(Math.random() * normalIds.length)];
  }

  return getPokemonById(id);
}

// ─────────────────────────────────────────
// ゲット演出
// ─────────────────────────────────────────

function startCatchScene() {
  SoundManager.init();
  SoundManager.playTap();

  gameState.catchPokemon = pickCatchPokemon();
  gameState.catchSuccess = judgeCatch(
    gameState.currentBall,
    gameState.isLegendaryMode
  );

  const scene = document.getElementById("catch-scene");
  const throwPhase = document.getElementById("catch-phase-throw");
  const ball = document.getElementById("pokeball");
  const flash = document.getElementById("catch-flash");
  const result = document.getElementById("catch-result");
  const fail = document.getElementById("catch-fail");
  const actions = document.getElementById("catch-actions");
  const label = document.getElementById("catch-label");
  const ballLabel = document.getElementById("catch-ball-label");

  scene.classList.toggle("catch-scene--legendary", gameState.isLegendaryMode);
  throwPhase.classList.remove("hidden");
  ball.className = getBallCssClass(gameState.currentBall);
  ball.classList.remove("hidden", "pokeball--throw", "pokeball--shake", "pokeball--open", "pokeball--fail-shake");
  flash.classList.add("hidden");
  result.classList.add("hidden");
  fail.classList.add("hidden");
  actions.classList.add("hidden");
  document.getElementById("catch-enter-hint").classList.add("hidden");

  label.textContent = gameState.isLegendaryMode
    ? "✨ 伝説のポケモンが あらわれた！ ✨"
    : "ポケモンを つかまえよう！";
  ballLabel.textContent = "今回は " + gameState.currentBall + "！";

  const targetImg = document.getElementById("catch-target-pokemon");
  if (gameState.catchPokemon && targetImg) {
    setPokemonImage(targetImg, gameState.catchPokemon.id);
    targetImg.alt = gameState.catchPokemon.name;
    targetImg.classList.remove("catch-target-pokemon--hide");
  }

  showScreen("catch");
  updatePokedexToolbar("catch", false);

  ball.classList.add("pokeball--throw");

  setTimeout(function () {
    ball.classList.remove("pokeball--throw");
    ball.classList.add("pokeball--shake");
    SoundManager.playBallShake();
    if (targetImg) targetImg.classList.add("catch-target-pokemon--hide");
    setTimeout(function () {
      SoundManager.playBallShake();
    }, 500);
    setTimeout(function () {
      SoundManager.playBallShake();
    }, 1000);
  }, 900);

  setTimeout(function () {
    ball.classList.remove("pokeball--shake");

    if (gameState.catchSuccess) {
      ball.classList.add("pokeball--open");
      flash.classList.remove("hidden");
    } else {
      ball.classList.add("pokeball--fail-shake");
    }
  }, 2400);

  setTimeout(function () {
    if (gameState.catchSuccess) {
      revealCatchResult();
    } else {
      revealCatchFail();
    }
  }, 3000);
}

function revealCatchResult() {
  const pokemon = gameState.catchPokemon;
  if (!pokemon) return;

  SoundManager.playCatchSuccess();
  registerCatch(pokemon.id, gameState.currentBall);

  if (gameState.isLegendaryMode) {
    const data = loadSaveData();
    data.lastLegendaryMilestone = gameState.legendaryMilestone;
    saveSaveData(data);
  }

  document.getElementById("catch-phase-throw").classList.add("hidden");
  document.getElementById("pokeball").classList.add("hidden");

  document.getElementById("catch-title").textContent =
    "やった！ " + pokemon.name + " を ゲット！";
  setPokemonImage(document.getElementById("catch-image"), pokemon.id);
  document.getElementById("catch-image").alt = pokemon.name;
  document.getElementById("catch-name").textContent = formatNumber(pokemon.id);

  document.getElementById("catch-result").classList.remove("hidden");
  showCatchActions();
  setupCatchActionButton("pokedex");
  setRotomStarEyes(true);

  const resultEl = document.getElementById("catch-result");
  resultEl.classList.remove("catch-result--replay");
  void resultEl.offsetWidth;
  resultEl.classList.add("catch-result--replay");
}

function revealCatchFail() {
  SoundManager.playCatchFail();
  document.getElementById("catch-phase-throw").classList.add("hidden");
  document.getElementById("pokeball").classList.add("hidden");
  document.getElementById("catch-fail").classList.remove("hidden");
  showCatchActions();
  setupCatchActionButton("home");
}

function setupCatchActionButton(mode) {
  const btn = document.getElementById("btn-catch-pokedex");
  const hint = document.getElementById("catch-enter-hint");
  if (!btn) return;

  if (mode === "home") {
    btn.textContent = "ホームにもどる";
    if (hint) {
      hint.textContent = "Enter キー でも OK";
    }
  } else {
    btn.textContent = "ずかんを見る";
    if (hint) {
      hint.textContent = "Enter キー でも OK";
    }
  }
}

function showCatchActions() {
  const actions = document.getElementById("catch-actions");
  const hint = document.getElementById("catch-enter-hint");
  actions.classList.remove("hidden");
  if (hint && isPcView()) {
    hint.classList.remove("hidden");
  } else if (hint) {
    hint.classList.add("hidden");
  }
  updateKeyboardHint();
  const btn = document.getElementById("btn-catch-pokedex");
  if (btn) btn.focus({ preventScroll: true });
}

function scrollPokedexToPokemon(pokemonId) {
  const scrollArea = document.querySelector(".pokedex-scroll-area");
  const card = document.querySelector(
    '.pokedex-card[data-pokemon-id="' + pokemonId + '"]'
  );
  if (!scrollArea || !card) return;

  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      const areaRect = scrollArea.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const targetTop =
        scrollArea.scrollTop +
        (cardRect.top - areaRect.top) -
        areaRect.height / 2 +
        cardRect.height / 2;
      scrollArea.scrollTop = Math.max(0, targetTop);
      card.classList.add("pokedex-card--highlight");
      setTimeout(function () {
        card.classList.remove("pokedex-card--highlight");
      }, 1200);
    });
  });
}

// ─────────────────────────────────────────
// 図鑑
// ─────────────────────────────────────────

const TYPE_STYLES = {
  "ほのお": { bg: "#EE8130", color: "#fff" },
  "みず": { bg: "#6390F0", color: "#fff" },
  "くさ": { bg: "#7AC74C", color: "#fff" },
  "でんき": { bg: "#F7D02C", color: "#3d3200" },
  "こおり": { bg: "#96D9D6", color: "#1a4544" },
  "かくとう": { bg: "#C22E28", color: "#fff" },
  "どく": { bg: "#A33EA1", color: "#fff" },
  "じめん": { bg: "#E2BF65", color: "#4a3b10" },
  "ひこう": { bg: "#A98FF3", color: "#fff" },
  "エスパー": { bg: "#F95587", color: "#fff" },
  "むし": { bg: "#A6B91A", color: "#fff" },
  "いわ": { bg: "#B6A136", color: "#fff" },
  "ゴースト": { bg: "#735797", color: "#fff" },
  "ドラゴン": { bg: "#6F35FC", color: "#fff" },
  "あく": { bg: "#705746", color: "#fff" },
  "はがね": { bg: "#B7B7CE", color: "#333" },
  "フェアリー": { bg: "#D685AD", color: "#fff" },
  "ノーマル": { bg: "#A8A878", color: "#fff" }
};

function renderTypeBadges(container, types) {
  container.innerHTML = "";
  types.forEach(function (type) {
    const badge = document.createElement("span");
    const style = TYPE_STYLES[type] || { bg: "#919AA2", color: "#fff" };
    badge.className = "type-badge";
    badge.textContent = type;
    badge.style.background = style.bg;
    badge.style.color = style.color;
    badge.style.borderColor = style.bg;
    container.appendChild(badge);
  });
}

function setPokedexAfterCatchMode(isAfterCatch) {
  gameState.pokedexAfterCatch = isAfterCatch;
  const footer = document.getElementById("pokedex-footer-actions");
  if (!footer) return;

  const inDetail = !document.getElementById("pokedex-detail-view").classList.contains("hidden");
  footer.classList.toggle("hidden", !isAfterCatch || inDetail);

  if (screens.pokedex.classList.contains("screen--active")) {
    updatePokedexToolbar("pokedex", inDetail);
  }

  updateKeyboardHint();
}

function hidePokedexDetail() {
  document.getElementById("pokedex-detail-view").classList.add("hidden");
  document.getElementById("pokedex-list-view").classList.remove("hidden");
  if (screenInnerEl) {
    screenInnerEl.classList.remove("rotom-dex__screen-inner--pokedex-detail");
  }
  updatePokedexToolbar("pokedex", false);
  setPokedexAfterCatchMode(gameState.pokedexAfterCatch);
}

function showPokedexDetail(pokemonId) {
  const pokemon = getPokemonById(pokemonId);
  if (!pokemon) return;

  SoundManager.playTap();

  const caughtFlag = getCaughtIds().includes(pokemonId);
  const record = getCaughtRecord(pokemonId);
  const img = document.getElementById("detail-image");
  const desc = document.getElementById("detail-description");

  document.getElementById("pokedex-list-view").classList.add("hidden");
  document.getElementById("pokedex-detail-view").classList.remove("hidden");
  if (screenInnerEl) {
    screenInnerEl.classList.add("rotom-dex__screen-inner--pokedex-detail");
  }
  updatePokedexToolbar("pokedex", true);

  setPokemonImage(img, pokemon.id);
  document.getElementById("detail-number").textContent = formatNumber(pokemon.id);

  if (caughtFlag) {
    img.alt = pokemon.name;
    img.classList.remove("pokedex-detail__img--unknown");
    document.getElementById("detail-name").textContent = pokemon.name;
    renderTypeBadges(document.getElementById("detail-types"), pokemon.types);
    desc.textContent = pokemon.description;
    desc.classList.remove("pokedex-detail__unknown-msg");

    if (record) {
      document.getElementById("detail-date-row").classList.remove("hidden");
      document.getElementById("detail-date").textContent = formatCaughtDate(record.caughtAt);
      document.getElementById("detail-ball-row").classList.remove("hidden");
      document.getElementById("detail-ball").textContent =
        record.ballType + "で ゲット！";
    } else {
      document.getElementById("detail-date-row").classList.add("hidden");
      document.getElementById("detail-ball-row").classList.add("hidden");
    }
  } else {
    img.alt = "未ゲット";
    img.classList.add("pokedex-detail__img--unknown");
    document.getElementById("detail-name").textContent = "？？？";
    document.getElementById("detail-types").innerHTML =
      '<span class="type-badge type-badge--unknown">？？？</span>';
    desc.textContent = "まだ ゲットしていない ポケモンだよ";
    desc.classList.add("pokedex-detail__unknown-msg");
    document.getElementById("detail-date-row").classList.add("hidden");
    document.getElementById("detail-ball-row").classList.add("hidden");
  }

  setPokedexAfterCatchMode(gameState.pokedexAfterCatch);
}

function renderPokedex(scrollToPokemonId) {
  hidePokedexDetail();

  const caughtIds = getCaughtIds();
  const grid = document.getElementById("pokedex-grid");
  grid.innerHTML = "";

  document.getElementById("pokedex-count").textContent =
    caughtIds.length + " / " + TOTAL_POKEMON;

  pokemons.forEach(function (pokemon) {
    const caughtFlag = caughtIds.includes(pokemon.id);
    const record = getCaughtRecord(pokemon.id);
    const card = document.createElement("article");
    card.className =
      "pokedex-card " + (caughtFlag ? "pokedex-card--caught" : "pokedex-card--unknown");
    card.setAttribute("data-pokemon-id", String(pokemon.id));

    const number = document.createElement("p");
    number.className = "pokedex-card__number";
    number.textContent = formatNumber(pokemon.id);

    const img = document.createElement("img");
    img.className = "pokedex-card__img";
    setPokemonImage(img, pokemon.id, { lazy: true });

    if (caughtFlag) {
      img.alt = pokemon.name;
    } else {
      img.alt = "未ゲット";
      img.classList.add("pokedex-card__img--silhouette");
    }

    const name = document.createElement("p");
    name.className = "pokedex-card__name";

    if (caughtFlag) {
      name.textContent = pokemon.name;
    } else {
      name.textContent = "？？？";
      name.classList.add("pokedex-card__name--unknown");
    }

    card.appendChild(number);
    card.appendChild(img);
    card.appendChild(name);

    if (caughtFlag && record) {
      card.appendChild(createMiniBallIcon(record.ballType));
    }

    card.addEventListener("click", function () {
      showPokedexDetail(pokemon.id);
    });

    grid.appendChild(card);
  });

  showScreen("pokedex");
  setPokedexAfterCatchMode(!!scrollToPokemonId);

  if (scrollToPokemonId) {
    scrollPokedexToPokemon(scrollToPokemonId);
  } else {
    const scrollArea = document.querySelector(".pokedex-scroll-area");
    if (scrollArea) scrollArea.scrollTop = 0;
  }
}

// ─────────────────────────────────────────
// イベント設定（ボタンが押されたときの処理）
// ─────────────────────────────────────────

document.getElementById("btn-header-logo").addEventListener("click", goHomeFromLogo);

document.getElementById("btn-sound-toggle").addEventListener("click", function () {
  SoundManager.init();
  const btn = document.getElementById("btn-sound-toggle");
  const nextEnabled = btn.getAttribute("aria-pressed") !== "true";
  SoundManager.setEnabled(nextEnabled);
  btn.setAttribute("aria-pressed", nextEnabled ? "true" : "false");
  btn.textContent = nextEnabled ? "🔊" : "🔇";
  btn.setAttribute("aria-label", nextEnabled ? "サウンド ON" : "サウンド OFF");
  if (nextEnabled) {
    SoundManager.playTap();
    if (screens.quiz.classList.contains("screen--active")) {
      SoundManager.updateScreenBgm("quiz", {
        legendary: gameState.isLegendaryMode,
      });
    } else if (screens.home.classList.contains("screen--active")) {
      SoundManager.updateScreenBgm("home");
    } else if (screens.summary.classList.contains("screen--active")) {
      SoundManager.updateScreenBgm("summary");
    } else if (screens.catch.classList.contains("screen--active")) {
      SoundManager.updateScreenBgm("catch");
    }
  }
});

document.getElementById("btn-start").addEventListener("click", function () {
  startQuiz(shouldStartLegendary());
});

document.getElementById("btn-pokedex").addEventListener("click", function () {
  SoundManager.init();
  SoundManager.playTap();
  renderPokedex();
});

document.getElementById("btn-parent-report").addEventListener("click", openParentReport);

document.getElementById("btn-parent-report-home").addEventListener("click", function () {
  SoundManager.playTap();
  updateHomeScreen();
  showScreen("home");
});

document.getElementById("btn-clear-history").addEventListener("click", function () {
  const ok = window.confirm(
    "ゲットしたポケモンと にがての記録を すべて消します。\nよろしい？"
  );
  if (!ok) return;

  SoundManager.playTap();
  resetSaveData();
  setRotomStatus("記録をリセットしたよ");
});

document.getElementById("quiz-form").addEventListener("submit", handleAnswerSubmit);

document.getElementById("btn-next-question").addEventListener("click", goNextQuestion);

document.getElementById("btn-go-catch").addEventListener("click", function () {
  startCatchScene();
});

document.getElementById("btn-catch-pokedex").addEventListener("click", function () {
  SoundManager.playTap();
  if (gameState.catchSuccess && gameState.catchPokemon) {
    renderPokedex(gameState.catchPokemon.id);
    return;
  }
  updateHomeScreen();
  showScreen("home");
});

document.getElementById("btn-pokedex-back").addEventListener("click", function () {
  SoundManager.playTap();
  if (screens.parentReport.classList.contains("screen--active")) {
    updateHomeScreen();
    showScreen("home");
    return;
  }
  if (!document.getElementById("pokedex-detail-view").classList.contains("hidden")) {
    hidePokedexDetail();
    return;
  }
  setPokedexAfterCatchMode(false);
  updateHomeScreen();
  showScreen("home");
});

document.getElementById("btn-pokedex-home").addEventListener("click", function () {
  SoundManager.playTap();
  setPokedexAfterCatchMode(false);
  updateHomeScreen();
  showScreen("home");
});

document.getElementById("btn-pokedex-retry").addEventListener("click", function () {
  SoundManager.playTap();
  setPokedexAfterCatchMode(false);
  startQuiz(shouldStartLegendary());
});

// ─────────────────────────────────────────
// PC向け：Enterキー操作（小学生でもラクに）
// ─────────────────────────────────────────

document.addEventListener("keydown", function (event) {
  if (event.key !== "Enter") return;

  const quizActive = screens.quiz.classList.contains("screen--active");
  const feedbackOpen = !document.getElementById("quiz-feedback").classList.contains("hidden");

  if (quizActive && feedbackOpen) {
    if (gameState.quizInputLock) return;
    event.preventDefault();
    goNextQuestion();
    return;
  }

  if (screens.summary.classList.contains("screen--active")) {
    event.preventDefault();
    startCatchScene();
    return;
  }

  if (screens.catch.classList.contains("screen--active")) {
    const actionsHidden = document.getElementById("catch-actions").classList.contains("hidden");
    if (!actionsHidden) {
      event.preventDefault();
      document.getElementById("btn-catch-pokedex").click();
    }
    return;
  }

  if (screens.pokedex.classList.contains("screen--active")) {
    const inDetail = !document.getElementById("pokedex-detail-view").classList.contains("hidden");
    if (gameState.pokedexAfterCatch && !inDetail) {
      event.preventDefault();
      document.getElementById("btn-pokedex-retry").click();
    }
  }
});

window.addEventListener("resize", updateKeyboardHint);

// ─────────────────────────────────────────
// 最初の表示
// ─────────────────────────────────────────

setRotomStatus("準備OK");
updateHomeScreen();
updateScreenScrollMode("home");
updateKeyboardHint();

// ブラウザの自動再生ルール対応：ホームで最初にタップしたとき BGM を始める
document.addEventListener(
  "click",
  function startHomeBgmOnFirstTap() {
    if (screens.home.classList.contains("screen--active")) {
      SoundManager.init();
      SoundManager.updateScreenBgm("home");
    }
  },
  { once: true }
);
