import React, {memo, useEffect, useId, useRef, useState} from 'react';
import {Check, Mail, X} from 'lucide-react';
import './navigation.css';
import './site-footer.css';

function PixelArrow() {
  return <svg className="lb-pixel-arrow" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><path d="M4 0h10v10h-2V4h-2v2H8v2H6v2H4v2H2v2H0v-2h2v-2h2V8h2V6h2V4h2V2H4Z"/></svg>;
}

function NewsletterForm() {
  const id = useId(), request = useRef(null);
  const [status, setStatus] = useState('idle'), [error, setError] = useState('');
  useEffect(() => () => {request.current?.abort(); request.current = null;}, []);
  async function subscribe(event) {
    event.preventDefault();
    if (request.current || status === 'success') return;
    const form = event.currentTarget, fields = new FormData(form);
    const controller = new AbortController(); request.current = controller;
    setStatus('pending'); setError('');
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('/api/newsletter', {
        method:'POST', headers:{'Content-Type':'application/json'}, signal:controller.signal,
        body:JSON.stringify({email:fields.get('email'), website:fields.get('website'), source:'site-footer', consent:true}),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.subscribed) throw new Error(body.error || 'We couldn’t save your signup. Please try again.');
      if (request.current !== controller) return;
      form.reset(); setStatus('success');
    } catch (err) {
      if (request.current !== controller) return;
      setStatus('error'); setError(err.name === 'AbortError' ? 'That took too long. Please try again.' : err.message);
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) request.current = null;
    }
  }
  return <form className="lb-signup-form" onSubmit={subscribe} aria-label="Join the LinkedIn Beats newsletter" aria-busy={status === 'pending'}>
    <label className="lb-visually-hidden" htmlFor={`${id}-email`}>Your email address</label>
    <div className="lb-input-row">
      <input id={`${id}-email`} name="email" type="email" inputMode="email" autoComplete="email" placeholder="Your email" required maxLength={254} readOnly={status === 'pending' || status === 'success'} aria-describedby={`${id}-consent${error ? ` ${id}-error` : ''}`}/>
      <button className="lb-submit" type="submit" disabled={status === 'pending' || status === 'success'}>
        {status === 'success' ? <>You’re in <Check aria-hidden="true"/></> : <>{status === 'pending' ? 'Joining…' : 'Loop me in'}<PixelArrow/></>}
      </button>
    </div>
    <div className="lb-visually-hidden" aria-hidden="true"><label>Leave this empty<input name="website" type="text" tabIndex={-1} autoComplete="off"/></label></div>
    {error && <p className="lb-form-error" id={`${id}-error`} role="alert">{error}</p>}
    <p className="lb-form-note" id={`${id}-consent`} aria-live="polite">{status === 'success' ? 'You’re in the loop. Watch your inbox for the next drop.' : 'Join for monthly music, tools, and merch. Unsubscribe whenever.'}</p>
  </form>;
}

function NewsletterCover({onPreview}) {
  return <aside className="lb-cover" aria-label="Sample newsletter">
    <div className="lb-cover-top"><span>Sample newsletter</span><Mail aria-hidden="true"/></div>
    <div className="lb-mail-stack" aria-hidden="true">
      <div className="lb-envelope"/>
      <div className="lb-envelope-insert"/>
      <div className="lb-cover-sheet">
        <div className="lb-cover-masthead"><span>LinkedIn Beats / Memo</span><span>001</span></div>
        <strong className="lb-poster-title"><span>PER MY</span><span>LAST</span><span>BANGER.</span></strong>
        <div className="lb-poster-foot"><span>IMPORTANT<br/>BUSINESS.</span><span className="lb-equalizer">{[8,15,23,12,19].map((height,index)=><b key={index} style={{'--bar-height':`${height}px`}}/>)}</span></div>
      </div>
    </div>
    <button type="button" className="lb-preview-link" aria-haspopup="dialog" onClick={onPreview}><span>Read a sample email</span><PixelArrow/></button>
  </aside>;
}

