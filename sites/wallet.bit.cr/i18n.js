(() => {
  "use strict";

  const strings = {
    en: {
      "title.root": "Bitcredit Wallet",
      "title.root.staging": "Bitcredit Wallet — Staging",
      "title.receive": "Open receive request in Bitcredit Wallet",
      "title.receive.staging": "Open staging receive request in Bitcredit Wallet",
      "title.pay": "Open payment in Bitcredit Wallet",
      "title.pay.staging": "Open staging payment in Bitcredit Wallet",
      "title.contact": "Add contact in Bitcredit Wallet",
      "title.contact.staging": "Add staging contact in Bitcredit Wallet",
      "title.notFound": "Invalid Bitcredit Wallet Link",
      "title.notFound.staging": "Invalid Bitcredit Wallet Staging Link",

      "receive.heading": "You’ve received e-cash",
      "receive.subtitle": "Install Bitcredit eCash\nto receive your payment.",
      "receive.after": "Open this link again to receive your e-cash in your new Bitcoin wallet.",
      "pay.heading": "You’ve received\na payment request",
      "pay.subtitle": "Install Bitcredit eCash\nto review and pay the request.",
      "pay.step.fund": "Fund your wallet.",
      "pay.step.open": "Open this link again to review the request and pay.",
      "contact.heading": "New wallet address",
      "contact.subtitle": "Install Bitcredit eCash.",
      "contact.after": "Open this link again to add the address as a payment contact in your wallet.",
      "link.invalid": "This wallet link is incomplete or invalid.",
      "after.heading": "After installation:",
      "open.installed": "Already have the app? Open it now",
      "open.staging": "Open staging wallet",
      "open.wallet": "Open wallet",

      "qr.caption": "Scan to open on your phone",
      "qr.label": "QR code for this wallet link",
      "install.label": "Install Bitcredit eCash",
      "install.appStore": "Download on the",
      "install.googlePlay": "Get it on",
      "install.testFlight": "Join the beta on",

      "root.description": "The Bitcoin-native, non-custodial wallet for sending, requesting and receiving e-cash.",
      "root.qr.label": "QR code for this website",
      "root.actions": "Wallet actions",
      "staging.label": "Staging",
      "staging.testers": "Staging builds are for authorized testers.",
      "notFound.heading": "Link not recognized",
      "notFound.text": "This is not a valid Bitcredit Wallet payment, receive or contact link.",
      "notFound.text.staging": "This is not a valid Bitcredit Wallet staging payment, receive or contact link.",

      "footer.copyright": "© 2026 Bitcredit Protocol.",
      "footer.released": "Released under the",
      "footer.license": "MIT license",
      "language.label": "Language",
    },
    es: {
      "title.root": "Bitcredit Wallet",
      "title.root.staging": "Bitcredit Wallet — Staging",
      "title.receive": "Abrir solicitud de cobro en Bitcredit Wallet",
      "title.receive.staging": "Abrir solicitud de cobro de staging en Bitcredit Wallet",
      "title.pay": "Abrir pago en Bitcredit Wallet",
      "title.pay.staging": "Abrir pago de staging en Bitcredit Wallet",
      "title.contact": "Añadir contacto en Bitcredit Wallet",
      "title.contact.staging": "Añadir contacto de staging en Bitcredit Wallet",
      "title.notFound": "Enlace de Bitcredit Wallet no válido",
      "title.notFound.staging": "Enlace de staging de Bitcredit Wallet no válido",

      "receive.heading": "Has recibido e-cash",
      "receive.subtitle": "Instala Bitcredit eCash\npara recibir tu pago.",
      "receive.after": "Vuelve a abrir este enlace para recibir tu e-cash en tu nueva billetera Bitcoin.",
      "pay.heading": "Has recibido\nuna solicitud de pago",
      "pay.subtitle": "Instala Bitcredit eCash\npara revisar y pagar la solicitud.",
      "pay.step.fund": "Añade fondos a tu billetera.",
      "pay.step.open": "Vuelve a abrir este enlace para revisar la solicitud y pagar.",
      "contact.heading": "Nueva dirección de billetera",
      "contact.subtitle": "Instala Bitcredit eCash.",
      "contact.after": "Vuelve a abrir este enlace para añadir la dirección como contacto de pago en tu billetera.",
      "link.invalid": "Este enlace de billetera está incompleto o no es válido.",
      "after.heading": "Después de instalarla:",
      "open.installed": "¿Ya tienes la app? Ábrela ahora",
      "open.staging": "Abrir billetera de staging",
      "open.wallet": "Abrir billetera",

      "qr.caption": "Escanéalo para abrirlo en tu teléfono",
      "qr.label": "Código QR de este enlace de billetera",
      "install.label": "Instala Bitcredit eCash",
      "install.appStore": "Descárgalo en el",
      "install.googlePlay": "Disponible en",
      "install.testFlight": "Únete a la beta en",

      "root.description": "La billetera nativa de Bitcoin y sin custodia para enviar, solicitar y recibir e-cash.",
      "root.qr.label": "Código QR de este sitio web",
      "root.actions": "Acciones de la billetera",
      "staging.label": "Staging",
      "staging.testers": "Las versiones de staging son solo para testers autorizados.",
      "notFound.heading": "Enlace no reconocido",
      "notFound.text": "Este no es un enlace válido de pago, cobro o contacto de Bitcredit Wallet.",
      "notFound.text.staging": "Este no es un enlace válido de pago, cobro o contacto de staging de Bitcredit Wallet.",

      "footer.copyright": "© 2026 Bitcredit Protocol.",
      "footer.released": "Publicado bajo la",
      "footer.license": "licencia MIT",
      "language.label": "Idioma",
    },
  };
  const defaultLanguage = "en";

  function detectLanguage() {
    const preferences = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const tag of preferences) {
      const base = String(tag ?? "").toLowerCase().split("-")[0];
      if (Object.hasOwn(strings, base)) return base;
    }
    return defaultLanguage;
  }

  let language = detectLanguage();

  function translate(key) {
    return strings[language][key] ?? strings[defaultLanguage][key];
  }

  // Line breaks are written as "\n" so no string is ever parsed as HTML.
  function setText(element, text) {
    const nodes = [];
    text.split("\n").forEach((line, i) => {
      if (i > 0) nodes.push(document.createElement("br"));
      nodes.push(document.createTextNode(line));
    });
    element.replaceChildren(...nodes);
  }

  function apply(root = document) {
    const matches = (selector) => [
      ...(root.matches?.(selector) ? [root] : []),
      ...root.querySelectorAll(selector),
    ];
    for (const element of matches("[data-i18n]")) {
      const text = translate(element.dataset.i18n);
      if (text !== undefined) setText(element, text);
    }
    for (const element of matches("[data-i18n-label]")) {
      const text = translate(element.dataset.i18nLabel);
      if (text !== undefined) element.setAttribute("aria-label", text);
    }
    if (root === document) {
      document.documentElement.lang = language;
      for (const button of document.querySelectorAll("[data-language]")) {
        button.setAttribute("aria-pressed", String(button.dataset.language === language));
      }
    }
  }

  function setLanguage(value) {
    if (!Object.hasOwn(strings, value)) return;
    language = value;
    apply();
  }

  const languageSwitch = document.getElementById("language-switch");
  if (languageSwitch) {
    languageSwitch.addEventListener("click", (event) => {
      const button = event.target.closest("[data-language]");
      if (button) setLanguage(button.dataset.language);
    });
    languageSwitch.hidden = false;
  }

  apply();

  globalThis.bitcreditI18n = Object.freeze({
    apply,
    get language() {
      return language;
    },
    strings,
    translate,
  });
})();
