(() => {
  "use strict";

  const strings = {
    en: {
      "title.root": "Bitcredit eBills",
      "title.root.staging": "Bitcredit eBills — Staging",
      "title.contact": "Add contact in eBills",
      "title.contact.staging": "Add staging contact in eBills",
      "title.pay": "Pay bill in eBills",
      "title.pay.staging": "Pay staging bill in eBills",
      "title.notFound": "Invalid Bitcredit eBills Link",
      "title.notFound.staging": "Invalid Bitcredit eBills Staging Link",

      "contact.heading": "Add contact in eBills",
      "contact.subtitle": "Install Bitcredit eBills\nto add this contact.",
      "contact.after": "Open this link again to add the contact in eBills.",
      "pay.heading": "Pay bill in eBills",
      "pay.subtitle": "Install Bitcredit eBills\nto open the bill’s payment.",
      "pay.step.identity": "Set up or restore the identity that is a party to this bill.",
      "pay.step.open": "Open this link again to pay the bill.",
      "pay.parties": "The payment only opens in eBills for a party to the bill.",
      "link.invalid": "This eBills link is incomplete or invalid.",
      "after.heading": "After installation:",
      "after.openNow": "If this page appears again, tap “Open it now” below.",
      "open.installed": "Already have the app? Open it now",
      "open.staging": "Open staging eBills",
      "open.app": "Open eBills",

      "qr.caption": "Scan to open on your phone",
      "qr.label": "QR code for this eBills link",
      "install.label": "Install Bitcredit eBills",
      "install.appStore": "Download on the",
      "install.googlePlay": "Get it on",
      "install.testFlight": "Join the beta on",

      "root.description": "The Bitcredit app for issuing, accepting and paying e-bills.",
      "root.qr.label": "QR code for this website",
      "root.actions": "eBills actions",
      "staging.label": "Staging",
      "staging.testers": "Staging builds are for authorized testers.",
      "notFound.heading": "Link not recognized",
      "notFound.text": "This is not a valid Bitcredit eBills contact or bill payment link.",
      "notFound.text.staging": "This is not a valid Bitcredit eBills staging contact or bill payment link.",

      "footer.copyright": "© 2026 Bitcredit Protocol.",
      "footer.released": "Released under the",
      "footer.license": "MIT license",
      "language.label": "Language",
    },
    es: {
      "title.root": "Bitcredit eBills",
      "title.root.staging": "Bitcredit eBills — Staging",
      "title.contact": "Añadir contacto en eBills",
      "title.contact.staging": "Añadir contacto de staging en eBills",
      "title.pay": "Pagar letra en eBills",
      "title.pay.staging": "Pagar letra de staging en eBills",
      "title.notFound": "Enlace de Bitcredit eBills no válido",
      "title.notFound.staging": "Enlace de staging de Bitcredit eBills no válido",

      "contact.heading": "Añadir contacto en eBills",
      "contact.subtitle": "Instala Bitcredit eBills\npara añadir este contacto.",
      "contact.after": "Vuelve a abrir este enlace para añadir el contacto en eBills.",
      "pay.heading": "Pagar letra en eBills",
      "pay.subtitle": "Instala Bitcredit eBills\npara abrir el pago de la letra.",
      "pay.step.identity": "Configura o restaura la identidad que figura como parte de esta letra.",
      "pay.step.open": "Vuelve a abrir este enlace para pagar la letra.",
      "pay.parties": "El pago solo se abre en eBills para quien sea parte de la letra.",
      "link.invalid": "Este enlace de eBills está incompleto o no es válido.",
      "after.heading": "Después de instalarla:",
      "after.openNow": "Si vuelve a aparecer esta página, toca «Ábrela ahora» abajo.",
      "open.installed": "¿Ya tienes la app? Ábrela ahora",
      "open.staging": "Abrir eBills de staging",
      "open.app": "Abrir eBills",

      "qr.caption": "Escanéalo para abrirlo en tu teléfono",
      "qr.label": "Código QR de este enlace de eBills",
      "install.label": "Instala Bitcredit eBills",
      "install.appStore": "Descárgalo en el",
      "install.googlePlay": "Disponible en",
      "install.testFlight": "Únete a la beta en",

      "root.description": "La app de Bitcredit para emitir, aceptar y pagar letras de cambio electrónicas.",
      "root.qr.label": "Código QR de este sitio web",
      "root.actions": "Acciones de eBills",
      "staging.label": "Staging",
      "staging.testers": "Las versiones de staging son solo para testers autorizados.",
      "notFound.heading": "Enlace no reconocido",
      "notFound.text": "Este no es un enlace válido de contacto o de pago de letra de Bitcredit eBills.",
      "notFound.text.staging": "Este no es un enlace válido de contacto o de pago de letra de staging de Bitcredit eBills.",

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
