import React, {useEffect, useRef, useState} from 'react';
import {ArrowRight, Check, X} from 'lucide-react';
import './first-in-line.css';

export function FirstInLine({hidden = false}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const dialog = useRef(null), input = useRef(null), trigger = useRef(null);
  const request = useRef(null);

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current.showModal();
    if (status !== 'success') input.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      trigger.current?.focus({preventScroll:true});
    };
  }, [open]);

  async function subscribe(event) {
    event.preventDefault();
    if (status === 'pending') return;
    const website = new FormData(event.currentTarget).get('website');
    setStatus('pending'); setError('');
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('/api/newsletter', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email:email.trim(), consent:true, website}),
        signal:controller.signal,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.subscribed) throw new Error(body.error || 'We couldn’t save your email. Please try again.');
      setStatus('success'); setEmail('');
    } catch (err) {
      setStatus('error');
      setError(err.name === 'AbortError' ? 'That took too long. Please try again.' : err.message);
    } finally { clearTimeout(timeout); request.current = null; }
  }

  return <>
    <div className="shop-first-in-line" hidden={hidden || open}>
      <button ref={trigger} type="button" className="shop-first-trigger" aria-haspopup="dialog" aria-controls="shop-signup" onClick={() => setOpen(true)}>
        <span>Be first<br/>in line</span>
      </button>
    </div>
    {open && <dialog ref={dialog} id="shop-signup" className="shop-signup" aria-labelledby="shop-signup-title" aria-describedby="shop-signup-description"
      onCancel={event => {event.preventDefault(); setOpen(false);}}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setOpen(false);
      }}>
      <button type="button" className="shop-signup-close" aria-label="Close email signup" onClick={() => setOpen(false)}><X size={24} aria-hidden="true"/></button>
      {status === 'success' ? <div className="shop-signup-success" role="status">
        <Check size={34} strokeWidth={1.5} aria-hidden="true"/>
        <h2 id="shop-signup-title">You’re on the list.</h2>
        <p id="shop-signup-description">New merch. New music. You’ll hear it here first.</p>
        <button type="button" className="shop-signup-submit" onClick={() => setOpen(false)}>Back to the shop <ArrowRight size={20} aria-hidden="true"/></button>
      </div> : <>
        <h2 id="shop-signup-title">Be first in line.</h2>
        <p id="shop-signup-description">New merch. New music. Nothing that needs a meeting.</p>
        <form onSubmit={subscribe} aria-busy={status === 'pending'}>
          <label className="shop-visually-hidden" htmlFor="shop-signup-email">Email address</label>
          <input ref={input} id="shop-signup-email" name="email" type="email" autoComplete="email" inputMode="email" placeholder="Your email address" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} aria-invalid={status === 'error' ? true : undefined} aria-describedby={error ? 'shop-signup-error shop-signup-consent' : 'shop-signup-consent'}/>
          <div className="shop-signup-trap" aria-hidden="true"><label>Leave this empty<input name="website" type="text" tabIndex="-1" autoComplete="off"/></label></div>
          <button className="shop-signup-submit" type="submit" disabled={status === 'pending'}>{status === 'pending' ? 'Joining…' : 'Subscribe'}<ArrowRight size={20} aria-hidden="true"/></button>
          {error && <p id="shop-signup-error" className="shop-signup-error" role="alert">{error}</p>}
          <p id="shop-signup-consent" className="shop-signup-consent">By subscribing, you agree to occasional emails from LinkedIn Beats about new merch and music.</p>
        </form>
      </>}
    </dialog>}
  </>;
}
