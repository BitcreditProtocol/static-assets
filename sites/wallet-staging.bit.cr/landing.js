(() => {
  "use strict";

  const config = globalThis.bitcreditWalletSite;
  const openWallet = document.getElementById("open-wallet");
  const desktopQr = document.getElementById("desktop-qr");
  const walletActions = document.getElementById("wallet-actions");
  const userAgent = navigator.userAgent || "";
  const isMobile = /Android|iPhone|iPad|iPod/i.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (config?.customScheme && isMobile) {
    openWallet.href = `${config.customScheme}://open`;
    openWallet.hidden = false;
    walletActions.hidden = false;
  } else if (!isMobile) {
    desktopQr.hidden = false;
  }
})();
