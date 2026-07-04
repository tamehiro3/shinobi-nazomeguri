// ============================================================
// CryptoNinja 忍びの謎巡り - 画面と進行
// 40代からの大人向け: 文字大きめ・制限時間なし・ペナルティなし
// ============================================================
"use strict";

// ---------- セーブデータ ----------
const SAVE_KEY = "nazomeguri_save_v1";

function defaultState() {
  return {
    difficulty: "normal",          // easy | normal | hard
    fontScale: "m",                // s | m | l
    partner: "lily",
    koban: 0,
    streak: 0,
    lastClearDate: null,
    totalClears: 0,
    scrolls: [],                   // 巻物id
    tools: [],                     // 忍具id
    stamps: { hajimari: 0, takekage: 0, tsukimi: 0 },
    diary: [],                     // {date, areaId, title, partnerId, stars, text, comment}
    village: { grid: Array(12).fill(null), owned: {} },
    bond: { lily: 0, orochi: 0, luna: 0 },
    usedQuiz: [],
    seenIntro: false,
    today: null                    // {date, stepIndex, hintsUsed, done, freeCount}
  };
}

let S = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultState();
    const st = Object.assign(defaultState(), JSON.parse(raw));
    st.village = Object.assign({ grid: Array(12).fill(null), owned: {} }, st.village);
    if (!Array.isArray(st.village.grid) || st.village.grid.length !== 12) st.village.grid = Array(12).fill(null);
    return st;
  } catch (e) {
    return defaultState();
  }
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }

// ---------- 日付 ----------
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function waDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return `${DATA.kyureki[m - 1]}${d}日`;
}
function ensureToday() {
  const key = todayKey();
  if (!S.today || S.today.date !== key) {
    S.today = { date: key, stepIndex: 0, hintsUsed: 0, done: false, freeCount: 0 };
    save();
  }
}

// ---------- 本日の任務(シードから常に再構築できる) ----------
let MISSION = null;
function mission() {
  ensureToday();
  if (!MISSION || MISSION.seed !== S.today.date + ":" + S.difficulty) {
    const m = GEN.buildMission(S.today.date, S.difficulty, S.usedQuiz);
    m.seed = S.today.date + ":" + S.difficulty;
    MISSION = m;
  }
  return MISSION;
}

// ---------- ユーティリティ ----------
const $ = (sel) => document.querySelector(sel);
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function nl2br(s) { return esc(s).replace(/\n/g, "<br>"); }

// キャラの顔アイコン(CNP公式画像・頭部を丸く切り抜き表示)
function face(ch) {
  return `<img class="char-face" src="${ch.img}" alt="${esc(ch.name)}">`;
}

// ---------- 画面切り替え ----------
const SCREENS = ["home", "play", "diary", "village", "kura", "settings"];
let current = "home";
function show(name) {
  current = name;
  for (const s of SCREENS) {
    $("#screen-" + s).classList.toggle("active", s === name);
    const tab = $("#tab-" + s);
    if (tab) tab.classList.toggle("active", s === name);
  }
  window.scrollTo(0, 0);
  if (name === "home") renderHome();
  if (name === "diary") renderDiary();
  if (name === "village") renderVillage();
  if (name === "kura") renderKura();
  if (name === "settings") renderSettings();
}

