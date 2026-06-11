const CACHE_NAME = "focus-planner-v1";
const APP_SHELL = ["/icon.svg", "/maskable-icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkOnlyWithOfflineFallback(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
  }
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {
    payload = {};
  }
  const title = payload.title || "Focus Planner";
  const options = {
    body: payload.body || "",
    icon: "/icon.svg",
    badge: "/maskable-icon.svg",
    data: {
      url: payload.url || "/",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin)
    .href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const client = clients.find((item) => item.url === targetUrl);

        if (client) {
          return client.focus();
        }

        return self.clients.openWindow(targetUrl);
      }),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/maskable-icon.svg" ||
    url.pathname === "/manifest.webmanifest"
  );
}

async function networkOnlyWithOfflineFallback(request) {
  try {
    return await fetch(request);
  } catch {
    return offlineResponse();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}

function offlineResponse() {
  return new Response(
    `<!doctype html>
      <html lang="ja">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Focus Planner</title>
          <style>
            body {
              margin: 0;
              min-height: 100vh;
              display: grid;
              place-items: center;
              background: #f7f4ee;
              color: #17201c;
              font-family: Arial, "Hiragino Sans", "Yu Gothic", Meiryo, sans-serif;
            }
            main {
              width: min(420px, calc(100% - 32px));
              padding: 28px;
              border: 1px solid #dbe2dc;
              border-radius: 8px;
              background: #fff;
              box-shadow: 0 18px 60px rgba(37, 48, 43, 0.12);
            }
            h1 {
              margin: 0 0 10px;
              font-size: 1.35rem;
            }
            p {
              margin: 0;
              color: #62706a;
              line-height: 1.7;
            }
          </style>
        </head>
        <body>
          <main>
            <h1>オフラインです</h1>
            <p>接続が戻ったら、このページを再読み込みしてください。</p>
          </main>
        </body>
      </html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    },
  );
}
