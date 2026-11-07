/* Public GA4 measurement ID. Google loads only after analytics opt-in. */
(() => {
  const measurementId = 'G-9FMVNPV2DW';
  if (!/^G-[A-Z0-9]+$/.test(measurementId)) return;
  if (!['linkedinbeats.com', 'www.linkedinbeats.com'].includes(location.hostname)) return;
  if (window.linkedinBeatsAnalytics) return;
  const storageKey = 'linkedin-beats-analytics-consent-v1';
  let started = false;
  let panel;
  const privacySignal = () => navigator.globalPrivacyControl || navigator.doNotTrack === '1';
  function savedChoice() { try { return localStorage.getItem(storageKey); } catch { return null; } }
  function saveChoice(value) { try { localStorage.setItem(storageKey, value); } catch {} }
  function start() {
    if (started || privacySignal()) return;
    started = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function() { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', {analytics_storage:'granted', ad_storage:'denied', ad_user_data:'denied', ad_personalization:'denied'});
    window.gtag('js', new Date());
    let referrer = '';
    try { referrer = new URL(document.referrer).origin; } catch {}
    window.gtag('config', measurementId, {
      allow_google_signals:false,
      allow_ad_personalization_signals:false,
      page_location:location.origin + location.pathname,
      page_referrer:referrer,
      page_title:location.pathname === '/' ? 'LinkedIn Beats' : 'LinkedIn Beats ' + location.pathname,
    });
    const script = document.createElement('script');
    script.async = true;
    script.onload = () => document.documentElement.dataset.analyticsTag = 'loaded';
    script.onerror = () => document.documentElement.dataset.analyticsTag = 'blocked';
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
    document.head.appendChild(script);
  }
  function decline() {
    saveChoice('denied');
    window['ga-disable-' + measurementId] = true;
    // Clear GA cookies only; leave project, newsletter and LinkedIn state intact.
    for (const part of document.cookie.split(';')) {
      const name = part.split('=')[0].trim();
      if (!/^_ga(?:_|$)/.test(name)) continue;
      for (const domain of ['', '; Domain=linkedinbeats.com', '; Domain=.linkedinbeats.com']) {
        document.cookie = name + '=; Max-Age=0; Path=/' + domain + '; SameSite=Lax; Secure';
      }
    }
    panel?.remove();
    if (started) location.reload();
  }
  function show() {
    if (panel?.isConnected) return;
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = '/analytics.css?v=3';
    if (!document.querySelector('link[href="/analytics.css?v=3"]')) document.head.appendChild(css);
    panel = document.createElement('section');
    panel.className = 'lb-analytics-choice';
    panel.setAttribute('aria-label', 'Analytics preference');
    const heading = document.createElement('h2');
    heading.id = 'lb-analytics-title';
    heading.textContent = privacySignal() ? 'Your privacy. Noted.' : 'Help us count the crowd.';
    panel.setAttribute('aria-labelledby', heading.id);
    const signal = document.createElement('div');
    signal.className = 'lb-analytics-signal'; signal.setAttribute('aria-hidden', 'true');
    [2,4,3,5,4,6].forEach(height => {
      const column = document.createElement('span');
      for (let i=0;i<6;i++) {const peg=document.createElement('i'); if(i>=6-height) peg.className='is-lit'; column.appendChild(peg);}
      signal.appendChild(column);
    });
    const copy = document.createElement('p');
    copy.textContent = privacySignal()
      ? 'Your browser privacy setting keeps Google Analytics off.'
      : 'Optional Google Analytics. Site visits, no ads.';
    const actions = document.createElement('div');
    function button(text, action) { const b=document.createElement('button'); b.type='button'; b.textContent=text; b.onclick=action; actions.appendChild(b); }
    if (!privacySignal()) button('Allow', () => {saveChoice('granted'); window['ga-disable-' + measurementId]=false; panel.remove(); start();});
    button(privacySignal() ? 'Close' : 'No thanks', decline);
    const policy = document.createElement('a'); policy.href='/privacy/#analytics'; policy.textContent='Privacy'; actions.appendChild(policy);
    panel.append(signal, heading, copy, actions); document.body.appendChild(panel);
  }
  window.linkedinBeatsAnalytics = {showPreferences:show};
  document.addEventListener('click', e => {if (e.target.closest('[data-analytics-preferences]')) show();});
  if (privacySignal()) return;
  if (savedChoice() === 'granted') start();
  else if (savedChoice() !== 'denied') show();
})();