function SampleEmail({base, onClose}) {
  const dialog = useRef(null), id = useId();
  useEffect(() => {
    const element = dialog.current, previous = document.activeElement, overflow = document.body.style.overflow;
    element.showModal(); document.body.style.overflow = 'hidden';
    return () => {element.close(); document.body.style.overflow = overflow; previous?.focus({preventScroll:true});};
  }, []);
  return <dialog ref={dialog} className="lb-email-dialog" aria-labelledby={`${id}-title`}
    onCancel={event => {event.preventDefault(); onClose();}}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
    <button type="button" className="lb-email-close" aria-label="Close sample email" onClick={onClose} autoFocus><X aria-hidden="true"/></button>
    <p className="lb-email-meta">Sample newsletter / LinkedIn Beats</p>
    <h2 id={`${id}-title`}>Per my<br/>last banger.</h2>
    <p className="lb-email-to">To: the inner circle<br/>CC: absolutely everyone</p>
    <div className="lb-email-body">
      <p>Team,</p>
      <p>We’ve been heads-down aligning the bassline with our core competencies. The result? <strong>Synergy in B2B Minor.</strong> A track that could have been a meeting, but mercifully isn’t.</p>
      <a href={`${base}studio/`}>Listen to the band <PixelArrow/></a>
      <p>Elsewhere in professional development: five short courses, one very official-looking certificate, and a generous interpretation of “qualified.”</p>
      <a href={`${base}learn/`}>Make it official <PixelArrow/></a>
      <p>Please circle back at your earliest convenience. Headphones encouraged. Camera optional.</p>
      <p>Best regards,<br/>The band</p>
      <p className="lb-email-ps">P.S. This email contains no action items.</p>
    </div>
  </dialog>;
}

const SEALS = ['Global nonsense', 'Synergy checked', 'Office safe-ish'];

