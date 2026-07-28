// Service Worker: オフラインでも遊べるようにキャッシュする
//
// v3 の変更点
//  - HTML(ページ遷移)は「ネットワーク優先」に変更。
//    v2 までは全部キャッシュ優先だったため、ページを追加・更新しても
//    一度アクセスした端末には古い内容が出つづけていた。
//  - CSS/JS/画像は「キャッシュ優先＋裏で更新」。表示の速さは保つ。
//  - 広告(pagead2.googlesyndication.com など)は別オリジンなので一切さわらない。
const CACHE = "nazomeguri-v3";

// インストール時に必ず取りにいくもの(1つでも失敗するとインストールが失敗するので最小限)
const CORE = [
  "./",
  "./index.html",
  "./style.css",
  "./data.js",
  "./gen.js",
  "./game.js",
  "./ads.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./img/leelee.png",
  "./img/orochi.png",
  "./img/luna.png"
];

// あとから使うときにキャッシュされればよいもの(読みもの・規約ページ)
const EXTRA = [
  "./pages.css",
  "./guide.html",
  "./wa-koyomi.html",
  "./ninja-jiten.html",
  "./about.html",
  "./privacy.html",
  "./terms.html",
  "./contact.html"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(CORE).then(() => {
        // EXTRA は失敗しても無視する(1ファイルの404でインストールを壊さない)
        EXTRA.forEach(u => c.add(u).catch(() => {}));
      }))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (!req.url.startsWith(self.location.origin)) return; // 広告や外部リソースは素通し

  // ページ遷移: ネットワーク優先(つながらなければキャッシュ)
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req, { ignoreSearch: true })
            .then(cached => cached || caches.match("./index.html"))
        )
    );
    return;
  }

  // それ以外(CSS/JS/画像): キャッシュ優先、裏でこっそり更新
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(cached => {
      const network = fetch(req).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
