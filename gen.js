// ============================================================
// CryptoNinja 忍びの謎巡り - 謎生成エンジン
// 日付シード×テンプレート10種で毎日ちがう謎を端末内生成
// (オフライン動作・APIキー不要・自由入力なし)
// ============================================================
"use strict";

const GEN = (() => {

  // ---------- シード付き乱数 ----------
  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return () => {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeRng(seedStr) {
    const seed = xmur3(seedStr)();
    return mulberry32(seed);
  }
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
  const pickN = (rng, arr, n) => shuffle(rng, arr.slice()).slice(0, n);
  function shuffle(rng, arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  const fill = (tpl, map) => tpl.replace(/\{(\w+)\}/g, (_, k) => (map[k] !== undefined ? map[k] : "{" + k + "}"));

  // 選択肢を混ぜて answerIndex を付け直す
  function mixChoices(rng, correct, decoys, maxChoices) {
    const uniq = [];
    for (const d of decoys) {
      if (d !== correct && !uniq.includes(d)) uniq.push(d);
    }
    const cs = shuffle(rng, [correct].concat(uniq.slice(0, maxChoices - 1)));
    return { choices: cs, answerIndex: cs.indexOf(correct) };
  }

  // 難易度パラメータ
  function params(diff) {
    if (diff === "easy") return { nc: 3, shiftMax: 1, memN: 4, wordLen: [3, 3] };
    if (diff === "hard") return { nc: 4, shiftMax: 3, memN: 6, wordLen: [3, 4] };
    return { nc: 4, shiftMax: 2, memN: 5, wordLen: [3, 4] };
  }

  // ---------- 五十音表(清音+ん) ----------
  const GOJUON = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん";
  function shiftKana(word, k) {
    let out = "";
    for (const ch of word) {
      const i = GOJUON.indexOf(ch);
      out += i < 0 ? ch : GOJUON[(i + k + GOJUON.length) % GOJUON.length];
    }
    return out;
  }

  // ============================================================
  // 謎ジェネレーター 10種
  // 返り値: { type, typeLabel, title, prompt, note, visual, choices, answerIndex, hints[3], explain, memorize? }
  // ============================================================

  // 1. 暗号解読(五十音ずらし)
  function genCipherShift(rng, p) {
    const words = DATA.cipherWords.filter(w => w.length >= p.wordLen[0] && w.length <= p.wordLen[1] + 1);
    const word = pick(rng, words);
    const k = 1 + Math.floor(rng() * p.shiftMax);
    const coded = shiftKana(word, k);
    const decoys = pickN(rng, DATA.cipherWords.filter(w => w !== word && w.length === word.length), 4);
    const m = mixChoices(rng, word, decoys, p.nc);
    return {
      type: "cipher_shift", typeLabel: "暗号解読", title: "ずらし暗号の巻物",
      prompt: `拾った巻物にこう記されている。\n「まことの言葉は、五十音で ${k}つ あとの文字に置きかえて隠した」\n——もとの言葉はどれ?`,
      visual: { kind: "scroll", text: coded },
      choices: m.choices, answerIndex: m.answerIndex,
      hints: [
        "五十音表(あいうえお…)を思いうかべて、一文字ずつ戻してみよう。",
        `暗号の一文字ずつを ${k}つ「前」の文字に置きかえればいい。たとえば「${coded[0]}」は「${word[0]}」になる。`,
        `最初の文字は「${word[0]}」。つまり答えは「${word}」…かもしれない。`
      ],
      explain: `「${coded}」の各文字を五十音で${k}つ前に戻すと「${word}」になります。`
    };
  }

  // 2. 方角の暗号(方位盤読み)
  function genCipherDir(rng, p) {
    const dirs = ["北", "北東", "東", "南東", "南", "南西", "西", "北西"];
    const words = DATA.cipherWords.filter(w => w.length >= 3 && w.length <= 4);
    const word = pick(rng, words);
    const letters = [...word];
    const dirOrder = pickN(rng, dirs, letters.length);
    // 方位盤: 各方角にかな1文字。答えの文字+ダミー
    const grid = {};
    dirOrder.forEach((d, i) => { grid[d] = letters[i]; });
    const usedKana = new Set(letters);
    for (const d of dirs) {
      if (grid[d]) continue;
      let ch;
      do { ch = GOJUON[Math.floor(rng() * GOJUON.length)]; } while (usedKana.has(ch));
      grid[d] = ch;
    }
    // 誤答: 文字の並べ替え
    const decoys = [];
    let guard = 0;
    while (decoys.length < 3 && guard++ < 30) {
      const s = shuffle(rng, letters.slice()).join("");
      if (s !== word && !decoys.includes(s)) decoys.push(s);
    }
    const m = mixChoices(rng, word, decoys, p.nc);
    return {
      type: "cipher_dir", typeLabel: "方角の暗号", title: "忍びの方位盤",
      prompt: `方位盤に文字が刻まれている。置き文にはこうある。\n「${dirOrder.join(" → ")} の順に読むべし」\n——浮かび上がる言葉は?`,
      visual: { kind: "compass", grid: grid },
      choices: m.choices, answerIndex: m.answerIndex,
      hints: [
        "方位盤の「北」は上。時計まわりに 北→北東→東→南東→南→南西→西→北西 だ。",
        `最初の方角「${dirOrder[0]}」の文字は「${letters[0]}」。`,
        `${dirOrder.slice(0, letters.length - 1).map((d, i) => `${d}=「${letters[i]}」`).join("、")}。あとは最後の一文字。`
      ],
      explain: `${dirOrder.map((d, i) => `${d}=${letters[i]}`).join("、")} で「${word}」でした。`
    };
  }

  // 3. 地図なぞとき(掟に合う道順えらび)
  function genMap(rng, p, area) {
    const lm = area.landmarks.map(l => l.name);
    const route = pickN(rng, lm, 4);           // [start, mid, goal, forbidden]
    const [start, mid, goal, forbidden] = route;
    const correct = `${start} → ${mid} → ${goal}`;
    const others = lm.filter(n => ![start, mid, goal, forbidden].includes(n)).concat([mid]);
    const decoys = [
      `${start} → ${forbidden} → ${goal}`,                    // 掟一を破る
      `${mid} → ${start} → ${goal}`,                          // 掟二を破る
      `${start} → ${mid} → ${others[0] || forbidden}`         // 掟三を破る
    ];
    const m = mixChoices(rng, correct, decoys, Math.max(p.nc, 4));
    return {
      type: "map", typeLabel: "地図なぞとき", title: "置き文の道しるべ",
      prompt: `${area.name}の絵図面と、忍びの置き文が残されていた。\n掟に合う道順はどれ?`,
      visual: {
        kind: "rules",
        rules: [
          `一、${forbidden}を通ってはならぬ`,
          `二、はじめに${start}へ向かうべし`,
          `三、おわりに${goal}にて落ち合うべし`
        ]
      },
      choices: m.choices, answerIndex: m.answerIndex,
      hints: [
        "三つの掟をひとつずつ確かめよう。ひとつでも破る道順は外れだ。",
        `「${forbidden}」が入っている道順は、掟一の時点で外れ。`,
        `「${start}」で始まり「${goal}」で終わる道順だけが正解だ。`
      ],
      explain: `三つの掟すべてに合うのは「${correct}」だけでした。`
    };
  }

  // 4. 証言すいり(矛盾さがし)
  function genTestimony(rng, p, missionItem) {
    const ws = pickN(rng, DATA.witnesses, 3);
    const place = pick(rng, DATA.places);
    const variant = rng() < 0.5 ? 0 : 1;
    let intro, statements, liar, why;
    if (variant === 0) {
      const t = 1 + Math.floor(rng() * (DATA.times.length - 1)); // 1..3
      const before = DATA.times[t - 1], when = DATA.times[t];
      intro = `${missionItem}が${place}から消えたのは「${when}」ごろ。それだけは確かだ。`;
      statements = [
        `${ws[0]}「${before}に${place}の前を通ったが、${missionItem}はまだ確かにあった」`,
        `${ws[1]}「${when}ごろ、${place}のあたりから走り去る影を見た」`,
        `${ws[2]}「いやいや、${before}にはもう${missionItem}は消えていたよ」`
      ];
      liar = ws[2];
      why = `消えたのは「${when}」ごろ。なのに${ws[2]}だけが「${before}にはもう消えていた」と、確かな事実と食いちがうことを言っています。`;
    } else {
      const ev = pick(rng, DATA.gatherEvents);
      const placeB = pick(rng, DATA.places.filter(pl => pl !== place));
      intro = `その刻、${ws[2]}が${place}の${ev}に出ていたことは、里の皆が見ていて間違いない。`;
      statements = [
        `${ws[0]}「わたしは店の帳場にいた。番頭も一緒だった」`,
        `${ws[1]}「${ev}の手伝いをしていたよ。${ws[2]}さんも来ていたね」`,
        `${ws[2]}「その刻、わたしはひとりで${placeB}にいた」`
      ];
      liar = ws[2];
      why = `${ws[2]}は皆に${place}の${ev}で姿を見られているのに、「ひとりで${placeB}にいた」と話が食いちがっています。`;
    }
    const m = mixChoices(rng, liar, ws.filter(w => w !== liar), 3);
    return {
      type: "testimony", typeLabel: "証言すいり", title: "食いちがう証言",
      prompt: `${intro}\n三人の証言のうち、話が食いちがっているのは誰?`,
      visual: { kind: "lines", lines: statements },
      choices: m.choices, answerIndex: m.answerIndex,
      hints: [
        "まず「確かなこと」を押さえよう。それと食いちがう証言がひとつだけある。",
        variant === 0 ? "『いつ消えたか』に注目。時刻の合わない証言はどれ?" : "『その刻どこにいたか』に注目。皆が見ていた場所と違うことを言うのは?",
        `……${liar}の言い分だけ、確かな事実と合わない。`
      ],
      explain: why
    };
  }

  // 5. 違和感さがし
  function genOddity(rng, p) {
    const scene = pick(rng, DATA.oddScenes);
    const odd = pick(rng, DATA.oddItems);
    const items = shuffle(rng, scene.items.slice(0, 5).concat([odd.t]));
    return {
      type: "oddity", typeLabel: "違和感さがし", title: `${scene.name}の違和感`,
      prompt: `${scene.name}を描いた絵図がある。だが一つだけ、この時代にそぐわない物が紛れこんでいる。どれ?`,
      visual: { kind: "grid", items: items },
      choices: items, answerIndex: items.indexOf(odd.t),
      hints: [
        "描かれているのは、電気も機械もない時代の景色だ。",
        "「その時代の職人に作れるか?」と一つずつ考えてみよう。",
        `……${odd.t.split(" ")[1] || odd.t} は、どう見ても後の世の物だ。`
      ],
      explain: `${odd.t} が仲間はずれ。${odd.why}。`
    };
  }

  // 6. 記憶ミッション
  function genMemory(rng, p) {
    const shown = pickN(rng, DATA.memoryItems, p.memN);
    const notShown = pick(rng, DATA.memoryItems.filter(it => !shown.includes(it)));
    const variant = rng() < 0.5 ? 0 : 1;
    let promptQ, correct, decoys;
    if (variant === 0) {
      promptQ = "さっきの巻物に「無かった」ものはどれ?";
      correct = `${notShown.e} ${notShown.n}`;
      decoys = pickN(rng, shown, 3).map(it => `${it.e} ${it.n}`);
    } else {
      const idx = Math.floor(rng() * shown.length);
      promptQ = `巻物の ${idx + 1}番目 に描かれていたものは?`;
      correct = `${shown[idx].e} ${shown[idx].n}`;
      decoys = shuffle(rng, shown.filter((_, i) => i !== idx).map(it => `${it.e} ${it.n}`).concat([`${notShown.e} ${notShown.n}`]));
    }
    const m = mixChoices(rng, correct, decoys, p.nc);
    return {
      type: "memory", typeLabel: "記憶ミッション", title: "一瞬の巻物",
      prompt: promptQ,
      memorize: {
        note: "巻物を心に焼きつけよ。覚えたら「覚えた」を押すと巻物は閉じる。",
        items: shown.map((it, i) => `${i + 1}. ${it.e} ${it.n}`)
      },
      visual: null,
      choices: m.choices, answerIndex: m.answerIndex,
      hints: [
        "目を閉じて、巻物の並びを最初から思い出してみよう。",
        variant === 0 ? "巻物にあった物を声に出して数えてみると、無い物が浮かぶ。" : "前後に何があったかを思い出すと、その場所も見えてくる。",
        `答えは「${correct}」だった気がする…。`
      ],
      explain: variant === 0
        ? `巻物にあったのは ${shown.map(it => it.n).join("・")}。${notShown.n} はありませんでした。`
        : `巻物の並びは ${shown.map((it, i) => `${i + 1}.${it.n}`).join(" ")} でした。`
    };
  }

  // 7. 忍具えらび
  function genTool(rng, p) {
    const scene = pick(rng, DATA.toolScenes);
    const correctTool = DATA.tools.find(t => t.id === scene.correct);
    const correct = `${correctTool.e} ${correctTool.name}`;
    const decoys = pickN(rng, DATA.tools.filter(t => t.id !== scene.correct), 4).map(t => `${t.e} ${t.name}`);
    const m = mixChoices(rng, correct, decoys, p.nc);
    return {
      type: "tool", typeLabel: "忍具えらび", title: "この任務、どの忍具?",
      prompt: `任務の場面はこうだ。\n「${scene.q}」\nこの場面にいちばん合う忍具はどれ?`,
      visual: null,
      choices: m.choices, answerIndex: m.answerIndex,
      hints: [
        "場面の「してはいけないこと」「しなければならないこと」を整理しよう。",
        "それぞれの忍具が「何のための道具か」を思い出そう。合わない物から消していけばいい。",
        `この場面なら「${correctTool.name}」が定石だ。`
      ],
      explain: scene.why
    };
  }

  // 8. 和文化クイズ(固定80問から出題)
  function genQuiz(rng, p, usedIdx) {
    let pool = DATA.quiz.map((_, i) => i).filter(i => !usedIdx.includes(i));
    if (pool.length === 0) pool = DATA.quiz.map((_, i) => i);
    const qi = pick(rng, pool);
    const q = DATA.quiz[qi];
    const correct = q.c[q.a];
    const m = mixChoices(rng, correct, q.c.filter((_, i) => i !== q.a), p.nc);
    const wrong2 = m.choices.filter(c => c !== correct).slice(0, 2);
    return {
      type: "waculture", typeLabel: "和文化クイズ", title: "旅先の物知り帖", quizIndex: qi,
      prompt: q.q,
      visual: null,
      choices: m.choices, answerIndex: m.answerIndex,
      hints: [
        "知らなくても大丈夫。あきらかに違うものから消していこう。",
        wrong2.length >= 2 ? `少なくとも「${wrong2[0]}」と「${wrong2[1]}」ではないようだ。` : "選択肢を二つまでしぼってみよう。",
        `風のうわさでは「${correct}」だとか…。`
      ],
      explain: q.ex
    };
  }

  // 9. 数の謎(和算ふう)
  function genNumber(rng, p, diff) {
    const variant = Math.floor(rng() * 4);
    let prompt, ans, near, title;
    if (variant === 0) {
      // 階差数列
      const a0 = 2 + Math.floor(rng() * 5);
      const d0 = 1 + Math.floor(rng() * 2);
      const inc = diff === "hard" ? 2 : 1;
      const seq = [a0];
      let d = d0;
      for (let i = 0; i < 4; i++) { seq.push(seq[seq.length - 1] + d); d += inc; }
      ans = seq[4]; near = [ans - d + inc, ans + d, ans - 1];
      title = "石段の数列";
      prompt = `古い石段に数が刻まれている。\n${seq.slice(0, 4).join(" 、 ")} 、 ?\n「?」に入る数は?`;
    } else if (variant === 1) {
      // 掛け算文章
      const n = 3 + Math.floor(rng() * (diff === "hard" ? 7 : 4));
      const mm = 3 + Math.floor(rng() * (diff === "hard" ? 6 : 3));
      ans = n * mm; near = [ans + n, ans - mm, ans + mm];
      title = "灯籠のろうそく";
      prompt = `祭りの支度で、灯籠を ${n}基 ならべる。灯籠ひとつに ろうそくが ${mm}本 いる。\nろうそくは全部で何本?`;
    } else if (variant === 2) {
      // 和差算
      const b = 2 + Math.floor(rng() * 4) * 2;
      const x = 4 + Math.floor(rng() * 6);
      const total = x * 2 + b;
      ans = x + b; near = [x, ans - 1, ans + 2];
      title = "茶屋の勘定";
      prompt = `茶屋で団子の串と饅頭を合わせて ${total}個 買った。団子の串は饅頭より ${b}個 多い。\n団子の串は何個?`;
    } else {
      // 石段のぼりおり
      const up1 = 10 + Math.floor(rng() * 20);
      const down = 3 + Math.floor(rng() * Math.min(8, up1 - 2));
      const up2 = 5 + Math.floor(rng() * 15);
      ans = up1 - down + up2; near = [up1 + down + up2, ans + down, ans - up2];
      title = "寺の石段";
      prompt = `寺の石段を ${up1}段 のぼり、忘れ物に気づいて ${down}段 おり、また ${up2}段 のぼった。\n今、下から何段目?`;
    }
    const m = mixChoices(rng, String(ans), near.map(String), p.nc);
    return {
      type: "number", typeLabel: "数の謎", title: title,
      prompt: prompt, visual: null,
      choices: m.choices, answerIndex: m.answerIndex,
      hints: [
        "紙とペンはいらない。頭の中で順番に整理しよう。",
        variant === 0 ? "となり同士の差がどう変わっているかを見てみよう。" :
        variant === 1 ? "「いくつ分」の掛け算で求められる。" :
        variant === 2 ? "多い分をいったん脇に置くと、残りはちょうど半分ずつ。" :
                        "のぼりは足し算、おりは引き算。順番に。",
        `そろばんの神様いわく、答えは「${ans}」。`
      ],
      explain: `答えは ${ans}。落ち着いて順に数えれば大丈夫。`
    };
  }

  // 10. 暦と月の謎
  function genKoyomi(rng, p) {
    const variant = Math.floor(rng() * 4);
    let prompt, correct, decoys, explain, title;
    if (variant === 0) {
      const i = Math.floor(rng() * 12);
      title = "旧暦の言い伝え";
      prompt = `旧暦の月の名前「${DATA.kyureki[i]}」。これは今でいう何月?`;
      correct = `${i + 1}月`;
      decoys = [((i + 1) % 12) + 1 + "月", ((i + 11) % 12) + 1 + "月", ((i + 5) % 12) + 1 + "月"];
      explain = `${DATA.kyureki[i]}は${i + 1}月の旧い呼び名です。睦月から順に数えると分かります。`;
    } else if (variant === 1) {
      const i = Math.floor(rng() * 12);
      const next = DATA.eto[(i + 1) % 12];
      title = "干支のならび";
      prompt = `干支のならびで「${DATA.eto[i]}(${DATA.etoYomi[i]})」の次に来るのは?`;
      correct = next;
      decoys = [DATA.eto[(i + 2) % 12], DATA.eto[(i + 11) % 12], DATA.eto[(i + 6) % 12]];
      explain = `子丑寅卯辰巳午未申酉戌亥。「${DATA.eto[i]}」の次は「${next}」です。`;
    } else if (variant === 2) {
      const i = Math.floor(rng() * DATA.moonPhases.length);
      const next = DATA.moonPhases[(i + 1) % DATA.moonPhases.length];
      title = "月の満ち欠け";
      prompt = `月の満ち欠けのならびで、「${DATA.moonPhases[i]}」の次に来る月の姿は?`;
      correct = next;
      decoys = DATA.moonPhases.filter(mp => mp !== correct && mp !== DATA.moonPhases[i]).slice(0, 3);
      explain = `月は 新月→三日月→上弦→満月→下弦 の順でめぐります。「${DATA.moonPhases[i]}」の次は「${next}」。`;
    } else {
      const i = Math.floor(rng() * 12);
      const koku = DATA.kokuList[i];
      title = "昔の時刻";
      prompt = `昔の時刻「${koku.name}」は、今のおよそ何時ごろ?`;
      correct = koku.hour;
      decoys = pickN(makeRng("koku" + i), DATA.kokuList.filter(k2 => k2.name !== koku.name), 3).map(k2 => k2.hour);
      explain = `${koku.name}は${koku.hour}。子の刻(午前0時)から2時間ずつ進みます。`;
    }
    const m = mixChoices(rng, correct, decoys, p.nc);
    return {
      type: "koyomi", typeLabel: "暦と月の謎", title: title,
      prompt: prompt, visual: null,
      choices: m.choices, answerIndex: m.answerIndex,
      hints: [
        variant === 0 ? "睦月・如月・弥生…と、1月から順に数えてみよう。" :
        variant === 1 ? "「ね・うし・とら・う…」と口ずさんでみよう。" :
        variant === 2 ? "月は「見えない→細い→半分→まんまる→また半分」とめぐる。" :
                        "子の刻が午前0時ごろ。そこから2時間きざみだ。",
        "落ち着いて、はじめから順にたどれば必ず着く。",
        `月のささやきによれば「${correct}」…。`
      ],
      explain: explain
    };
  }

  // ---------- 生成の割り振り ----------
  const GENERATORS = {
    cipher_shift: (c) => genCipherShift(c.rng, c.p),
    cipher_dir:   (c) => genCipherDir(c.rng, c.p),
    map:          (c) => genMap(c.rng, c.p, c.area),
    testimony:    (c) => genTestimony(c.rng, c.p, c.missionItem),
    oddity:       (c) => genOddity(c.rng, c.p),
    memory:       (c) => genMemory(c.rng, c.p),
    tool:         (c) => genTool(c.rng, c.p),
    waculture:    (c) => genQuiz(c.rng, c.p, c.usedQuiz),
    number:       (c) => genNumber(c.rng, c.p, c.diff),
    koyomi:       (c) => genKoyomi(c.rng, c.p)
  };
  const ALL_TYPES = Object.keys(GENERATORS);

  // ---------- 本日の任務を組み立てる ----------
  // seedStr: "2026-07-04" など / diff: easy|normal|hard / usedQuiz: 出題済みクイズ添字
  function buildMission(seedStr, diff, usedQuiz) {
    const rng = makeRng("meguri:" + seedStr + ":" + diff);
    const p = params(diff);
    // エリアは日替わりローテーション+シードで開始位置をずらす
    const dayNum = Math.floor(new Date(seedStr.slice(0, 10) + "T12:00:00").getTime() / 86400000) || 0;
    const area = DATA.areas[DATA.areaOrder[((dayNum % 3) + 3) % 3]];
    const missionItem = pick(rng, DATA.missionItems);
    const title = fill(pick(rng, DATA.missionTitles), { item: missionItem });
    const intro = fill(pick(rng, DATA.missionIntros), { area: area.name, item: missionItem });
    const types = pickN(rng, ALL_TYPES, 3);
    const ctx = { rng, p, area, missionItem, usedQuiz: usedQuiz || [], diff };
    const steps = types.map(t => GENERATORS[t](ctx));
    return { seed: seedStr, areaId: area.id, title, intro, steps };
  }

  // ---------- 腕試し(自由プレイ・1問) ----------
  function buildFreePlay(seedStr, diff, usedQuiz) {
    const rng = makeRng("free:" + seedStr);
    const p = params(diff);
    const area = DATA.areas[pick(rng, DATA.areaOrder)];
    const missionItem = pick(rng, DATA.missionItems);
    const type = pick(rng, ALL_TYPES);
    const ctx = { rng, p, area, missionItem, usedQuiz: usedQuiz || [], diff };
    return { puzzle: GENERATORS[type](ctx), areaId: area.id };
  }

  return { buildMission, buildFreePlay, makeRng, pick, shuffle, fill };
})();
