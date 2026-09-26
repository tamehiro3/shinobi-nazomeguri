// ============================================================
// 広告設定(Google AdSense)
//
// ・AdSenseの読み込みタグは index.html の <head> に1回だけ置いてある
//   (ここで二重に読み込むとエラーになるため、このファイルでは読み込まない)
// ・slot が空のあいだは広告枠を出さない(「準備中」の枠は審査で不利になるため)
// ・謎解き中(play画面)は広告を出さない。任務・日記・里・蔵・設定の画面の下に1枠だけ
// ・オフラインのとき/広告が配信されなかったときは枠ごと隠す
// ============================================================

const AD_CONFIG = {
  enabled: true,
  client: "ca-pub-2175971581635704",  // サイト運営者ID(設定済み)
  slot: ""   // AdSense管理画面 → 広告 → 広告ユニットごと → ディスプレイ広告 で作ったスロットID(数字10桁)を入れる
};

const ADS = (() => {
  let pushed = false;

  function area() { return document.getElementById("ad-area"); }

  function ready() {
    return AD_CONFIG.enabled && AD_CONFIG.client && AD_CONFIG.slot && navigator.onLine !== false;
  }

  // 初めて表示されたときに広告ユニットを差し込む(幅0で push するとエラーになるため)
  function mount(el) {
    if (pushed) return;
    pushed = true;
    const ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "block";
    ins.setAttribute("data-ad-client", AD_CONFIG.client);
    ins.setAttribute("data-ad-slot", AD_CONFIG.slot);
    ins.setAttribute("data-ad-format", "auto");
    ins.setAttribute("data-full-width-responsive", "true");
    el.appendChild(ins);
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { el.hidden = true; }
  }

  // 画面切り替えのたびに呼ぶ
  function update(screenName) {
    const el = area();
    if (!el) return;
    const show = ready() && screenName !== "play";
    el.hidden = !show;
    if (show) mount(el);
  }

  return { update };
})();
