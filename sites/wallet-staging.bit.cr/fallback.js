(() => {
  "use strict";

  const config = globalThis.bitcreditWalletSite;
  const action = document.body.dataset.action;
  const scheme = config?.customScheme || document.body.dataset.scheme;
  const button = document.getElementById("open-wallet");
  const status = document.getElementById("status");
  const androidInstall = document.getElementById("android-install");
  const iosInstall = document.getElementById("ios-install");
  const url = new URL(window.location.href);
  let payload = url.searchParams.get("data");

  function configureInstallLink(link, value, defaultLabel) {
    if (!link || !value || value.startsWith("REPLACE_WITH_")) return false;

    try {
      const installUrl = new URL(value);
      if (installUrl.protocol !== "https:") return false;
      link.href = installUrl.toString();
      link.textContent = installUrl.hostname === "testflight.apple.com"
        ? "Join the iOS beta on TestFlight"
        : defaultLabel;
      link.hidden = false;
      return true;
    } catch {
      return false;
    }
  }

  const hasAndroidInstall = configureInstallLink(
    androidInstall,
    config?.androidInstallUrl,
    "Get it on Google Play",
  );
  const hasIOSInstall = configureInstallLink(
    iosInstall,
    config?.iosInstallUrl,
    "Download on the App Store",
  );
  const userAgent = navigator.userAgent || "";
  const isAndroid = /Android/i.test(userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (isAndroid && iosInstall) {
    iosInstall.hidden = true;
    if (hasAndroidInstall) androidInstall.classList.add("recommended");
  } else if (isIOS && androidInstall) {
    androidInstall.hidden = true;
    if (hasIOSInstall) iosInstall.classList.add("recommended");
  }

  if (!payload) {
    const prefix = `/${action}/`;
    if (url.pathname.startsWith(prefix)) {
      const encodedPayload = url.pathname.slice(prefix.length).split("/", 1)[0];
      try {
        payload = encodedPayload ? decodeURIComponent(encodedPayload) : null;
      } catch {
        payload = null;
      }
    }
  }

  // Remove bearer-like data from the visible URL and current history entry.
  try {
    window.history.replaceState(null, "", `/${action}/`);
  } catch {
    // The fallback still works if a browser disallows history replacement.
  }

  if (!payload || !action || !scheme) {
    button.disabled = true;
    status.textContent = "This wallet link is incomplete or invalid.";
    return;
  }

  button.addEventListener("click", () => {
    window.location.assign(`${scheme}://${action}/${encodeURIComponent(payload)}`);
  });
})();