// ============================================================
// ホーム(今日の任務)
// ============================================================
function renderHome() {
  ensureToday();
  const m = mission();
  const area = DATA.areas[m.areaId];
  const ch = DATA.chars[S.partner];

  $("#home-date").textContent = `${S.today.date}(${waDate(S.today.date)})`;
  $("#home-streak").textContent = S.streak > 0 ? `旅は${S.streak}日目 🔥` : "今日から旅がはじまる";
  $("#home-koban").textContent = S.koban;

  const stepsHtml = m.steps.map((st, i) => {
    const done = S.today.done || i < S.today.stepIndex;
    const mark = done ? "✅" : (i === S.today.stepIndex && !S.today.done ? "🔸" : "▫️");
    return `<li>${mark} ${esc(st.typeLabel)}「${esc(st.title)}」</li>`;
  }).join("");

  $("#mission-card").innerHTML = `
    <div class="area-line">${area.emoji} ${esc(area.name)}</div>
    <h2 class="mission-title">「${esc(m.title)}」</h2>
    <p class="mission-intro">${nl2br(m.intro)}</p>
    <ul class="mission-steps">${stepsHtml}</ul>
  `;

  // 相棒えらび
  $("#partner-row").innerHTML = DATA.charOrder.map(id => {
    const c = DATA.chars[id];
    const sel = id === S.partner ? " selected" : "";
    return `<button class="partner-btn${sel}" data-char="${id}">
      <img class="pimg" src="${c.img}" alt="${esc(c.name)}"><span class="pname">${esc(c.name)}</span>
      <span class="prole">${esc(c.role)}</span>
    </button>`;
  }).join("");
  $("#partner-note").textContent = `${ch.name}の得意分野: ${ch.specialtyLabel}(得意な謎は小判ボーナス)`;
  document.querySelectorAll(".partner-btn").forEach(b => {
    b.addEventListener("click", () => { S.partner = b.dataset.char; save(); renderHome(); });
  });

  const go = $("#btn-go");
  if (S.today.done) {
    go.textContent = "🎯 腕試しの謎に挑む(何度でも)";
    go.onclick = startFreePlay;
    $("#home-done-note").style.display = "block";
  } else {
    go.textContent = S.today.stepIndex > 0 ? "▶ 旅のつづきへ" : "▶ 旅に出る";
    go.onclick = () => startMission(false);
    $("#home-done-note").style.display = "none";
  }
}

// ============================================================
// 任務プレイ
// ============================================================
let PLAY = null; // {mode:"mission"|"free", puzzle, stepIndex, hintLevel, wrongs, phase, freeReward}

function startMission() {
  ensureToday();
  const m = mission();
  PLAY = { mode: "mission", stepIndex: S.today.stepIndex, hintLevel: 0, wrongs: 0 };
  PLAY.puzzle = m.steps[PLAY.stepIndex];
  PLAY.phase = PLAY.puzzle.memorize ? "memorize" : "quiz";
  show("play");
  if (PLAY.stepIndex === 0) renderStory(m);
  else renderPuzzle();
}

function startFreePlay() {
  ensureToday();
  S.today.freeCount++;
  save();
  const fp = GEN.buildFreePlay(S.today.date + "-free-" + S.today.freeCount + "-" + Date.now() % 100000, S.difficulty, S.usedQuiz);
  PLAY = { mode: "free", stepIndex: 0, hintLevel: 0, wrongs: 0, puzzle: fp.puzzle };
  PLAY.phase = PLAY.puzzle.memorize ? "memorize" : "quiz";
  show("play");
  renderPuzzle();
}

function renderStory(m) {
  const area = DATA.areas[m.areaId];
  const ch = DATA.chars[S.partner];
  $("#play-body").innerHTML = `
    <div class="story-card">
      <div class="area-line">${area.emoji} ${esc(area.name)}</div>
      <h2>「${esc(m.title)}」</h2>
      <p>${nl2br(m.intro)}</p>
      <p class="char-line">${face(ch)} ${esc(ch.name)}「${esc(ch.hintLine)}」</p>
      <button class="btn primary big" id="btn-story-next">旅をはじめる</button>
    </div>`;
  $("#btn-story-next").onclick = renderPuzzle;
}

function puzzleHeader() {
  if (PLAY.mode === "free") return `<div class="step-ind">🎯 腕試し</div>`;
  const dots = mission().steps.map((_, i) =>
    `<span class="dot${i < PLAY.stepIndex ? " done" : i === PLAY.stepIndex ? " now" : ""}"></span>`).join("");
  return `<div class="step-ind">${dots} <span>その${["一", "二", "三"][PLAY.stepIndex]}</span></div>`;
}

