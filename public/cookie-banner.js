/**
 * SYNRG cookie consent banner.
 * - Stores consent in localStorage as JSON: { essential: true, analytics: bool, marketing: bool, ts: ISO }
 * - Loads pixel/analytics scripts only if user accepts the corresponding category.
 * - Exposes window.synrgConsent.{get,set,reset} for app code.
 *
 * Usage: include this script on every public page, after </body> is fine.
 * To trigger Meta Pixel after consent:
 *   if (window.synrgConsent.get().marketing) { fbq('init','PIXEL_ID'); fbq('track','PageView'); }
 */
(function () {
  'use strict';
  var STORAGE_KEY = 'synrg_consent_v1';
  var BG = (document.documentElement.lang || 'bg').toLowerCase().indexOf('en') === 0 ? 'en' : 'bg';

  function readConsent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function writeConsent(obj) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.assign({ ts: new Date().toISOString() }, obj)));
    } catch (e) { /* ignore */ }
    document.dispatchEvent(new CustomEvent('synrg:consent', { detail: obj }));
  }

  // Public API
  window.synrgConsent = {
    get: function () { return readConsent() || { essential: true, analytics: false, marketing: false }; },
    set: function (c) { writeConsent(Object.assign({ essential: true, analytics: false, marketing: false }, c)); },
    reset: function () { try { localStorage.removeItem(STORAGE_KEY); } catch (e) {} location.reload(); },
  };

  // Don't show banner if already decided
  if (readConsent()) return;

  // Don't show on policy pages themselves (privacy/terms/refund) — would be redundant
  var path = location.pathname.toLowerCase();
  // Still show on policy pages — required for compliance.

  var t = BG === 'en' ? {
    title: 'Cookies & privacy',
    body: 'We use essential cookies to keep the site working. With your consent, we also use analytics and marketing cookies to improve the service and measure ad performance.',
    accept: 'Accept all',
    reject: 'Only essential',
    settings: 'Settings',
    moreLink: 'Privacy policy',
    sCat: 'Categories',
    sEss: 'Essential — always on',
    sAna: 'Analytics',
    sMkt: 'Marketing (Meta Pixel)',
    save: 'Save',
  } : {
    title: 'Бисквитки и поверителност',
    body: 'Използваме задължителни бисквитки, за да работи сайтът. С твое съгласие използваме и аналитични и маркетингови бисквитки — за да подобряваме услугата и да измерваме ефективността на рекламите.',
    accept: 'Приемам всичко',
    reject: 'Само задължителни',
    settings: 'Настройки',
    moreLink: 'Политика за поверителност',
    sCat: 'Категории',
    sEss: 'Задължителни — винаги включени',
    sAna: 'Аналитични',
    sMkt: 'Маркетинг (Meta Pixel)',
    save: 'Запази',
  };

  // CSS
  var css = '\
  #synrg-cb { position: fixed; bottom: 16px; left: 16px; right: 16px; max-width: 540px; margin: 0 auto; \
    background: #111c13; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 20px 24px; \
    color: #e8e4e4; font-family: -apple-system, BlinkMacSystemFont, "MontBlanc", sans-serif; font-size: 14px; \
    line-height: 1.55; box-shadow: 0 12px 32px rgba(0,0,0,0.5); z-index: 9999; }\
  #synrg-cb h3 { margin: 0 0 6px; font-size: 16px; color: #f0eded; font-weight: 700; }\
  #synrg-cb p { margin: 0 0 14px; color: #c4c0c0; }\
  #synrg-cb .row { display: flex; gap: 8px; flex-wrap: wrap; }\
  #synrg-cb button { font-family: inherit; font-size: 13px; font-weight: 700; padding: 10px 16px; border-radius: 100px; cursor: pointer; border: none; }\
  #synrg-cb .btn-primary { background: #c4e9bf; color: #0d1510; }\
  #synrg-cb .btn-secondary { background: transparent; color: #e8e4e4; border: 1px solid rgba(255,255,255,0.15); }\
  #synrg-cb .btn-text { background: transparent; color: #c4e9bf; padding: 10px 0; }\
  #synrg-cb a { color: #c4e9bf; }\
  #synrg-cb .settings { margin-top: 14px; display: none; }\
  #synrg-cb.open-settings .settings { display: block; }\
  #synrg-cb .cat { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-top: 1px solid rgba(255,255,255,0.08); }\
  #synrg-cb .cat:first-child { border-top: none; }\
  #synrg-cb .cat label { font-size: 13px; color: #e8e4e4; }\
  #synrg-cb input[type=checkbox] { accent-color: #c4e9bf; transform: scale(1.2); }\
  ';
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var div = document.createElement('div');
  div.id = 'synrg-cb';
  div.setAttribute('role', 'dialog');
  div.setAttribute('aria-label', t.title);
  div.innerHTML =
    '<h3>' + t.title + '</h3>' +
    '<p>' + t.body + ' <a href="privacy.html">' + t.moreLink + '</a>.</p>' +
    '<div class="row">' +
      '<button type="button" class="btn-primary" data-action="accept-all">' + t.accept + '</button>' +
      '<button type="button" class="btn-secondary" data-action="reject">' + t.reject + '</button>' +
      '<button type="button" class="btn-text" data-action="toggle-settings">' + t.settings + ' ▾</button>' +
    '</div>' +
    '<div class="settings">' +
      '<div class="cat"><label>' + t.sEss + '</label><input type="checkbox" checked disabled /></div>' +
      '<div class="cat"><label for="synrg-cb-ana">' + t.sAna + '</label><input id="synrg-cb-ana" type="checkbox" /></div>' +
      '<div class="cat"><label for="synrg-cb-mkt">' + t.sMkt + '</label><input id="synrg-cb-mkt" type="checkbox" /></div>' +
      '<div class="row" style="margin-top:12px"><button type="button" class="btn-primary" data-action="save-custom">' + t.save + '</button></div>' +
    '</div>';
  document.body.appendChild(div);

  function close() { div.remove(); }

  div.addEventListener('click', function (ev) {
    var btn = ev.target.closest('button[data-action]');
    if (!btn) return;
    var action = btn.dataset.action;
    if (action === 'accept-all') {
      writeConsent({ essential: true, analytics: true, marketing: true });
      close();
    } else if (action === 'reject') {
      writeConsent({ essential: true, analytics: false, marketing: false });
      close();
    } else if (action === 'toggle-settings') {
      div.classList.toggle('open-settings');
    } else if (action === 'save-custom') {
      writeConsent({
        essential: true,
        analytics: document.getElementById('synrg-cb-ana').checked,
        marketing: document.getElementById('synrg-cb-mkt').checked,
      });
      close();
    }
  });
})();
