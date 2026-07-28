/* ============================================================
   ads.js — ゲーム内広告(Google AdSense)
   ------------------------------------------------------------
   設定はこのファイルの ADS_CONFIG だけを書き換えれば動きます。
   詳しい手順は ADSENSE-SETUP.md を参照。

   方針(AdSenseポリシー遵守のため、ここは崩さないこと):
   1. 謎を解いている最中の画面には広告を出さない
      (選択肢ボタンの近くに広告があると誤クリックの温床になる)
   2. 広告枠は index.html に静的に置き、画面の再描画では作り直さない
      → 1枠あたり1ページロードにつき1リクエスト。自動リロードはしない
   3. 枠には必ず「スポンサーリンク」と明示する
   4. ボタンとの間隔を最低 36px 空ける
   ============================================================ */
(function (global) {
  "use strict";

  // ---------- ここを自分のAdSenseの値に書き換える ----------
  var ADS_CONFIG = {
    // AdSense管理画面 →「アカウント」→「アカウント情報」の "サイト運営者ID"
    client: "ca-pub-0000000000000000",

    // AdSense管理画面 →「広告」→「広告ユニットごと」で作った各ユニットのスロットID
    // (レスポンシブのディスプレイ広告で作るのが一番かんたん)
    slots: {
      home: "0000000000",   // ホーム下部
      result: "0000000000", // 任務クリア・腕試しクリアの結果画面
      list: "0000000000",   // 日記 / 里 / 蔵 の一覧下部
      article: "0000000000" // 読みものページ(guide.html など)
    }
  };
  // ---------------------------------------------------------

  var SCRIPT_URL = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";
  var loaded = false;
  var mounted = Object.create(null); // 二重pushの防止
  var tries = Object.create(null);   // 幅が出るまでの再試行回数
  var MAX_TRIES = 60;                // 約1秒。これで幅が出ないなら諦める

  /** 設定が本物のIDに書き換わっているか */
  function configured() {
    if (!ADS_CONFIG.client || ADS_CONFIG.client.indexOf("0000000000000000") >= 0) return false;
    return /^ca-pub-\d{16}$/.test(ADS_CONFIG.client);
  }

  function slotId(name) {
    var id = ADS_CONFIG.slots[name];
    return id && !/^0+$/.test(id) ? id : "";
  }

  /** AdSense本体を一度だけ読み込む */
  function loadScript() {
    if (loaded) return;
    loaded = true;
    var s = document.createElement("script");
    s.async = true;
    s.crossOrigin = "anonymous";
    s.src = SCRIPT_URL + "?client=" + encodeURIComponent(ADS_CONFIG.client);
    document.head.appendChild(s);
  }

  /**
   * 広告枠を表示する。
   * @param {string} id     index.html に置いた枠のid (例 "ad-home")
   * @param {string} name   ADS_CONFIG.slots のキー (例 "home")
   */
  function mount(id, name) {
    tries[id] = 0; // 呼ばれるたびに再試行の回数をリセットする
    attempt(id, name);
  }

  function attempt(id, name) {
    var box = document.getElementById(id);
    if (!box) return;

    // 未設定のときは枠ごと消す(空箱だけ残すと「価値の低いページ」に見える)
    if (!configured() || !slotId(name)) {
      box.hidden = true;
      if (!attempt._warned) {
        attempt._warned = true;
        console.info("[ads] ADS_CONFIG が未設定のため広告を表示しません。ADSENSE-SETUP.md を参照してください。");
      }
      return;
    }

    box.hidden = false;
    if (mounted[id]) return; // 1ページロードにつき1回だけ

    // 幅0のまま push すると広告が出ないので、見えてから積む。
    // ただし画面が切り替わって二度と見えない場合もあるので、回数で打ち切る。
    if (!box.offsetWidth) {
      tries[id] = (tries[id] || 0) + 1;
      if (tries[id] <= MAX_TRIES) requestAnimationFrame(function () { attempt(id, name); });
      return;
    }
    mounted[id] = true;

    loadScript();

    var label = document.createElement("div");
    label.className = "ad-label";
    label.textContent = "スポンサーリンク";

    var ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "block";
    ins.setAttribute("data-ad-client", ADS_CONFIG.client);
    ins.setAttribute("data-ad-slot", slotId(name));
    ins.setAttribute("data-ad-format", "auto");
    ins.setAttribute("data-full-width-responsive", "true");

    box.appendChild(label);
    box.appendChild(ins);

    try {
      (global.adsbygoogle = global.adsbygoogle || []).push({});
    } catch (e) {
      box.hidden = true;
    }
  }

  /** 枠を隠す(謎を解いている最中など) */
  function hide(id) {
    var box = document.getElementById(id);
    if (box) box.hidden = true;
  }

  global.Ads = { mount: mount, hide: hide, configured: configured };
})(window);
