(() => {
  "use strict";

  const config = globalThis.bitcreditWalletSite;
  const action = document.body.dataset.action;
  const scheme = config?.customScheme || document.body.dataset.scheme;
  const button = document.getElementById("open-wallet");
  const openInstalled = document.getElementById("open-installed");
  const status = document.getElementById("status");
  const androidInstall = document.getElementById("android-install");
  const iosInstall = document.getElementById("ios-install");
  const desktopQr = document.getElementById("desktop-qr");
  const qrCode = document.getElementById("qr-code");
  const actionLink = window.location.href;
  const url = new URL(actionLink);
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

  // Switches an element to another translation key, so a later language
  // change keeps translating it; English stands in when i18n.js is missing.
  function setTranslatedText(element, key, english) {
    element.dataset.i18n = key;
    element.textContent = english;
    globalThis.bitcreditI18n?.apply(element);
  }

  function configureInstallLink(link, value) {
    if (!link) return;
    if (!value || value.startsWith("REPLACE_WITH_")) {
      link.hidden = true;
      return;
    }

    try {
      const installUrl = new URL(value);
      if (installUrl.protocol !== "https:") throw new Error("Install links must use HTTPS");
      link.href = installUrl.toString();
      if (installUrl.hostname === "testflight.apple.com") {
        const caption = link.querySelector(".store-badge-caption");
        const name = link.querySelector(".store-badge-name");
        if (caption) setTranslatedText(caption, "install.testFlight", "Join the beta on");
        if (name) name.textContent = "TestFlight";
      }
    } catch {
      link.hidden = true;
    }
  }

  configureInstallLink(iosInstall, config?.iosInstallUrl);
  configureInstallLink(androidInstall, config?.androidInstallUrl);

  const userAgent = navigator.userAgent || "";
  const isMobile = /Android|iPhone|iPad|iPod/i.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (!isMobile && openInstalled) openInstalled.hidden = true;

  function showDesktopQr() {
    const qr = globalThis.bitcreditQr;
    if (isMobile || !desktopQr || !qrCode || !qr) return;

    const modules = qr.encodeText(actionLink);
    if (!modules) return;

    const displaySize = Math.min(288, Math.max(160, modules.length * 2));
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    svg.setAttribute("viewBox", `0 0 ${modules.length} ${modules.length}`);
    svg.setAttribute("width", String(displaySize));
    svg.setAttribute("height", String(displaySize));
    svg.setAttribute("shape-rendering", "crispEdges");
    // The container carries the translated label.
    svg.setAttribute("aria-hidden", "true");
    svg.style.width = `${displaySize}px`;
    svg.style.height = `${displaySize}px`;

    let pathData = "";
    modules.forEach((row, y) => {
      row.forEach((dark, x) => {
        if (dark) pathData += `M${x} ${y}h1v1h-1z`;
      });
    });
    const path = document.createElementNS(namespace, "path");
    path.setAttribute("d", pathData);
    path.setAttribute("fill", "#000000");
    svg.appendChild(path);

    qrCode.replaceChildren(svg);
    desktopQr.hidden = false;
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
    if (openInstalled) openInstalled.hidden = true;
    setTranslatedText(status, "link.invalid", "This wallet link is incomplete or invalid.");
    return;
  }

  showDesktopQr();

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
