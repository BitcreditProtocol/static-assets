(() => {
  "use strict";

  const config = globalThis.bitcreditEbillSite;
  const openApp = document.getElementById("open-app");
  const desktopQr = document.getElementById("desktop-qr");
  const appActions = document.getElementById("app-actions");
  const userAgent = navigator.userAgent || "";
  const isMobile = /Android|iPhone|iPad|iPod/i.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (config?.customScheme && isMobile) {
    openApp.href = `${config.customScheme}://open`;
    openApp.hidden = false;
    appActions.hidden = false;
  } else if (!isMobile) {
    desktopQr.hidden = false;
  }
})();
