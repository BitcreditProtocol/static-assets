(() => {
  "use strict";

  const config = globalThis.bitcreditEbillSite;
  const openApp = document.getElementById("open-app");
  const androidInstall = document.getElementById("android-install");
  const iosInstall = document.getElementById("ios-install");
  const desktopQr = document.getElementById("desktop-qr");
  const userAgent = navigator.userAgent || "";
  const isMobile = /Android|iPhone|iPad|iPod/i.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  // A placeholder hides the badge; a configured listing shows it.
  function configureInstallLink(link, value) {
    if (!value || value.startsWith("REPLACE_WITH_")) {
      link.hidden = true;
      return;
    }

    try {
      const url = new URL(value);
      if (url.protocol !== "https:") throw new Error("Install links must use HTTPS");
      link.href = url.toString();
      link.hidden = false;
      if (url.hostname === "testflight.apple.com") {
        const caption = link.querySelector(".store-badge-caption");
        caption.dataset.i18n = "install.testFlight";
        caption.textContent = "Join the beta on";
        globalThis.bitcreditI18n?.apply(caption);
        link.querySelector(".store-badge-name").textContent = "TestFlight";
      }
    } catch {
      link.hidden = true;
    }
  }

  if (config?.customScheme) {
    openApp.href = `${config.customScheme}://open`;
  } else {
    openApp.hidden = true;
  }

  configureInstallLink(iosInstall, config?.iosInstallUrl);
  configureInstallLink(androidInstall, config?.androidInstallUrl);

  if (!isMobile) {
    openApp.hidden = true;
    desktopQr.hidden = false;
  }
})();
