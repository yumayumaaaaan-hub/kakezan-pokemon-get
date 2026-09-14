/*
  sound.js — 効果音（SE）＋ BGM
  ─────────────────────
  ・SE … Web Audio API（ブラウザだけで生成）
  ・BGM … assets/home-bgm.mp3（ホーム）、assets/quiz-bgm.mp3（通常問題）
  ・       assets/legendary-quiz-bgm.mp3（伝説チャレンジ）
  ・短いBGM … 結果・ゲット画面（Web Audio でポケモン風チップチューン）

  ブラウザのルールで、最初のクリック後に 音が鳴るようになっています。
*/

const SoundManager = {
  ctx: null,
  enabled: true,
  homeBgm: null,
  homeBgmUrl: "assets/home-bgm.mp3?v=1",
  homeBgmVolume: 0.25,
  quizBgm: null,
  quizBgmUrl: "assets/quiz-bgm.mp3?v=1",
  quizBgmVolume: 0.25,
  legendaryQuizBgm: null,
  legendaryQuizBgmUrl: "assets/legendary-quiz-bgm.mp3?v=1",
  legendaryQuizBgmVolume: 0.25,
  chiptuneBgmId: null,
  chiptuneBgmTimer: null,
  chiptuneBgmGain: null,
  chiptuneBgmVolume: 0.25,

  // 音声を使える状態にする（最初のタップで呼ぶ）
  init: function () {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.ctx = new AudioContext();
    }

    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  },

  createLoopBgm: function (url, volume) {
    const bgm = new Audio(url);
    bgm.loop = true;
    bgm.volume = volume;
    bgm.preload = "auto";
    return bgm;
  },

  playLoopBgm: function (bgm) {
    if (!bgm) return;

    if (bgm.paused) {
      bgm.currentTime = 0;
    }

    const playPromise = bgm.play();
    if (playPromise && playPromise.catch) {
      playPromise.catch(function () {
        // 自動再生がブロックされた場合は無視（次の操作で再試行）
      });
    }
  },

  stopLoopBgm: function (bgm) {
    if (!bgm) return;
    bgm.pause();
    bgm.currentTime = 0;
  },

  initHomeBgm: function () {
    if (this.homeBgm) return;
    this.homeBgm = this.createLoopBgm(this.homeBgmUrl, this.homeBgmVolume);
  },

  initQuizBgm: function () {
    if (this.quizBgm) return;
    this.quizBgm = this.createLoopBgm(this.quizBgmUrl, this.quizBgmVolume);
  },

  initLegendaryQuizBgm: function () {
    if (this.legendaryQuizBgm) return;
    this.legendaryQuizBgm = this.createLoopBgm(
      this.legendaryQuizBgmUrl,
      this.legendaryQuizBgmVolume
    );
  },

  playHomeBgm: function () {
    if (!this.enabled) return;

    this.init();
    this.initHomeBgm();
    this.playLoopBgm(this.homeBgm);
  },

  stopHomeBgm: function () {
    this.stopLoopBgm(this.homeBgm);
  },

  playQuizBgm: function () {
    if (!this.enabled) return;

    this.init();
    this.initQuizBgm();
    this.playLoopBgm(this.quizBgm);
  },

  stopQuizBgm: function () {
    this.stopLoopBgm(this.quizBgm);
  },

  playLegendaryQuizBgm: function () {
    if (!this.enabled) return;

    this.init();
    this.initLegendaryQuizBgm();
    this.playLoopBgm(this.legendaryQuizBgm);
  },

  stopLegendaryQuizBgm: function () {
    this.stopLoopBgm(this.legendaryQuizBgm);
  },

  stopAllQuizBgm: function () {
    this.stopQuizBgm();
    this.stopLegendaryQuizBgm();
  },

  getChiptuneMasterGain: function () {
    if (!this.ctx) return null;

    if (!this.chiptuneBgmGain) {
      this.chiptuneBgmGain = this.ctx.createGain();
      this.chiptuneBgmGain.connect(this.ctx.destination);
    }

    this.chiptuneBgmGain.gain.value = this.chiptuneBgmVolume;
    return this.chiptuneBgmGain;
  },

  stopChiptuneBgm: function () {
    this.chiptuneBgmId = null;

    if (this.chiptuneBgmTimer) {
      clearTimeout(this.chiptuneBgmTimer);
      this.chiptuneBgmTimer = null;
    }
  },

  // チップチューン風の1音を鳴らす（短いBGM用）
  playChiptuneNote: function (frequency, startTime, duration, type, volume) {
    if (!this.enabled || !this.ctx || !this.chiptuneBgmId) return;

    const master = this.getChiptuneMasterGain();
    if (!master) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type || "square";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(master);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  },

  scheduleChiptuneLoop: function (id, loopFn, loopDurationMs) {
    const self = this;

    function run() {
      if (self.chiptuneBgmId !== id || !self.enabled || !self.ctx) return;

      const startTime = self.ctx.currentTime + 0.05;
      loopFn(startTime);
      self.chiptuneBgmTimer = setTimeout(run, loopDurationMs);
    }

    run();
  },

  // 結果画面 … バトルに勝ったときの明るいファンファーレ風
  playSummaryBgm: function () {
    if (!this.enabled) return;
    if (this.chiptuneBgmId === "summary") return;

    this.init();
    this.stopChiptuneBgm();
    this.chiptuneBgmId = "summary";

    const self = this;
    const beat = 0.26;
    const loopDurationMs = beat * 8 * 1000;

    this.scheduleChiptuneLoop("summary", function (startTime) {
      const melody = [
        { f: 392, t: 0, d: beat * 0.85 },
        { f: 494, t: beat, d: beat * 0.85 },
        { f: 587, t: beat * 2, d: beat * 0.85 },
        { f: 784, t: beat * 3, d: beat * 1.2 },
        { f: 659, t: beat * 5, d: beat * 0.85 },
        { f: 587, t: beat * 6, d: beat * 0.85 },
        { f: 523, t: beat * 7, d: beat * 1.1 },
      ];

      melody.forEach(function (note) {
        self.playChiptuneNote(note.f, startTime + note.t, note.d, "square", 0.09);
      });

      [392, 392, 440, 494, 392, 349, 392, 392].forEach(function (freq, index) {
        self.playChiptuneNote(
          freq / 2,
          startTime + index * beat,
          beat * 0.82,
          "triangle",
          0.07
        );
      });

      [988, 1175, 988].forEach(function (freq, index) {
        self.playChiptuneNote(
          freq,
          startTime + beat * 3 + index * beat * 0.45,
          beat * 0.35,
          "sine",
          0.045
        );
      });
    }, loopDurationMs);
  },

  // ゲット画面 … ボールがゆれるときのドキドキ感
  playCatchBgm: function () {
    if (!this.enabled) return;
    if (this.chiptuneBgmId === "catch") return;

    this.init();
    this.stopChiptuneBgm();
    this.chiptuneBgmId = "catch";

    const self = this;
    const beat = 0.34;
    const loopDurationMs = beat * 8 * 1000;

    this.scheduleChiptuneLoop("catch", function (startTime) {
      [82.4, 82.4, 98, 82.4, 82.4, 110, 82.4, 98].forEach(function (freq, index) {
        self.playChiptuneNote(
          freq,
          startTime + index * beat,
          beat * 0.75,
          "triangle",
          0.08
        );
      });

      const arpeggio = [
        { f: 330, t: 0 },
        { f: 392, t: beat * 0.5 },
        { f: 494, t: beat },
        { f: 587, t: beat * 1.5 },
        { f: 494, t: beat * 2 },
        { f: 392, t: beat * 2.5 },
        { f: 330, t: beat * 3 },
        { f: 294, t: beat * 3.5 },
      ];

      arpeggio.forEach(function (note) {
        self.playChiptuneNote(note.f, startTime + note.t, beat * 0.42, "square", 0.055);
      });

      [880, 740, 880, 988].forEach(function (freq, index) {
        self.playChiptuneNote(
          freq,
          startTime + beat * 4 + index * beat,
          beat * 0.28,
          "sine",
          0.035
        );
      });
    }, loopDurationMs);
  },

  // 画面に合わせて BGM を切り替える
  updateScreenBgm: function (screenName, options) {
    const opts = options || {};

    if (!this.enabled) {
      this.stopHomeBgm();
      this.stopAllQuizBgm();
      this.stopChiptuneBgm();
      return;
    }

    if (screenName === "home") {
      this.stopAllQuizBgm();
      this.stopChiptuneBgm();
      this.playHomeBgm();
      return;
    }

    if (screenName === "quiz") {
      this.stopHomeBgm();
      this.stopChiptuneBgm();
      if (opts.legendary) {
        this.stopQuizBgm();
        this.playLegendaryQuizBgm();
      } else {
        this.stopLegendaryQuizBgm();
        this.playQuizBgm();
      }
      return;
    }

    if (screenName === "summary") {
      this.stopHomeBgm();
      this.stopAllQuizBgm();
      this.playSummaryBgm();
      return;
    }

    if (screenName === "catch") {
      this.stopHomeBgm();
      this.stopAllQuizBgm();
      this.playCatchBgm();
      return;
    }

    this.stopHomeBgm();
    this.stopAllQuizBgm();
    this.stopChiptuneBgm();
  },

  setEnabled: function (on) {
    this.enabled = on;
    if (!on) {
      this.stopHomeBgm();
      this.stopAllQuizBgm();
      this.stopChiptuneBgm();
    }
  },

  // 1つの音を鳴らす基本関数
  playTone: function (frequency, startTime, duration, type, volume) {
    if (!this.enabled || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type || "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume || 0.15, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  },

  // ボタンを押したとき
  playTap: function () {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.playTone(520, t, 0.08, "sine", 0.12);
  },

  // 正解！（ピロピロ〜 明るい音）
  playCorrect: function () {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = [523, 659, 784, 1047];
    notes.forEach(function (freq, i) {
      SoundManager.playTone(freq, t + i * 0.1, 0.18, "square", 0.1);
    });
  },

  // 不正解（やさしい ポン）
  playWrong: function () {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.playTone(330, t, 0.15, "triangle", 0.12);
    this.playTone(262, t + 0.12, 0.2, "triangle", 0.1);
  },

  // ボールが ゆれる音
  playBallShake: function () {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.playTone(180, t, 0.06, "square", 0.08);
  },

  // ゲット成功！（ファンファーレ）
  playCatchSuccess: function () {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const melody = [523, 659, 784, 988, 1047];
    melody.forEach(function (freq, i) {
      SoundManager.playTone(freq, t + i * 0.12, 0.22, "square", 0.11);
    });
    this.playTone(1318, t + 0.65, 0.35, "sine", 0.14);
  },

  // ゲット失敗（やさしい音）
  playCatchFail: function () {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.playTone(440, t, 0.12, "triangle", 0.1);
    this.playTone(349, t + 0.15, 0.25, "triangle", 0.08);
  },

  // 結果画面へ
  playSummary: function () {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.playTone(587, t, 0.15, "sine", 0.1);
    this.playTone(784, t + 0.15, 0.2, "sine", 0.1);
  },
};
