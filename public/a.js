/*
 * First-party analytics. No dependencies, no build step, no third party.
 *
 * This file is the entire client side of the measurement system. It is served
 * from our own origin, it writes one cookie belonging to our own domain, and it
 * posts to our own endpoint. Nothing here talks to an ad network, an analytics
 * vendor or anybody else, which is what makes "first-party" a description of
 * the architecture rather than a claim on a privacy page.
 *
 * Three things it will not do:
 *
 *   * Run at all if Do Not Track or Global Privacy Control is set. Not a
 *     reduced mode, not an anonymous mode — no cookie, no identifier, no
 *     request. Honouring a signal partially is not honouring it.
 *   * Send anything before the page is being left. One beacon per page view,
 *     on unload, with everything that happened. A page that chatters at a
 *     server while somebody is reading it is a page that costs them battery to
 *     produce numbers for us.
 *   * Keep tracking somebody who declined. Declining wipes the identifier that
 *     already exists, not just the ones that would have.
 *
 * The measurement worth having is engaged time: a counter that ticks only while
 * the tab is visible and something has been touched in the last fifteen
 * seconds. Raw time-on-page counts an abandoned tab as rapt attention, and
 * every report built on it is wrong in the same flattering direction.
 */
(function () {
  'use strict';

  // ── Do not track. Checked first, before anything at all is written. ────────
  var dnt =
    navigator.doNotTrack === '1' ||
    window.doNotTrack === '1' ||
    navigator.msDoNotTrack === '1' ||
    navigator.globalPrivacyControl === true;
  if (dnt) return;

  // Two script tags, or a client-side navigation that re-ran this, would count
  // every page view twice and double every number downstream.
  if (window.__TRACKER_LOADED__) return;
  window.__TRACKER_LOADED__ = true;

  var ENDPOINT = '/api/atrack';
  var VISITOR_KEY = 'fi_vid';
  var CONSENT_KEY = 'fi_consent';
  var SESSION_KEY = 'fi_sid';
  var YEAR = 31536000;

  var query = new URLSearchParams(location.search);
  var suppressed = false;

  function uuid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function get(store, key) {
    try {
      return store.getItem(key);
    } catch (e) {
      return null;
    }
  }
  function set(store, key, value) {
    try {
      store.setItem(key, value);
    } catch (e) {
      /* Private browsing, or storage full. Not worth a failure. */
    }
  }

  // ── Consent, for the regions that expect to be asked ──────────────────────
  //
  // Timezone rather than an IP geolocation call: it is already in the browser,
  // it costs nothing, and it needs no request to a third party to work out
  // whether to show a card about not making requests to third parties.
  function inGatedRegion() {
    if (query.get('geo') === 'eu') return true;
    if (query.get('geo') === 'off') return false;
    try {
      var zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      return (
        /^Europe\//.test(zone) ||
        ['Atlantic/Reykjavik', 'Atlantic/Canary', 'Atlantic/Madeira', 'Atlantic/Azores', 'Atlantic/Faroe'].indexOf(
          zone,
        ) >= 0
      );
    } catch (e) {
      return false;
    }
  }

  function decisionIsCurrent() {
    var raw = get(localStorage, CONSENT_KEY);
    if (!raw) return null;
    try {
      var saved = JSON.parse(raw);
      // Re-ask after a year. A decision made about a site somebody has not
      // visited since is not a decision about this visit.
      if (Date.now() - saved.at > 365 * 24 * 60 * 60 * 1000) return null;
      return saved.allowed;
    } catch (e) {
      return null;
    }
  }

  function forget() {
    suppressed = true;
    try {
      localStorage.removeItem(VISITOR_KEY);
      sessionStorage.clear();
    } catch (e) {}
    document.cookie = VISITOR_KEY + '=; max-age=0; path=/; SameSite=Lax';
  }

  function showConsentCard() {
    var card = document.createElement('div');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Analytics cookie');
    card.style.cssText =
      'position:fixed;left:16px;bottom:16px;z-index:2147483000;max-width:340px;' +
      'padding:16px 18px;border-radius:14px;font:400 13px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;' +
      'color:#eef0ff;background:rgba(18,20,38,0.94);border:1px solid rgba(150,160,255,0.22);' +
      'box-shadow:0 18px 50px rgba(0,0,0,0.5);backdrop-filter:blur(10px);' +
      'opacity:0;transform:translateY(10px);transition:opacity .35s ease,transform .35s cubic-bezier(.22,1,.36,1)';

    var text = document.createElement('p');
    text.style.cssText = 'margin:0 0 12px';
    text.textContent =
      'We use one first-party cookie for anonymous analytics. No ad networks, no third parties.';

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px';

    function button(label, primary) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.style.cssText =
        'flex:1;cursor:pointer;padding:7px 12px;border-radius:9px;font:600 12.5px/1 inherit;' +
        (primary
          ? 'color:#fff;border:0;background:linear-gradient(135deg,#5560d8,#8b5cf6)'
          : 'color:#c9cdf2;background:transparent;border:1px solid rgba(150,160,255,0.28)');
      return b;
    }

    var allow = button('Allow', true);
    var decline = button('Decline', false);

    function close(allowed) {
      set(localStorage, CONSENT_KEY, JSON.stringify({ allowed: allowed, at: Date.now() }));
      if (!allowed) forget();
      card.style.opacity = '0';
      card.style.transform = 'translateY(10px)';
      setTimeout(function () {
        card.remove();
      }, 350);
    }

    allow.addEventListener('click', function () {
      close(true);
    });
    decline.addEventListener('click', function () {
      close(false);
    });

    row.appendChild(allow);
    row.appendChild(decline);
    card.appendChild(text);
    card.appendChild(row);
    document.body.appendChild(card);

    requestAnimationFrame(function () {
      card.style.opacity = '1';
      card.style.transform = 'none';
    });
  }

  if (inGatedRegion()) {
    var decided = decisionIsCurrent();
    if (decided === false) return;
    // Opt-out: tracking continues while the card is up, and stops the moment
    // Decline is pressed, including for this page view.
    if (decided === null) {
      if (document.body) showConsentCard();
      else document.addEventListener('DOMContentLoaded', showConsentCard);
    }
  }

  // ── Identity ──────────────────────────────────────────────────────────────
  //
  // The cookie is not a duplicate of localStorage for its own sake: the server
  // can read a cookie on the request that carries a sign-in or a form post, and
  // it cannot read localStorage at all. That cookie is what lets somebody's
  // whole anonymous history become theirs the moment they sign in.
  var visitorId = get(localStorage, VISITOR_KEY);
  var isNew = false;
  if (!visitorId) {
    visitorId = uuid();
    isNew = true;
    set(localStorage, VISITOR_KEY, visitorId);
  }
  document.cookie = VISITOR_KEY + '=' + visitorId + ';max-age=' + YEAR + ';path=/;SameSite=Lax';

  var sessionId = get(sessionStorage, SESSION_KEY);
  if (!sessionId) {
    sessionId = uuid();
    set(sessionStorage, SESSION_KEY, sessionId);
    set(sessionStorage, 'fi_landing', location.pathname + location.search);
    set(sessionStorage, 'fi_ref', document.referrer || '');
    ['source', 'medium', 'campaign', 'term', 'content'].forEach(function (k) {
      var value = query.get('utm_' + k);
      if (value) set(sessionStorage, 'fi_utm_' + k, value.slice(0, 200));
    });
  }

  var pages = (parseInt(get(sessionStorage, 'fi_pages') || '0', 10) || 0) + 1;
  set(sessionStorage, 'fi_pages', String(pages));

  // ── What happened on this page ────────────────────────────────────────────
  var startedAt = Date.now();
  var engaged = 0;
  var lastActivity = Date.now();
  var maxScroll = 0;
  var clicks = 0;
  var rage = 0;
  var lastClick = null;
  var cta = {};
  var terms = {};
  var events = [];
  var video = '';
  var formStage = '';
  var vitals = { lcp: 0, cls: 0, inp: 0 };

  var STAGES = ['open', 'started', 'submitted'];
  function advance(stage) {
    // Ratchets forward only. A second click on the demo button after the form
    // was already started must not walk the funnel backwards.
    if (STAGES.indexOf(stage) > STAGES.indexOf(formStage)) formStage = stage;
  }

  function log(type, label, extra) {
    if (events.length >= 80) return;
    var entry = { type: type, label: String(label || '').slice(0, 120), at: seconds() };
    if (extra) entry.extra = String(extra).slice(0, 120);
    events.push(entry);
  }

  function seconds() {
    return Math.round((Date.now() - startedAt) / 1000);
  }

  function bump(label) {
    var key = String(label).slice(0, 80);
    cta[key] = (cta[key] || 0) + 1;
    log('cta', key);
  }

  ['mousemove', 'keydown', 'scroll', 'pointerdown', 'touchstart'].forEach(function (name) {
    addEventListener(
      name,
      function () {
        lastActivity = Date.now();
      },
      { passive: true },
    );
  });

  // Visible, and touched in the last fifteen seconds. Both, every second.
  setInterval(function () {
    if (document.visibilityState === 'visible' && Date.now() - lastActivity < 15000) engaged += 1;
  }, 1000);

  function measureScroll() {
    var scrollable = document.documentElement.scrollHeight - innerHeight;
    // A page with nothing to scroll was read to the end by definition. Leaving
    // it at zero would report every short page as an instant abandonment.
    if (scrollable <= 0) {
      maxScroll = 100;
      return;
    }
    var pct = Math.round((scrollY / scrollable) * 100);
    maxScroll = Math.max(maxScroll, Math.min(Math.max(pct, 0), 100));
  }
  addEventListener('scroll', measureScroll, { passive: true });
  measureScroll();

  addEventListener(
    'click',
    function (e) {
      clicks += 1;

      // Rage: same place, near enough the same moment. Two clicks 33px apart
      // are a person changing their mind; two clicks 4px apart are a person
      // hitting something that is not responding.
      var now = Date.now();
      if (
        lastClick &&
        now - lastClick.t < 800 &&
        Math.abs(e.clientX - lastClick.x) < 32 &&
        Math.abs(e.clientY - lastClick.y) < 32
      ) {
        rage += 1;
        log('rage', location.pathname);
      }
      lastClick = { t: now, x: e.clientX, y: e.clientY };

      var el = e.target instanceof Element ? e.target : null;
      if (!el) return;

      // First match wins, most specific first.
      if (el.closest('[data-video]')) {
        video = 'opened';
        bump('watch_walkthrough');
        return;
      }
      if (el.closest('[data-signup]')) {
        bump('signup');
        return;
      }

      var demo = el.closest('[data-demo]');
      if (demo) {
        advance('open');
        bump('lead:' + (demo.getAttribute('data-interest') || 'Talk to us'));
        return;
      }
      if (el.closest('[data-signin]')) {
        bump('log_in');
        return;
      }

      var card = el.closest('[data-name]');
      if (card) {
        bump('agent_card:' + (card.getAttribute('data-name') || '').slice(0, 40));
        return;
      }

      var link = el.closest('a[href]');
      if (!link) return;

      var href = link.getAttribute('href') || '';
      if (/^https?:/i.test(href)) {
        try {
          var host = new URL(href).hostname;
          if (host !== location.hostname) {
            bump('outbound:' + host);
            return;
          }
        } catch (err) {}
      }
      if (link.closest('nav')) log('nav', href);
    },
    { passive: true },
  );

  var searchTimer = null;
  addEventListener(
    'input',
    function (e) {
      var el = e.target;
      if (!(el instanceof HTMLInputElement)) return;
      if (!el.matches('[type=search],[data-search],[name*=search i],[placeholder*=search i]')) return;

      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        var value = el.value.trim().toLowerCase();
        if (value.length < 2) return;
        terms[value.slice(0, 60)] = 1;
        log('search', value);
      }, 600);
    },
    { passive: true },
  );

  addEventListener(
    'focusin',
    function (e) {
      if (e.target instanceof Element && e.target.closest('form,[data-lead-form]')) advance('started');
    },
    { passive: true },
  );

  // The preferred signal: a form's own code announcing a real submission, after
  // whatever it considers success. Anything with a server behind it should
  // dispatch this rather than rely on the fallback below.
  document.addEventListener('lead_submit', function () {
    advance('submitted');
    log('conversion', 'lead_submit');
  });

  // The fallback, for a form with no code of its own — which today is the only
  // kind this site has, since the contact form hands off to the visitor's mail
  // client. A native `submit` is safe to count here because the browser fires
  // it only after constraint validation has already passed, so a half-filled
  // form cannot be recorded as a lead. On a form that can fail server-side,
  // this would be too generous, and that is what the event above is for.
  addEventListener(
    'submit',
    function (e) {
      if (e.target instanceof Element && e.target.matches('[data-lead-form]')) {
        advance('submitted');
        log('conversion', 'form_submit');
      }
    },
    { capture: true, passive: true },
  );

  // ── Core Web Vitals ───────────────────────────────────────────────────────
  //
  // Every one wrapped separately: entry types are unevenly supported, and one
  // unsupported observer throwing must not take the other two with it.
  function observe(type, options, handler) {
    try {
      new PerformanceObserver(handler).observe(Object.assign({ type: type, buffered: true }, options));
    } catch (e) {}
  }

  observe('largest-contentful-paint', {}, function (list) {
    var entries = list.getEntries();
    var last = entries[entries.length - 1];
    if (last) vitals.lcp = Math.round(last.startTime);
  });

  observe('layout-shift', {}, function (list) {
    list.getEntries().forEach(function (entry) {
      if (!entry.hadRecentInput) vitals.cls += entry.value;
    });
  });

  observe('event', { durationThreshold: 40 }, function (list) {
    list.getEntries().forEach(function (entry) {
      vitals.inp = Math.max(vitals.inp, Math.round(entry.duration));
    });
  });

  // ── One beacon, once, on the way out ──────────────────────────────────────
  var sent = false;

  function send() {
    if (sent || suppressed) return;
    sent = true;

    measureScroll();

    var payload = {
      visitorId: visitorId,
      sessionId: sessionId,
      isNewVisitor: isNew,
      pageUrl: location.pathname + location.search,
      pageTitle: document.title,
      referrer: get(sessionStorage, 'fi_ref') || '',
      utmSource: get(sessionStorage, 'fi_utm_source'),
      utmMedium: get(sessionStorage, 'fi_utm_medium'),
      utmCampaign: get(sessionStorage, 'fi_utm_campaign'),
      utmTerm: get(sessionStorage, 'fi_utm_term'),
      utmContent: get(sessionStorage, 'fi_utm_content'),
      landingPage: get(sessionStorage, 'fi_landing'),
      pagesInSession: pages,
      timeOnPage: seconds(),
      engagedTime: engaged,
      maxScroll: maxScroll,
      clicks: clicks,
      cta: cta,
      video: video,
      formStage: formStage,
      searchTerms: Object.keys(terms).join('|'),
      rageClicks: rage,
      lcp: vitals.lcp,
      cls: Math.round(vitals.cls * 1000) / 1000,
      inp: vitals.inp,
      viewport: innerWidth + 'x' + innerHeight,
      screen: screen.width + 'x' + screen.height,
      language: navigator.language,
      events: events,
    };

    var body = JSON.stringify(payload);

    // sendBeacon is the only delivery that reliably survives the page going
    // away, which is exactly when there is something worth sending. It posts as
    // text/plain and that is not configurable, so the endpoint parses the body
    // itself rather than relying on a content type.
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, body)) return;
    } catch (e) {}

    try {
      fetch(ENDPOINT, { method: 'POST', body: body, keepalive: true, credentials: 'same-origin' });
    } catch (e) {}
  }

  // Both, because neither fires everywhere. pagehide is the reliable one on
  // iOS; visibilitychange is the one that catches a tab switched away and never
  // returned to.
  addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') send();
  });
  addEventListener('pagehide', send);
})();