// Small vector insignias stay sharp at any density. The directional highlights
// are shared across the rim, engraving and symbol, like a single metal object.
function ChromeSeal({label, index}) {
  const id = useId().replace(/:/g, '');
  const metal = `url(#${id}-metal)`, ink = `url(#${id}-ink)`;
  return <svg className="lb-seal-art" viewBox="0 0 100 100" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-metal`} x1="8%" y1="0%" x2="90%" y2="100%">
        <stop stopColor="#eef2f4"/><stop offset=".16" stopColor="#747c83"/><stop offset=".31" stopColor="#d8dee2"/>
        <stop offset=".46" stopColor="#4c535a"/><stop offset=".5" stopColor="#f5f7f8"/><stop offset=".61" stopColor="#9ba3aa"/>
        <stop offset=".79" stopColor="#343c43"/><stop offset=".91" stopColor="#c1c8ce"/><stop offset="1" stopColor="#656e76"/>
      </linearGradient>
      <linearGradient id={`${id}-face`} x1="0" y1="0" x2=".8" y2="1">
        <stop stopColor="#42484d"/><stop offset=".3" stopColor="#161b20"/><stop offset=".52" stopColor="#30363c"/>
        <stop offset=".55" stopColor="#1b2025"/><stop offset="1" stopColor="#0b1015"/>
      </linearGradient>
      <linearGradient id={`${id}-ink`} x1="15%" y1="0%" x2="75%" y2="100%">
        <stop stopColor="#f2f5f7"/><stop offset=".4" stopColor="#a3abb2"/><stop offset=".51" stopColor="#eef2f5"/><stop offset="1" stopColor="#747f88"/>
      </linearGradient>
      <path id={`${id}-top`} d="M 17 52 A 33 33 0 0 1 83 52"/>
      <path id={`${id}-bottom`} d="M 13 50 A 37 37 0 0 0 87 50"/>
    </defs>
    <circle cx="50" cy="50" r="48" fill={metal}/>
    <circle cx="50" cy="50" r="46.3" fill="#10151a"/>
    <circle cx="50" cy="50" r="44.9" fill={`url(#${id}-face)`} stroke={metal} strokeWidth=".7"/>
    <circle cx="50" cy="50" r="42.8" fill="none" stroke="#a4afb8" strokeOpacity=".15" strokeWidth=".45"/>
    <circle cx="50" cy="50" r="27" fill="#10151a" fillOpacity=".45" stroke={metal} strokeWidth=".55"/>
    <g fill={ink} fontFamily="LBFoundersMono, monospace" fontSize="7.8" letterSpacing="1.1">
      <text><textPath href={`#${id}-top`} startOffset="50%" textAnchor="middle">{label.toUpperCase()}</textPath></text>
      <text fontSize="6.2" letterSpacing="1.1"><textPath href={`#${id}-bottom`} startOffset="50%" textAnchor="middle">LB / CERTIFIED / 00{index+1}</textPath></text>
    </g>
    <g fill={metal}><path d="m13 49 1.8 2-1.8 2-1.8-2Zm74 0 1.8 2-1.8 2-1.8-2Z"/></g>
    <g fill="none" stroke={ink} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {index===0 ? <><circle cx="50" cy="49" r="15"/><ellipse cx="50" cy="49" rx="7" ry="15"/><path d="M35 49h30M38 40h24M38 58h24M50 34v30"/></>
        : index===1 ? <><path d="m50 32 14 6v11c0 9-9 15-14 18-5-3-14-9-14-18V38Z"/><path d="m42 48 6 6 11-12" strokeWidth="2.3"/><path d="m50 36 10 4" strokeOpacity=".4"/></>
        : <><path d="M35 51v-6a15 15 0 0 1 30 0v6M39 47h-3c-2 0-3 1-3 3v7c0 2 1 3 3 3h3V47Zm22 0h3c2 0 3 1 3 3v7c0 2-1 3-3 3h-3V47Z"/><path d="M39 39a13 13 0 0 1 22 0M44 65h12" strokeOpacity=".6"/></>}
    </g>
    <path d="M17 20A45 45 0 0 1 69 10" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth=".7"/>
  </svg>;
}

export const SiteFooter = memo(function SiteFooter({base='/'}) {
  const [preview, setPreview] = useState(false);
  const title = useId(), fineprint = useId();
  return <footer id="c2-footer" className="lb-site-footer">
    <div className="lb-footer" id="about">
      <div className="lb-signup-grid" id="newsletter">
        <section className="lb-signup" aria-labelledby={title}>
          <span className="lb-tag lb-tag-pill"><span className="lb-tag-dot"/>The occasional email</span>
          <h2 id={title}><span>Let’s circle</span><span>back.</span></h2>
          <p className="lb-intro">Fresh beats. Questionable announcements.<br/>Absolutely no meeting required.</p>
          <NewsletterForm/>
        </section>
        <NewsletterCover onPreview={() => setPreview(true)}/>
      </div>
      <div className="lb-footer-links">
        <p className="lb-signoff">Very professional.<br/>Deeply unserious.<small>Music for people with an email signature.</small></p>
        <nav className="lb-link-group" aria-label="Explore LinkedIn Beats">
          <div><a href={`${base}#c2-player`}>Beats <PixelArrow/></a><a href={`${base}store/`}>Store <PixelArrow/></a><a href={`${base}learn/`}>Get certified <PixelArrow/></a></div>
          <div><a href={`${base}lessons/`}>LinkedInifier <PixelArrow/></a><a href={`${base}#c2-dispatch`}>The feed <PixelArrow/></a></div>
        </nav>
      </div>
      <a className="lb-wordmark-link" href={base} aria-label="LinkedIn Beats home"><img className="lb-wordmark" src={`${base}brand/afterbeat/wordmark-white.svg?v=afterbeat-2`} width="7015" height="862" loading="lazy" alt="LinkedIn Beats"/></a>
      <section className="lb-fineprint" aria-labelledby={fineprint}>
        <div className="lb-fineprint-copy"><h3 id={fineprint}>The necessary small print</h3>
          <p>LinkedIn Beats is an independent parody project. Not affiliated with, endorsed by, or sponsored by LinkedIn Corporation. All trademarks belong to their respective owners.</p>
          <p>For recreational professional development only. No guarantee of promotion, strategic alignment, or stakeholder buy-in. Any resemblance to your Monday meeting is entirely plausible. Use headphones. Exercise judgment. Circle back responsibly.</p>
        </div>
        <aside className="lb-assurance" aria-label="Fictional corporate assurance marks">
          <ul className="lb-seals">{SEALS.map((label,index)=><li key={label} aria-label={`Certified ${label.toLowerCase()} — fictional corporate assurance mark`}><ChromeSeal label={label} index={index}/></li>)}</ul>
          <p className="lb-assurance-note">Internal standards. Entirely made up.</p>
        </aside>
      </section>
      <div className="lb-bottom"><p>© {new Date().getFullYear()} LinkedIn Beats. <span>All expectations managed.</span></p><a href="https://look-serious.com/">Built by <strong>Look Serious</strong></a></div>
    </div>
    {preview && <SampleEmail base={base} onClose={() => setPreview(false)}/>}
  </footer>;
});