function visualHtml(v) {
  if (!v) return "";
  if (v.kind === "scroll") {
    return `<div class="v-scroll">📜 <span class="coded">${esc(v.text)}</span></div>`;
  }
  if (v.kind === "compass") {
    const g = v.grid;
    const cell = (d) => `<div class="c-cell"><span class="c-dir">${d}</span><span class="c-kana">${esc(g[d] || "")}</span></div>`;
    return `<div class="v-compass">
      ${cell("北西")}${cell("北")}${cell("北東")}
      ${cell("西")}<div class="c-cell c-center"><span class="c-kana">✦</span></div>${cell("東")}
      ${cell("南西")}${cell("南")}${cell("南東")}
    </div>`;
  }
  if (v.kind === "rules") {
    return `<div class="v-rules">${v.rules.map(r => `<div class="rule">📜 ${esc(r)}</div>`).join("")}</div>`;
  }
  if (v.kind === "lines") {
    return `<div class="v-lines">${v.lines.map(l => `<div class="line">💬 ${esc(l)}</div>`).join("")}</div>`;
  }
  if (v.kind === "grid") return ""; // 選択肢自体が絵
  return "";
}

function renderPuzzle() {
  const p = PLAY.puzzle;
  if (PLAY.phase === "memorize") {
    $("#play-body").innerHTML = `
      ${puzzleHeader()}
      <div class="puzzle-card">
        <div class="ptype">${esc(p.typeLabel)}</div>
        <h2>${esc(p.title)}</h2>
        <p>${nl2br(p.memorize.note)}</p>
        <div class="mem-items">${p.memorize.items.map(it => `<div class="mem-item">${esc(it)}</div>`).join("")}</div>
        <button class="btn primary big" id="btn-memdone">覚えた</button>
      </div>`;
    $("#btn-memdone").onclick = () => { PLAY.phase = "quiz"; renderPuzzle(); };
    return;
  }

  const choicesHtml = p.choices.map((c, i) =>
    `<button class="btn choice" data-i="${i}">${esc(c)}</button>`).join("");
  $("#play-body").innerHTML = `
    ${puzzleHeader()}
    <div class="puzzle-card">
      <div class="ptype">${esc(p.typeLabel)}</div>
      <h2>${esc(p.title)}</h2>
      <p class="pprompt">${nl2br(p.prompt)}</p>
      ${visualHtml(p.visual)}
      <div class="choices">${choicesHtml}</div>
      <div id="feedback" class="feedback"></div>
      <div class="puzzle-foot">
        <button class="btn ghost" id="btn-hint">💡 ヒント(${PLAY.hintLevel}/3)</button>
        <button class="btn ghost" id="btn-quit">🏠 一度もどる</button>
      </div>
    </div>`;
  document.querySelectorAll(".choice").forEach(b => b.addEventListener("click", () => answer(Number(b.dataset.i), b)));
  $("#btn-hint").onclick = showHint;
  $("#btn-quit").onclick = () => show("home");
}

function showHint() {
  const p = PLAY.puzzle;
  if (PLAY.hintLevel < 3) {
    PLAY.hintLevel++;
    if (PLAY.mode === "mission") { S.today.hintsUsed++; save(); }
  }
  const ch = DATA.chars[S.partner];
  const lines = p.hints.slice(0, PLAY.hintLevel).map((h, i) =>
    `<p class="hint-line"><b>ヒント${i + 1}:</b> ${esc(h)}</p>`).join("");
  openSheet(`
    <p class="char-line">${face(ch)} ${esc(ch.name)}「${esc(ch.hintLine)}」</p>
    ${lines}
    <button class="btn primary big" onclick="closeSheet()">なるほど</button>
  `);
  const hb = $("#btn-hint");
  if (hb) hb.textContent = `💡 ヒント(${PLAY.hintLevel}/3)`;
}

