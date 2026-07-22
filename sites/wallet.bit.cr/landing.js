(() => {
  "use strict";

  const config = globalThis.bitcreditWalletSite;
  const openWallet = document.getElementById("open-wallet");
  const androidInstall = document.getElementById("android-install");
  const iosInstall = document.getElementById("ios-install");
  const desktopQr = document.getElementById("desktop-qr");
  const userAgent = navigator.userAgent || "";
  const isAndroid = /Android/i.test(userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  function configureInstallLink(link, value, defaultLabel) {
    if (!value || value.startsWith("REPLACE_WITH_")) return false;

    try {
      const url = new URL(value);
      if (url.protocol !== "https:") return false;
      link.href = url.toString();
      link.textContent = url.hostname === "testflight.apple.com"
        ? "Join the iOS beta on TestFlight"
        : defaultLabel;
      link.hidden = false;
      return true;
    } catch {
      return false;
    }
  }

  if (config?.customScheme) {
    openWallet.href = `${config.customScheme}://open`;
  } else {
    openWallet.hidden = true;
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

  if (isAndroid) {
    iosInstall.hidden = true;
    if (hasAndroidInstall) androidInstall.classList.add("recommended");
  } else if (isIOS) {
    androidInstall.hidden = true;
    if (hasIOSInstall) iosInstall.classList.add("recommended");
  } else {
    openWallet.hidden = true;
    desktopQr.hidden = false;
  }
})();
