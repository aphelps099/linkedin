import React, {memo, useEffect, useId, useRef, useState} from 'react';
import {Check, X} from 'lucide-react';
import './navigation.css';
import './site-footer.css';

function PixelArrow() {
  return <svg className="lb-pixel-arrow" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><path d="M4 0h10v10h-2V4h-2v2H8v2H6v2H4v2H2v2H0v-2h2v-2h2V8h2V6h2V4h2V2H4Z"/></svg>;
}

function NewsletterForm() {
  const id = useId(), request = useRef(null), dialog = useRef(null), opener = useRef(null), openedOnce = useRef(false);
  const [email, setEmail] = useState(''), [open, setOpen] = useState(false);
  const [status, setStatus] = useState('idle'), [error, setError] = useState('');
  useEffect(() => () => {request.current?.abort(); request.current = null;}, []);
  // Let the visitor finish an address before offering the short name form.
  useEffect(() => {
    if (openedOnce.current || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    const timer = setTimeout(() => {openedOnce.current=true;setOpen(true);}, 850);
    return () => clearTimeout(timer);
  }, [email]);
  useEffect(() => {
    if (!open) return;
    const element=dialog.current, overflow=document.body.style.overflow;
    element.showModal(); document.body.style.overflow='hidden';
    return () => {element.close(); document.body.style.overflow=overflow; opener.current?.focus({preventScroll:true});};
  }, [open]);
  function openForm(event) {event.preventDefault();openedOnce.current=true;setOpen(true);}
  function closeForm() {
    request.current?.abort(); request.current=null;
    setStatus(value=>value==='pending'?'idle':value);setOpen(false);
  }
  async function subscribe(event) {
    event.preventDefault();
    if (request.current || status === 'success') return;
    const fields = new FormData(event.currentTarget), controller=new AbortController();
    request.current=controller;setStatus('pending');setError('');
    const timeout=setTimeout(()=>controller.abort(),15000);
    try {
      const response=await fetch('/api/newsletter', {method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,
        body:JSON.stringify({email,firstName:fields.get('firstName'),lastName:fields.get('lastName'),website:fields.get('website'),source:'site-footer',consent:true})});
      const body=await response.json().catch(()=>({}));
      if (!response.ok || !body.subscribed) throw new Error(body.error || 'We couldn’t save your signup. Please try again.');
      if(request.current!==controller) return;
      setStatus('success');setOpen(false);
    } catch(err) {
      if(request.current!==controller) return;
      setStatus('error');setError(err.name==='AbortError'?'That took too long. Please try again.':err.message);
    } finally {clearTimeout(timeout);if(request.current===controller)request.current=null;}
  }
  return <>
    <form className="lb-signup-form" onSubmit={openForm} aria-label="Join the LinkedIn Beats newsletter">
      <label className="lb-visually-hidden" htmlFor={`${id}-email`}>Your email address</label>
      <div className="lb-input-row">
        <input ref={opener} id={`${id}-email`} name="email" type="email" inputMode="email" autoComplete="email" placeholder="Your email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} readOnly={status==='success'} aria-describedby={`${id}-note`}/>
        <button className="lb-submit" type="submit" disabled={status==='success'}>{status==='success'?<>You’re in <Check aria-hidden="true"/></>:<>Loop me in</>}</button>
      </div>
      <p className="lb-form-note" id={`${id}-note`} role="status">{status==='success'?'You’re in the loop. Watch your inbox.':'Monthly. No action items.'}</p>
    </form>
    {open && <dialog ref={dialog} className="lb-signup-dialog" aria-labelledby={`${id}-title`} onCancel={e=>{e.preventDefault();closeForm();}}
      onClick={e=>{if(e.target!==e.currentTarget)return;const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeForm();}}>
      <button className="lb-signup-close" type="button" aria-label="Close signup" onClick={closeForm}><X aria-hidden="true"/></button>
      <p className="lb-tag">The inner circle</p>
      <h2 id={`${id}-title`}>Let’s make this<br/>personal.</h2>
      <p className="lb-dialog-intro">A name for the email.<br/>Absolutely no job title required.</p>
      <form className="lb-detail-form" onSubmit={subscribe} aria-busy={status==='pending'}>
        <label className="lb-email-label">Email<input name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} readOnly={status==='pending'}/></label>
        <label>First name<input name="firstName" autoComplete="given-name" required maxLength={80} placeholder="First name" readOnly={status==='pending'} autoFocus/></label>
        <label>Last name<input name="lastName" autoComplete="family-name" required maxLength={80} placeholder="Last name" readOnly={status==='pending'}/></label>
        <div className="lb-visually-hidden" aria-hidden="true"><label>Leave this empty<input name="website" type="text" tabIndex={-1} autoComplete="off"/></label></div>
        <button className="lb-detail-submit" type="submit" disabled={status==='pending'}>{status==='pending'?'Joining…':'Loop me in'}<PixelArrow/></button>
        {error && <p className="lb-form-error" role="alert">{error}</p>}
        <p className="lb-dialog-note">By joining, you agree to monthly emails about music, tools, and merch. Unsubscribe whenever. <a href="/privacy/">Privacy policy</a>.</p>
      </form>
    </dialog>}
  </>;
}
const SEALS = ['Global nonsense', 'Synergy checked', 'Office safe-ish'];