function answer(i, btn) {
  const p = PLAY.puzzle;
  const ch = DATA.chars[S.partner];
  const fb = $("#feedback");
  if (i === p.answerIndex) {
    document.querySelectorAll(".choice").forEach(b => b.disabled = true);
    btn.classList.add("correct");
    const praise = GEN.pick(GEN.makeRng(p.title + i), ch.praise);
    const bonus = ch.specialty.includes(p.type);
    fb.innerHTML = `
      <div class="ok-box">
        <p class="okmark">⭕ お見事!</p>
        <p class="char-line">${face(ch)} ${esc(ch.name)}「${esc(praise)}${bonus ? " これはわたしの得意分野。ほうびを弾みましょう。" : ""}」</p>
        <p class="explain">${esc(p.explain)}</p>
        <button class="btn primary big" id="btn-next">つぎへ</button>
      </div>`;
    if (p.type === "waculture" && typeof p.quizIndex === "number" && !S.usedQuiz.includes(p.quizIndex)) {
      S.usedQuiz.push(p.quizIndex);
      if (S.usedQuiz.length >= DATA.quiz.length) S.usedQuiz = [];
      save();
    }
    $("#btn-next").onclick = () => (PLAY.mode === "mission" ? nextStep(bonus) : finishFree(bonus));
  } else {
    btn.disabled = true;
    btn.classList.add("wrong");
    PLAY.wrongs++;
    const missLine = GEN.pick(GEN.makeRng(p.title + "m" + PLAY.wrongs), ch.miss);
    fb.innerHTML = `<p class="char-line miss">${face(ch)} ${esc(ch.name)}「${esc(missLine)}」${PLAY.wrongs >= 2 ? "<br>💡 ヒントを見ても恥ではありませんよ。" : ""}</p>`;
  }
}

function kobanFor(diff) { return diff === "easy" ? 5 : diff === "hard" ? 12 : 8; }

function nextStep(bonus) {
  const earn = kobanFor(S.difficulty) + (bonus ? 3 : 0);
  S.koban += earn;
  S.today.stepIndex++;
  save();
  const m = mission();
  if (S.today.stepIndex >= m.steps.length) {
    finishMission();
  } else {
    PLAY.stepIndex = S.today.stepIndex;
    PLAY.puzzle = m.steps[PLAY.stepIndex];
    PLAY.hintLevel = 0;
    PLAY.wrongs = 0;
    PLAY.phase = PLAY.puzzle.memorize ? "memorize" : "quiz";
    renderPuzzle();
  }
}

function finishFree(bonus) {
  const earn = 3 + (bonus ? 2 : 0);
  S.koban += earn;
  save();
  $("#play-body").innerHTML = `
    ${puzzleHeader()}
    <div class="reward-card">
      <h2>🎯 腕試し、みごと!</h2>
      <p class="reward-line">🪙 小判 ×${earn}</p>
      <button class="btn primary big" id="btn-again">もう一問</button>
      <button class="btn ghost big" id="btn-home2">🏠 もどる</button>
    </div>`;
  $("#btn-again").onclick = startFreePlay;
  $("#btn-home2").onclick = () => show("home");
}

