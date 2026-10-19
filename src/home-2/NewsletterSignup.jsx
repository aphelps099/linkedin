import React, {memo, useEffect, useRef, useState} from 'react';
import {ArrowUpRight, Check, X} from 'lucide-react';
import './newsletter.css';

function SignupDialog({onClose}) {
  const dialog = useRef(null), firstInput = useRef(null), request = useRef(null);
  const [status, setStatus] = useState('idle'), [error, setError] = useState('');
  useEffect(() => {
    const element = dialog.current, focused = document.activeElement, overflow = document.body.style.overflow;
    element.showModal(); document.body.style.overflow = 'hidden'; firstInput.current?.focus();
    return () => {
      request.current?.abort(); request.current = null;
      element.close(); document.body.style.overflow = overflow;
      focused?.focus({preventScroll:true});
    };
  }, []);

  async function subscribe(event) {
    event.preventDefault();
    if (request.current) return;
    const form = event.currentTarget, fields = new FormData(form);
    const controller = new AbortController(); request.current = controller;
    setStatus('pending'); setError('');
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('/api/newsletter', {
        method:'POST', headers:{'Content-Type':'application/json'}, signal:controller.signal,
        body:JSON.stringify({
          firstName:fields.get('firstName'), lastName:fields.get('lastName'), email:fields.get('email'),
          source:'home-monthly', consent:true, website:fields.get('website'),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.subscribed) throw new Error(body.error || 'We couldn’t save your signup. Please try again.');
      if (request.current !== controller) return;
      form.reset(); setStatus('success');
    } catch (err) {
      if (request.current !== controller) return;
      setStatus('error');
      setError(err.name === 'AbortError' ? 'That took too long. Please try again.' : err.message);
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) request.current = null;
    }
  }

  return <dialog ref={dialog} className="c2-newsletter-dialog" aria-labelledby="c2-signup-title" aria-describedby="c2-signup-description"
    onCancel={event => {event.preventDefault(); onClose();}}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
    <button type="button" className="c2-newsletter-close" onClick={onClose} aria-label="Close newsletter signup"><X aria-hidden="true"/></button>
    {status === 'success' ? <div className="c2-newsletter-success" role="status">
      <Check aria-hidden="true"/>
      <h2 id="c2-signup-title">You’re on<br/>the list.</h2>
      <p id="c2-signup-description">The next monthly drop belongs in your inbox.</p>
      <button type="button" className="c2-newsletter-button" onClick={onClose} autoFocus><span>Back to the beats <ArrowUpRight aria-hidden="true"/></span></button>
    </div> : <>
      <p className="c2-newsletter-eyebrow">The monthly drop</p>
      <h2 id="c2-signup-title">Never miss<br/>a beat.</h2>
      <p id="c2-signup-description">Fresh beats, new toys, and a little corporate nonsense. Once a month.</p>
      <form onSubmit={subscribe} aria-busy={status === 'pending'}>
        <div className="c2-newsletter-names">
          <label htmlFor="c2-signup-first">First name<input ref={firstInput} id="c2-signup-first" name="firstName" type="text" autoComplete="given-name" required maxLength={80} readOnly={status === 'pending'}/></label>
          <label htmlFor="c2-signup-last">Last name<input id="c2-signup-last" name="lastName" type="text" autoComplete="family-name" required maxLength={80} readOnly={status === 'pending'}/></label>
        </div>
        <label htmlFor="c2-signup-email">Email address<input id="c2-signup-email" name="email" type="email" inputMode="email" autoComplete="email" required maxLength={254} readOnly={status === 'pending'} aria-describedby="c2-signup-consent"/></label>
        <div className="c2-newsletter-trap" aria-hidden="true"><label>Leave this empty<input name="website" type="text" tabIndex={-1} autoComplete="off"/></label></div>
        <button type="submit" className="c2-newsletter-button" disabled={status === 'pending'}><span>{status === 'pending' ? 'Joining…' : 'Count me in'}<ArrowUpRight aria-hidden="true"/></span></button>
        {error && <p className="c2-newsletter-error" role="alert">{error}</p>}
        <p id="c2-signup-consent" className="c2-newsletter-consent">By joining, you agree to monthly emails from LinkedIn Beats about new music, tools, and merch. Unsubscribe whenever.</p>
      </form>
    </>}
  </dialog>;
}

export const NewsletterSignup = memo(function NewsletterSignup() {
  const [open, setOpen] = useState(false);
  return <section id="newsletter" className="c2-newsletter" aria-labelledby="c2-newsletter-title">
    <div className="c2-container">
      <div className="c2-newsletter-banner">
        <div className="c2-newsletter-paper" aria-hidden="true"/>
        <div className="c2-newsletter-copy">
          <p className="c2-newsletter-eyebrow">The monthly drop</p>
          <h2 id="c2-newsletter-title">Never miss<br/>a beat.</h2>
          <p className="c2-newsletter-description">Fresh beats. New toys. One email a month.</p>
        </div>
        <div className="c2-newsletter-action">
          <p className="c2-newsletter-encore">Inbox encore</p>
          <button type="button" className="c2-newsletter-button" aria-haspopup="dialog" onClick={() => setOpen(true)}><span>Count me in <ArrowUpRight aria-hidden="true"/></span></button>
          <p>Good noise. Monthly.</p>
        </div>
      </div>
    </div>
    {open && <SignupDialog onClose={() => setOpen(false)}/>}
  </section>;
});
