(() => {
  "use strict";

  const config = globalThis.bitcreditEbillSite;
  const action = document.body.dataset.action;
  const scheme = config?.customScheme || document.body.dataset.scheme;
  const button = document.getElementById("open-app");
  const openInstalled = document.getElementById("open-installed");
  const openHint = document.getElementById("open-hint");
  const status = document.getElementById("status");
  const androidInstall = document.getElementById("android-install");
  const iosInstall = document.getElementById("ios-install");
  const desktopQr = document.getElementById("desktop-qr");
  const qrCode = document.getElementById("qr-code");
  const actionLink = window.location.href;
  const url = new URL(actionLink);
  // The eBills app names the contact payload `data` and the bill id `bill`
  // (`contactLink` and `billPaymentLink` in the app's `ebill_links.dart`), and
  // reads the custom-scheme handoff under the same names.
  const parameters = { contact: "data", pay: "bill" };
  const parameter = parameters[action];
  const payload = parameter ? url.searchParams.get(parameter)?.trim() || null : null;

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
      link.hidden = false;
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
  const isAndroid = /Android/i.test(userAgent);
  const isMobile = isAndroid || /iPhone|iPad|iPod/i.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  // The hint points at the "Open it now" link, so it goes wherever that does.
  function hideOpenInstalled() {
    if (openInstalled) openInstalled.hidden = true;
    if (openHint) openHint.hidden = true;
  }

  if (!isMobile) hideOpenInstalled();

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

  // Remove personal data from the visible URL and current history entry.
  try {
    window.history.replaceState(null, "", `/${action}/`);
  } catch {
    // The fallback still works if a browser disallows history replacement.
  }

  if (!payload || !scheme) {
    button.disabled = true;
    hideOpenInstalled();
    setTranslatedText(status, "link.invalid", "This eBills link is incomplete or invalid.");
    return;
  }

  showDesktopQr();

  button.addEventListener("click", () => {
    window.location.assign(appLink(`${action}/?${parameter}=${encodeURIComponent(payload)}`));
  });

  // Android browsers hand an `intent://` link straight to the named package,
  // and open the install page when it is missing. A bare custom-scheme link is
  // silently ignored by some of them, and this button is the only way into the
  // app when the system has not verified the App Link claim, as happens on
  // devices without Google Play services such as GrapheneOS. The app receives
  // the same `<scheme>://...` URI either way.
  function appLink(target) {
    const androidPackage = config?.androidPackage;
    if (!isAndroid || !androidPackage) return `${scheme}://${target}`;

    const extras = [`scheme=${scheme}`, `package=${androidPackage}`];
    const installUrl = config?.androidInstallUrl;
    if (installUrl && !installUrl.startsWith("REPLACE_WITH_")) {
      extras.push(`S.browser_fallback_url=${encodeURIComponent(installUrl)}`);
    }
    return `intent://${target}#Intent;${extras.join(";")};end`;
  }
})();
