(() => {
  "use strict";

  const config = globalThis.bitcreditWalletSite;
  const openWallet = document.getElementById("open-wallet");
  const androidInstall = document.getElementById("android-install");
  const iosInstall = document.getElementById("ios-install");
  const desktopQr = document.getElementById("desktop-qr");
  const userAgent = navigator.userAgent || "";
  const isMobile = /Android|iPhone|iPad|iPod/i.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  function configureInstallLink(link, value) {
    if (!value || value.startsWith("REPLACE_WITH_")) {
      link.hidden = true;
      return;
    }

    try {
      const url = new URL(value);
      if (url.protocol !== "https:") throw new Error("Install links must use HTTPS");
      link.href = url.toString();
      if (url.hostname === "testflight.apple.com") {
        link.querySelector(".store-badge-caption").textContent = "Join the beta on";
        link.querySelector(".store-badge-name").textContent = "TestFlight";
      }
    } catch {
      link.hidden = true;
    }
  }

  if (config?.customScheme) {
    openWallet.href = `${config.customScheme}://open`;
  } else {
    openWallet.hidden = true;
  }

  configureInstallLink(iosInstall, config?.iosInstallUrl);
  configureInstallLink(androidInstall, config?.androidInstallUrl);

  if (!isMobile) {
    openWallet.hidden = true;
    desktopQr.hidden = false;
  }
})();
