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
  // The wallet app names the contact payload `nodeId` and every other payload
  // `data`. A contact link reads both, so links shared before this page knew
  // the difference keep opening.
  const payloadParameters = action === "contact" ? ["nodeId", "data"] : ["data"];
  // A wallet link carries its network as a path segment
  // (`/contact/bitcoin/?nodeId=...`) rather than as a second query parameter,
  // because WhatsApp and iMessage stop linkifying an https link that has one.
  const networkSegments = ["bitcoin", "testnet"];
  let payload = null;
  for (const parameter of payloadParameters) {
    if (!payload) payload = url.searchParams.get(parameter);
  }
  let network = url.searchParams.get("network");

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

  const prefix = `/${action}/`;
  if (url.pathname.startsWith(prefix)) {
    const segments = url.pathname
      .slice(prefix.length)
      .split("/")
      .filter((segment) => segment !== "");

    // A leading network segment is routing, not payload.
    if (segments.length > 0 && networkSegments.includes(segments[0].toLowerCase())) {
      const segment = segments.shift().toLowerCase();
      if (!network) network = segment;
    }

    if (!payload && segments.length > 0) {
      try {
        payload = decodeURIComponent(segments[0]);
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
    // The app reads a contact payload only from `nodeId`, so the custom-scheme
    // handoff has to name it too; pay and receive keep taking the payload as a
    // path segment. Passing `network` on lets the app switch networks by itself
    // instead of failing the link with a mismatch.
    const parameters = [];
    if (action === "contact") parameters.push(`nodeId=${encodeURIComponent(payload)}`);
    if (network) parameters.push(`network=${encodeURIComponent(network)}`);
    const query = parameters.length > 0 ? `?${parameters.join("&")}` : "";
    const path = action === "contact" ? "" : encodeURIComponent(payload);

    window.location.assign(`${scheme}://${action}/${path}${query}`);
  });
})();