function finishMission() {
  const m = mission();
  const ch = DATA.chars[S.partner];
  const key = S.today.date;

  // 報酬計算
  const stars = S.today.hintsUsed === 0 ? 3 : S.today.hintsUsed <= 2 ? 2 : 1;
  const clearBonus = 10;
  S.koban += clearBonus;
  S.stamps[m.areaId] = (S.stamps[m.areaId] || 0) + 1;
  S.bond[S.partner] = (S.bond[S.partner] || 0) + 1;
  S.totalClears++;

  // 連続日数
  const yest = new Date(new Date(key + "T12:00:00").getTime() - 86400000);
  const yestKey = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, "0")}-${String(yest.getDate()).padStart(2, "0")}`;
  S.streak = S.lastClearDate === yestKey ? S.streak + 1 : 1;
  S.lastClearDate = key;

  // ドロップ(巻物か忍具・未所持を優先)
  const rng = GEN.makeRng("drop:" + key);
  let dropHtml = "";
  const unScrolls = DATA.scrolls.filter(s => !S.scrolls.includes(s.id));
  const unTools = DATA.tools.filter(t => !S.tools.includes(t.id));
  if (unScrolls.length + unTools.length === 0) {
    S.koban += 20;
    dropHtml = `<p class="reward-line">🪙 蔵が満杯につき、小判 ×20 を追加!</p>`;
  } else if (unScrolls.length > 0 && (unTools.length === 0 || rng() < 0.5)) {
    const sc = GEN.pick(rng, unScrolls);
    S.scrolls.push(sc.id);
    dropHtml = `<p class="reward-line">📜 巻物「${esc(sc.name)}」を手に入れた!</p><p class="drop-flavor">${esc(sc.text)}</p>`;
  } else {
    const tl = GEN.pick(rng, unTools);
    S.tools.push(tl.id);
    dropHtml = `<p class="reward-line">${tl.e} 忍具「${esc(tl.name)}」を手に入れた!</p><p class="drop-flavor">${esc(tl.flavor)}</p>`;
  }

  // 旅日記
  const area = DATA.areas[m.areaId];
  const drng = GEN.makeRng("diary:" + key);
  const text = GEN.fill(GEN.pick(drng, DATA.diaryTemplates), {
    wa: waDate(key), partner: ch.name, area: area.name, title: m.title,
    event: GEN.pick(drng, area.events)
  }) + " " + DATA.diaryStars[stars];
  const comment = GEN.pick(drng, ch.diary);
  S.diary.unshift({ date: key, areaId: m.areaId, title: m.title, partnerId: ch.id, stars, text, comment });
  if (S.diary.length > 120) S.diary.length = 120;

  S.today.done = true;
  save();

  const starStr = "★".repeat(stars) + "☆".repeat(3 - stars);
  $("#play-body").innerHTML = `
    <div class="reward-card">
      <h2>🎉 任務完了!</h2>
      <p class="reward-stars">${starStr}</p>
      <p class="reward-line">🪙 小判 ×${clearBonus}(謎ごとの分とは別)</p>
      <p class="reward-line">${DATA.stamps[m.areaId].e} ${esc(DATA.stamps[m.areaId].name)}を捺した</p>
      ${dropHtml}
      <p class="reward-line">🔥 旅は${S.streak}日目 / ${esc(ch.name)}との絆 +1</p>
      <div class="diary-preview">
        <h3>📖 旅日記に記した</h3>
        <p>${esc(text)}</p>
        <p class="char-line">${face(ch)} ${esc(comment)}</p>
      </div>
      <button class="btn primary big" id="btn-home3">🏠 里へもどる</button>
    </div>`;
  $("#btn-home3").onclick = () => show("home");
}

// ============================================================
// 旅日記
// ============================================================
function renderDiary() {
  const list = $("#diary-list");
  if (S.diary.length === 0) {
    list.innerHTML = `<p class="empty">まだ日記はない。今日の任務を終えると、最初の一頁が記される。</p>`;
    return;
  }
  list.innerHTML = S.diary.map(d => {
    const area = DATA.areas[d.areaId];
    const ch = DATA.chars[d.partnerId];
    return `<div class="diary-card">
      <div class="d-head">${area.emoji} ${esc(d.date)}(${esc(waDate(d.date))}) ${"★".repeat(d.stars)}${"☆".repeat(3 - d.stars)}</div>
      <div class="d-title">「${esc(d.title)}」</div>
      <p>${esc(d.text)}</p>
      <p class="char-line">${face(ch)} ${esc(d.comment)}</p>
    </div>`;
  }).join("");
}

// ============================================================
// 忍びの里(里づくり)
// ============================================================
let pendingCell = -1;

function villageRank() {
  const n = S.village.grid.filter(Boolean).length;
  let r = DATA.villageRanks[0].name;
  for (const vr of DATA.villageRanks) if (n >= vr.min) r = vr.name;
  return r;
}

function renderVillage() {
  $("#village-koban").textContent = S.koban;
  $("#village-rank").textContent = villageRank();
  $("#village-grid").innerHTML = S.village.grid.map((cell, i) => {
    if (cell) {
      const d = DATA.decors.find(x => x.id === cell);
      return `<button class="v-cell filled" data-i="${i}" title="${esc(d.name)}">${d.e}</button>`;
    }
    return `<button class="v-cell" data-i="${i}">·</button>`;
  }).join("");
  document.querySelectorAll(".v-cell").forEach(b => b.addEventListener("click", () => cellTap(Number(b.dataset.i))));

  $("#shop-list").innerHTML = DATA.decors.map(d => {
    const owned = S.village.owned[d.id] || 0;
    const placed = S.village.grid.filter(c => c === d.id).length;
    const stock = owned - placed;
    const afford = S.koban >= d.price;
    return `<div class="shop-row">
      <span class="shop-e">${d.e}</span>
      <span class="shop-name">${esc(d.name)}${stock > 0 ? `(持ち物 ${stock})` : ""}</span>
      <button class="btn small${afford ? "" : " disabled"}" data-buy="${d.id}" ${afford ? "" : "disabled"}>🪙${d.price}で購入</button>
    </div>`;
  }).join("");
  document.querySelectorAll("[data-buy]").forEach(b => b.addEventListener("click", () => buyDecor(b.dataset.buy)));
}

function buyDecor(id) {
  const d = DATA.decors.find(x => x.id === id);
  if (!d || S.koban < d.price) return;
  S.koban -= d.price;
  S.village.owned[id] = (S.village.owned[id] || 0) + 1;
  save();
  renderVillage();
}

function cellTap(i) {
  const cell = S.village.grid[i];
  if (cell) {
    const d = DATA.decors.find(x => x.id === cell);
    openSheet(`
      <h3>${d.e} ${esc(d.name)}</h3>
      <button class="btn primary big" onclick="removeDecor(${i})">しまう(持ち物にもどす)</button>
      <button class="btn ghost big" onclick="closeSheet()">やめる</button>
    `);
    return;
  }
  // 置ける持ち物
  const stock = DATA.decors.filter(d => {
    const owned = S.village.owned[d.id] || 0;
    const placed = S.village.grid.filter(c => c === d.id).length;
    return owned - placed > 0;
  });
  if (stock.length === 0) {
    openSheet(`<p>置ける飾りがまだない。<br>下の「里の市」で小判と交換しよう。</p>
      <button class="btn primary big" onclick="closeSheet()">わかった</button>`);
    return;
  }
  pendingCell = i;
  openSheet(`
    <h3>どれを置く?</h3>
    <div class="place-list">${stock.map(d =>
      `<button class="btn choice" onclick="placeDecor('${d.id}')">${d.e} ${esc(d.name)}</button>`).join("")}</div>
    <button class="btn ghost big" onclick="closeSheet()">やめる</button>
  `);
}

function placeDecor(id) {
  if (pendingCell >= 0 && !S.village.grid[pendingCell]) {
    S.village.grid[pendingCell] = id;
    save();
  }
  pendingCell = -1;
  closeSheet();
  renderVillage();
}
function removeDecor(i) {
  S.village.grid[i] = null;
  save();
  closeSheet();
  renderVillage();
}

// ============================================================
// 蔵(コレクション)
// ============================================================
let kuraTab = "scrolls";
function renderKura() {
  document.querySelectorAll(".kura-tab").forEach(b =>
    b.classList.toggle("active", b.dataset.tab === kuraTab));
  const box = $("#kura-body");
  if (kuraTab === "scrolls") {
    box.innerHTML = DATA.scrolls.map(sc => {
      const has = S.scrolls.includes(sc.id);
      return `<div class="kura-card${has ? "" : " locked"}">
        <div class="k-name">📜 ${has ? esc(sc.name) : "？？？"}</div>
        <p>${has ? esc(sc.text) : "任務を果たせば、いつか手に入る。"}</p>
      </div>`;
    }).join("");
  } else if (kuraTab === "tools") {
    box.innerHTML = DATA.tools.map(t => {
      const has = S.tools.includes(t.id);
      return `<div class="kura-card${has ? "" : " locked"}">
        <div class="k-name">${has ? t.e : "❔"} ${has ? esc(t.name) : "？？？"}</div>
        <p>${has ? esc(t.flavor) : "任務を果たせば、いつか手に入る。"}</p>
      </div>`;
    }).join("");
  } else {
    box.innerHTML = DATA.areaOrder.map(id => {
      const st = DATA.stamps[id];
      const n = S.stamps[id] || 0;
      return `<div class="kura-card${n > 0 ? "" : " locked"}">
        <div class="k-name">${st.e} ${esc(st.name)}</div>
        <p>${n > 0 ? `この地を ${n}回 巡った` : "まだ訪れていない。"}</p>
      </div>`;
    }).join("") + `<div class="kura-card">
      <div class="k-name">🤝 相棒との絆</div>
      <p class="bond-row">${DATA.charOrder.map(id => `${face(DATA.chars[id])} ${DATA.chars[id].name}: ${S.bond[id] || 0}`).join(" / ")}</p>
    </div>`;
  }
}

// ============================================================
// 設定
// ============================================================
function renderSettings() {
  document.querySelectorAll("[data-diff]").forEach(b =>
    b.classList.toggle("selected", b.dataset.diff === S.difficulty));
  document.querySelectorAll("[data-fs]").forEach(b =>
    b.classList.toggle("selected", b.dataset.fs === S.fontScale));
  $("#stat-line").textContent =
    `これまでの任務達成 ${S.totalClears}回 / 小判 ${S.koban} / 巻物 ${S.scrolls.length}/${DATA.scrolls.length} / 忍具 ${S.tools.length}/${DATA.tools.length}`;
}

function applyFontScale() {
  const map = { s: "16px", m: "17.5px", l: "19.5px" };
  document.documentElement.style.fontSize = map[S.fontScale] || map.m;
}

// ============================================================
// 下からのシート(ヒント等)
// ============================================================
function openSheet(html) {
  $("#sheet-body").innerHTML = html;
  $("#sheet").classList.add("open");
}
function closeSheet() { $("#sheet").classList.remove("open"); }

// ============================================================
// はじめての案内
// ============================================================
function showIntro() {
  openSheet(`
    <h3>🌕 忍びの謎巡りへ、ようこそ</h3>
    <p>ここは、忍びたちと日本のあちこちを巡る<b>大人のなぞとき旅</b>。
    毎日ひとつ届く任務を、相棒と一緒にゆっくり解いてください。</p>
    <p>・制限時間はありません<br>
    ・まちがえても失うものはありません<br>
    ・ヒントは3段階、いつでも見られます<br>
    ・解いた旅は日記に残り、ほうびで里を飾れます</p>
    <p class="char-line">${face(DATA.chars.lily)} リーリー「急がず、あわてず、あきらめず。それが忍びの心得です」</p>
    <button class="btn primary big" onclick="closeSheet()">旅をはじめる</button>
  `);
  S.seenIntro = true;
  save();
}

// ============================================================
// 起動
// ============================================================
function init() {
  applyFontScale();

  // タブ
  for (const s of ["home", "diary", "village", "kura", "settings"]) {
    $("#tab-" + s).addEventListener("click", () => show(s));
  }
  // 蔵タブ
  document.querySelectorAll(".kura-tab").forEach(b =>
    b.addEventListener("click", () => { kuraTab = b.dataset.tab; renderKura(); }));
  // 設定
  document.querySelectorAll("[data-diff]").forEach(b =>
    b.addEventListener("click", () => { S.difficulty = b.dataset.diff; MISSION = null; save(); renderSettings(); }));
  document.querySelectorAll("[data-fs]").forEach(b =>
    b.addEventListener("click", () => { S.fontScale = b.dataset.fs; save(); applyFontScale(); renderSettings(); }));
  $("#btn-reset").addEventListener("click", () => {
    openSheet(`
      <h3>⚠️ 旅の記録を消す</h3>
      <p>日記・小判・里・蔵のすべてが消えます。この操作はもどせません。</p>
      <button class="btn danger big" id="btn-reset-yes">それでも消す</button>
      <button class="btn ghost big" onclick="closeSheet()">やめる</button>
    `);
    $("#btn-reset-yes").addEventListener("click", () => {
      localStorage.removeItem(SAVE_KEY);
      S = defaultState();
      MISSION = null;
      closeSheet();
      applyFontScale();
      show("home");
    });
  });
  // シートの背景タップで閉じる
  $("#sheet").addEventListener("click", (e) => { if (e.target.id === "sheet") closeSheet(); });

  show("home");
  if (!S.seenIntro) showIntro();

  // PWA
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

document.addEventListener("DOMContentLoaded", init);
