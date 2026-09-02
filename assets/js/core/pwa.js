(function () {
  "use strict";

  const App = window.LocalApp;
  const config = App.config;
  const storage = App.storage;
  let registration = null;
  let refreshing = false;
  let refreshFallbackTimer = 0;

  function versionedAsset(path) {
    return path + "?v=" + encodeURIComponent(config.identity.buildId);
  }

  function installed() {
    return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  }

  function detectDevice() {
    const ua = navigator.userAgent || "";
    const touchMac = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    if (/iPhone|iPod/i.test(ua)) return { id: "iphone", label: "iPhone" };
    if (/iPad/i.test(ua) || touchMac) return { id: "ipad", label: "iPad" };
    if (/Android/i.test(ua)) return { id: /Mobile/i.test(ua) ? "android-phone" : "android-tablet", label: /Mobile/i.test(ua) ? "Android phone" : "Android tablet" };
    if (/Macintosh|Mac OS X/i.test(ua)) return { id: "mac", label: "Mac" };
    if (/Windows/i.test(ua)) return { id: "windows", label: "Windows PC" };
    return { id: "other", label: "PC or other device" };
  }

  function effectiveDark() {
    const mode = storage.getState().preferences.appearance.mode;
    return mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  }

  function applyAppearanceAssets() {
    const dark = effectiveDark();
    const variant = dark ? "dark" : "light";
    const manifest = document.querySelector("link[rel='manifest']");
    if (manifest) manifest.href = versionedAsset(dark ? config.identity.assets.manifestDark : config.identity.assets.manifestLight);
    const apple = document.querySelector("link[rel='apple-touch-icon']");
    if (apple) apple.href = versionedAsset(variant === "dark" ? "assets/icons/apple-touch-icon-dark.png" : "assets/icons/apple-touch-icon.png");
    const theme = document.querySelector("meta[name='theme-color']:not([media])");
    if (theme) theme.content = dark ? "#121616" : "#f5f3ed";
    document.documentElement.dataset.installIcon = variant;
  }

  function forceRefreshUrl() {
    const target = new URL(location.href);
    target.searchParams.set("force-refresh", String(Date.now()));
    return target.href;
  }

  function forceRefresh(worker) {
    if (refreshing) return;
    refreshing = true;
    const waitingWorker = worker || registration && registration.waiting;
    if (waitingWorker) waitingWorker.postMessage({ type: "SKIP_WAITING" });
    if (registration && typeof registration.update === "function") registration.update().catch(function () {});
    window.clearTimeout(refreshFallbackTimer);
    refreshFallbackTimer = window.setTimeout(function () { location.replace(forceRefreshUrl()); }, waitingWorker ? 1200 : 0);
  }

  function updateAvailable(worker) {
    const lockedNotice = document.querySelector("#accessUpdateNotice");
    const lockedAction = document.querySelector("#accessUpdateButton");
    if (document.body.classList.contains("access-locked") && lockedNotice && lockedAction) {
      lockedNotice.hidden = false;
      lockedAction.onclick = function () { forceRefresh(worker); };
      lockedAction.setAttribute("aria-keyshortcuts", "R");
      lockedAction.dataset.shortcut = "R";
      if (!document.querySelector("#accessPassphrase")?.value) lockedAction.focus({ preventScroll: true });
      return;
    }
    App.components.toast("A newer app version is ready. Force refresh to install it now.", {
      title: "New version available",
      kind: "info",
      duration: 0,
      actionLabel: "Force refresh",
      actionSymbol: "arrowClockwise",
      onAction: function () { forceRefresh(worker); }
    });
    const action = document.querySelector("#appToast [data-toast-action]");
    if (action) {
      action.setAttribute("aria-keyshortcuts", "R");
      action.dataset.shortcut = "R";
    }
    const close = document.querySelector("#appToast [data-toast-close]");
    if (close) {
      close.setAttribute("aria-keyshortcuts", "X");
      close.dataset.shortcut = "X";
    }
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;
    try {
      registration = await navigator.serviceWorker.register("sw.js", { updateViaCache: "none" });
      if (registration.waiting && navigator.serviceWorker.controller) updateAvailable(registration.waiting);
      registration.addEventListener("updatefound", function () {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", function () {
          if (worker.state === "installed" && navigator.serviceWorker.controller) updateAvailable(worker);
        });
      });
      navigator.serviceWorker.addEventListener("controllerchange", function () {
        if (refreshing) {
          window.clearTimeout(refreshFallbackTimer);
          location.replace(forceRefreshUrl());
        }
      });
    } catch (error) {
      window.dispatchEvent(new CustomEvent("app:pwaerror", { detail: { message: "Offline installation is unavailable in this browser session." } }));
    }
  }

  function networkStatus() {
    return navigator.onLine === false ? { online: false, label: "Offline", message: "Local features remain available." } : { online: true, label: "Online", message: "Optional internet features are available." };
  }

  function init() {
    applyAppearanceAssets();
    registerServiceWorker();
    document.addEventListener("keydown", function (event) {
      const notice = document.querySelector("#accessUpdateNotice");
      const action = document.querySelector("#accessUpdateButton");
      if (event.code !== "KeyR" || event.metaKey || event.repeat || App.utils.isEditableTarget(event.target) || !document.body.classList.contains("access-locked") || !notice || notice.hidden || !action) return;
      event.preventDefault();
      action.click();
    });
    window.addEventListener("appinstalled", function () {
      App.components.toast("The application was added to this device.", { title: "Installed", kind: "success" });
    });
    ["online", "offline"].forEach(function (name) {
      window.addEventListener(name, function () { window.dispatchEvent(new CustomEvent("app:networkchange", { detail: networkStatus() })); });
    });
    const appearanceQuery = window.matchMedia("(prefers-color-scheme: dark)");
    if (typeof appearanceQuery.addEventListener === "function") appearanceQuery.addEventListener("change", applyAppearanceAssets);
    else if (typeof appearanceQuery.addListener === "function") appearanceQuery.addListener(applyAppearanceAssets);
    window.addEventListener("app:statechange", applyAppearanceAssets);
  }

  App.pwa = {
    init: init,
    detectDevice: detectDevice,
    installed: installed,
    networkStatus: networkStatus,
    applyAppearanceAssets: applyAppearanceAssets,
    forceRefresh: forceRefresh,
    getRegistration: function () { return registration; }
  };
})();
