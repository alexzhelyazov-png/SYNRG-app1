/**
 * Meta Pixel loader with cookie-consent gating.
 * Loads fbevents.js and fires PageView only when user has accepted marketing cookies.
 *
 * Pixel ID: 963430839623782 (synrg-beyond fitness)
 *
 * Usage:
 *   - Page-level events fire automatically (PageView).
 *   - For custom events, call window.synrgPixel.track('ViewContent', {...}) anywhere.
 *   - Tracking calls are queued before consent and replayed once accepted.
 */
(function () {
  'use strict';
  var PIXEL_ID = '963430839623782';

  var queue = [];
  var loaded = false;

  function loadPixelScript() {
    if (loaded) return;
    loaded = true;
    // Standard Meta Pixel snippet
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

    fbq('init', PIXEL_ID);
    fbq('track', 'PageView');

    // Replay queued events
    while (queue.length) {
      var ev = queue.shift();
      try { fbq.apply(null, ev); } catch (e) { console.warn('fbq replay failed', e); }
    }
  }

  function hasMarketingConsent() {
    try {
      return !!(window.synrgConsent && window.synrgConsent.get && window.synrgConsent.get().marketing);
    } catch (e) { return false; }
  }

  // Public API for tracking custom events
  window.synrgPixel = {
    track: function (eventName, params, options) {
      // 4th arg `options` supports { eventID } for CAPI deduplication.
      var args = ['track', eventName];
      if (params) args.push(params);
      if (options) {
        if (!params) args.push({}); // fbq requires params slot before options
        args.push(options);
      }
      if (loaded) {
        try { fbq.apply(null, args); } catch (e) { console.warn('fbq track failed', e); }
      } else {
        queue.push(args);
        if (hasMarketingConsent()) loadPixelScript();
      }
    },
    trackCustom: function (eventName, params) {
      var args = ['trackCustom', eventName].concat(params ? [params] : []);
      if (loaded) {
        try { fbq.apply(null, args); } catch (e) { console.warn('fbq trackCustom failed', e); }
      } else {
        queue.push(args);
        if (hasMarketingConsent()) loadPixelScript();
      }
    },
  };

  // Init on load if consent already given
  if (hasMarketingConsent()) {
    loadPixelScript();
  }
  // Load when consent is given later (cookie banner dispatches this)
  document.addEventListener('synrg:consent', function (e) {
    if (e.detail && e.detail.marketing) loadPixelScript();
  });

  // Add <noscript> img fallback for users without JS — appended at runtime so it can be controlled
  // (only if marketing consent is granted; otherwise no tracking pixel is rendered)
  document.addEventListener('synrg:consent', function (e) {
    if (e.detail && e.detail.marketing && !document.getElementById('fb-noscript-px')) {
      var img = document.createElement('img');
      img.id = 'fb-noscript-px';
      img.height = 1; img.width = 1;
      img.style.display = 'none';
      img.src = 'https://www.facebook.com/tr?id=' + PIXEL_ID + '&ev=PageView&noscript=1';
      document.body.appendChild(img);
    }
  });
})();