export const SiteFooter = memo(function SiteFooter({base='/'}) {
  const title = useId(), fineprint = useId();
  return <footer id="c2-footer" className="lb-site-footer">
    <div className="lb-footer" id="about">
      <div className="lb-footer-links">
        <section className="lb-signup" id="newsletter" aria-labelledby={title}>
          <h2 id={title}>Let’s circle back.</h2>
          <NewsletterForm/>
        </section>
        <nav className="lb-link-group" aria-label="Explore LinkedIn Beats">
          <h3 className="lb-footer-label">Explore</h3>
          <a href={`${base}#c2-player`}>Beats</a>
          <a href={`${base}synth/`}>Synth</a>
          <a href={`${base}optimizer`}>LinkedInifier</a>
          <a href={`${base}roast/`}>Roast my post</a>
          <a href={`${base}learn/`}>Get certified</a>
          <a href={`${base}#c2-dispatch`}>The feed</a>
        </nav>
        <section className="lb-social" aria-label="Follow LinkedIn Beats">
          <h3 className="lb-footer-label">Follow along</h3>
          <a className="lb-linkedin" href="https://www.linkedin.com/company/linked-beats/" target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.049c.476-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0z"/></svg>
            <span>LinkedIn</span>
          </a>
          <p>Professional nonsense.<br/>Now in your feed.</p>
        </section>
      </div>
      <section className="lb-fineprint" aria-labelledby={fineprint}>
        <div className="lb-fineprint-copy">
          <details className="lb-fineprint-details">
            <summary id={fineprint}>Read fine print <span className="lb-fineprint-toggle" aria-hidden="true">+</span></summary>
            <div className="lb-fineprint-body">
          <p>LinkedIn Beats is an independent parody project. Not affiliated with, endorsed by, or sponsored by LinkedIn Corporation. All trademarks belong to their respective owners.</p>
          <p>For recreational professional development only. No guarantee of promotion, strategic alignment, or stakeholder buy-in. Any resemblance to your Monday meeting is entirely plausible. Use headphones. Exercise judgment. Circle back responsibly.</p>
            </div>
          </details>
          <p className="lb-privacy-link"><a href={`${base}privacy/`}>Privacy</a></p>
        </div>
        <aside className="lb-assurance" aria-label="Fictional corporate assurance marks">
          <ul className="lb-seals">{SEALS.map((label,index)=><li key={label} aria-label={`Certified ${label.toLowerCase()} — fictional corporate assurance mark`}><img className="lb-seal-art" src={`${base}brand/seals/assurance-${index+1}.svg`} width="100" height="100" alt="" loading="lazy"/></li>)}</ul>
          <p className="lb-assurance-note">Internal standards. Entirely made up.</p>
        </aside>
      </section>
      <div className="lb-footer-watermark" aria-hidden="true"><img src={`${base}brand/afterbeat/wordmark-white.svg?v=afterbeat-2`} width="7015" height="862" loading="lazy" alt=""/></div>
      <div className="lb-bottom"><p>© {new Date().getFullYear()} LinkedIn Beats. <span>All expectations managed.</span></p><a href="https://look-serious.com/">Built by <strong>Look Serious</strong></a></div>
    </div>
  </footer>;
});
