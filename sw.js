"use strict";

const CACHE_NAME = "app-template-shell-0.0.1.2";
const ASSET_VERSION = "0.0.1.2";
const versioned = function (path) { return path + "?v=" + ASSET_VERSION; };
const SHELL = [
  "./",
  "./index.html",
  versioned("./manifest.webmanifest"),
  versioned("./manifest-dark.webmanifest"),
  versioned("./assets/css/app.css"),
  versioned("./assets/js/config.js"),
  versioned("./assets/js/icons.js"),
  versioned("./assets/js/core/utils.js"),
  versioned("./assets/js/core/state.js"),
  versioned("./assets/js/core/storage.js"),
  versioned("./assets/js/core/components.js"),
  versioned("./assets/js/core/portability.js"),
  versioned("./assets/js/core/sync.js"),
  versioned("./assets/js/core/pwa.js"),
  versioned("./assets/js/app.js"),
  versioned("./assets/icons/favicon.svg"),
  versioned("./assets/icons/app-icon-light.svg"),
  versioned("./assets/icons/app-icon-dark.svg"),
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-512-maskable.png",
  "./assets/icons/icon-192-dark.png",
  "./assets/icons/icon-512-dark.png",
  "./assets/icons/icon-512-maskable-dark.png",
  versioned("./assets/icons/apple-touch-icon.png"),
  versioned("./assets/icons/apple-touch-icon-dark.png"),
  versioned("./assets/icons/splash-light.png"),
  versioned("./assets/icons/splash-dark.png")
];

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function (cache) { return cache.addAll(SHELL); }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(Promise.all([
    caches.keys().then(function (keys) { return Promise.all(keys.filter(function (key) { return (key.startsWith("app-template-shell-") || key.startsWith("local-workspace-shell-")) && key !== CACHE_NAME; }).map(function (key) { return caches.delete(key); })); }),
    self.clients.claim()
  ]));
});

self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", function (event) {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request, { cache: "no-cache" }).then(function (response) {
      if (response && response.ok && response.type === "basic") {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put("./index.html", copy); });
      }
      return response;
    }).catch(function () { return caches.match("./index.html").then(function (cached) { return cached || Response.error(); }); }));
    return;
  }

  event.respondWith(fetch(request, { cache: "no-cache" }).then(function (response) {
      if (!response || !response.ok || response.type !== "basic") return response;
      const copy = response.clone();
      caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
      return response;
    }).catch(function () { return caches.match(request).then(function (cached) { return cached || Response.error(); }); }));
});
