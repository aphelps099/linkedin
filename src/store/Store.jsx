import React, { useEffect, useMemo, useState } from 'react';
import { CATEGORIES, PRODUCTS, bySku, fmt } from './products.js';

// The Company Store — Form CS-1. Storefront grid, product detail panel and
// order drawer, recreated from design_handoff_company_store/. Panels appear;
// nothing slides, nothing dims. All sales final.

const CART_KEY = 'cs-order';
const endpoint = () => import.meta.env.VITE_VOICE_API_URL
  ? new URL('/api/checkout', import.meta.env.VITE_VOICE_API_URL).href
  : '/api/checkout';

function loadCart(){
  try{
    const cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    return Array.isArray(cart) ? cart.filter(c => bySku(c.sku) && c.qty > 0) : [];
  }catch{ return []; }
}

function ImgSlot({ ph }){
  return <div className="cs-img-slot"><span>{ph}</span></div>;
}

export default function Store(){
  const [filter, setFilter] = useState('All');
  const [view, setView] = useState('grid');
  const [sel, setSel] = useState(null);
  const [size, setSize] = useState(null);
  const [qty, setQty] = useState(1);
  const [cart, setCart] = useState(loadCart);
  const [drawer, setDrawer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState('');       // drawer status line, deadpan
  const [notice, setNotice] = useState(null); // 'filed' | 'tabled' from Stripe return

  useEffect(() => {
    try{ localStorage.setItem(CART_KEY, JSON.stringify(cart)); }catch{ /* the order is verbal */ }
  }, [cart]);

  // Returning from checkout: ?order=filed clears the form, ?order=tabled keeps it.
  useEffect(() => {
    const q = new URLSearchParams(location.search).get('order');
    if(q === 'filed'){ setNotice('filed'); setCart([]); }
    else if(q === 'tabled') setNotice('tabled');
    if(q) history.replaceState(null, '', location.pathname);
  }, []);

  useEffect(() => {
    const onKey = e => {
      if(e.key !== 'Escape') return;
      if(view === 'detail'){ setView('grid'); setSel(null); }
      else if(drawer) setDrawer(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, drawer]);

  const items = useMemo(
    () => PRODUCTS.filter(p => filter === 'All' || p.cat === filter),
    [filter]);
  const fillers = (3 - (items.length % 3)) % 3;
  const d = view === 'detail' ? bySku(sel) : null;
  const cartCount = cart.reduce((t, c) => t + c.qty, 0);
  const subtotal = cart.reduce((t, c) => t + c.price * c.qty, 0);

  const openDetail = p => {
    setView('detail'); setSel(p.sku);
    setSize(p.sizes ? p.sizes[1] : null); setQty(1);
  };
  const closeDetail = () => { setView('grid'); setSel(null); };

  const addToOrder = () => {
    if(!d) return;
    const sz = d.sizes ? size : null;
    setCart(prev => {
      const next = prev.slice();
      const i = next.findIndex(c => c.sku === d.sku && c.size === sz);
      if(i >= 0) next[i] = { ...next[i], qty: next[i].qty + qty };
      else next.push({ sku: d.sku, name: d.name, price: d.price, size: sz, qty });
      return next;
    });
    closeDetail(); setDrawer(true);
  };

  const submitOrder = async () => {
    if(!cart.length || submitting) return;
    setSubmitting(true); setNote('Routing the order for approval…');
    try{
      const res = await fetch(endpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cart: cart.map(c => ({ sku: c.sku, size: c.size, qty: c.qty })) }),
      });
      const body = await res.json().catch(() => ({}));
      if(!res.ok || !body.url) throw new Error(body.error || 'Checkout is not configured');
      location.assign(body.url);
    }catch(err){
      setSubmitting(false);
      setNote(/not configured/i.test(err.message || '')
        ? 'Checkout is not yet configured. The order was tabled.'
        : 'The order could not be filed. The department will circle back.');
    }
  };

  return <div className="cs-app">
    <div className="cs-measure">
      <div className="cs-masthead">
        <a className="cs-wordmark" href="../">Circle Back<sup>®</sup></a>
        <span className="cs-masthead-meta"><span>Form CS-1</span><span>Rev. 2026-08</span><span>All sales final</span></span>
      </div>

      {notice === 'filed' &&
        <div className="cs-notice cs-notice--filed"><span>Order filed — CS-1 · A receipt is on its way to your inbox</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss">×</button></div>}
      {notice === 'tabled' &&
        <div className="cs-notice cs-notice--tabled"><span>The order was tabled. The merchandise remains available</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss">×</button></div>}

      <div className="cs-banner">Free shipping over $50 · Printed on demand · Complaints processed locally ▮</div>

      <div className="cs-hero">
        <div className="cs-kicker">The Circle Back® ecosystem · Merchandise division</div>
        <h1>The Company Store</h1>
        <p className="cs-dek">Shirts, hats, stickers and posters. Designed by the department, printed on demand. <strong>Everything ships from a printer we have never met.</strong></p>
      </div>

      <div className="cs-filter-row">
        <div className="cs-chips">
          {CATEGORIES.map(c =>
            <button key={c} className={'cs-chip' + (c === filter ? ' cs-chip--on' : '')}
              onClick={() => setFilter(c)}>{c}</button>)}
        </div>
        <button className="cs-order-btn" onClick={() => setDrawer(true)}>Order form · {cartCount}</button>
      </div>

      <div className="cs-grid">
        {items.map(p =>
          <div key={p.sku} className="cs-card">
            <div className="cs-card-img">
              {p.img ? <img src={p.img} alt={p.name} /> : <ImgSlot ph={p.ph} />}
            </div>
            <div className="cs-card-info" onClick={() => openDetail(p)}>
              <div className="cs-card-cat">{p.cat} · {p.sku}</div>
              <div className="cs-card-title-row">
                <div className="cs-card-name">{p.name}</div>
                <button className="cs-plus" aria-label={`Open ${p.name}`}
                  onClick={e => { e.stopPropagation(); openDetail(p); }}>+</button>
              </div>
              <div className="cs-card-price">{fmt(p.price)}</div>
            </div>
          </div>)}
        {Array.from({ length: fillers }, (_, i) =>
          <div key={'f' + i} className="cs-filler"><span>Further SKUs pending</span></div>)}
      </div>

      <div className="cs-footer">
        <span>Unlocking Synergistic Rhythms for Professional Communicators · Merchandise printed and shipped by a third party</span>
        <span>Form CS-1 · Rev. 2026-08</span>
      </div>
    </div>

    {drawer &&
      <div className="cs-drawer" role="dialog" aria-label="Order form">
        <div className="cs-panel-head">
          <span className="cs-panel-label">Order form · CS-1</span>
          <button className="cs-close" onClick={() => setDrawer(false)} aria-label="Close the order form">×</button>
        </div>
        {cart.length === 0 &&
          <div className="cs-empty">
            <img className="cs-barry" src="../barry/barry-coo.png" width="200" height="156"
              alt="Barry from Compliance, a pixel-art pigeon in a top hat, says: coo. coo." />
            <span>Awaiting merchandise</span>
          </div>}
        <div className="cs-cart-list">
          {cart.map((c, i) =>
            <div key={c.sku + (c.size || '') + i} className="cs-cart-row">
              <div className="cs-cart-item">
                <span className="cs-cart-name">{c.name}</span>
                <span className="cs-cart-meta">{c.sku} · {c.size ? c.size + ' · ' : ''}Qty {c.qty}</span>
              </div>
              <div className="cs-cart-right">
                <span className="cs-cart-price">{fmt(c.price * c.qty)}</span>
                <button className="cs-remove" aria-label={`Remove ${c.name}`}
                  onClick={() => setCart(prev => prev.filter((_, j) => j !== i))}>×</button>
              </div>
            </div>)}
        </div>
        <div className="cs-subtotal-row">
          <span className="cs-panel-label">Subtotal</span>
          <span className="cs-subtotal">{fmt(subtotal)}</span>
        </div>
        <p className="cs-fine">Shipping calculated by the fulfilment partner. All sales final.</p>
        <button className="cs-submit" onClick={submitOrder} disabled={!cart.length || submitting}>
          {submitting ? 'Submitting…' : 'Submit the order'}
        </button>
        {note && <p className="cs-drawer-note">{note}</p>}
      </div>}

    {d &&
      <div className="cs-detail" role="dialog" aria-label="Product detail">
        <div className="cs-panel-head">
          <span className="cs-panel-label">Product detail · {d.sku}</span>
          <button className="cs-close" onClick={closeDetail} aria-label="Close product detail">×</button>
        </div>
        <div className="cs-detail-body">
          <div className="cs-detail-img">
            {d.img ? <img src={d.img} alt={d.name} /> : <ImgSlot ph={d.ph} />}
          </div>
          <div className="cs-detail-info">
            <div className="cs-detail-cat">{d.cat} · {d.sku}</div>
            <h2>{d.name}</h2>
            <div className="cs-action-row">
              <button className="cs-add" onClick={addToOrder}>Add to the order</button>
              <div className="cs-stepper">
                <button className="cs-step" onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Fewer">−</button>
                <span className="cs-qty">{qty}</span>
                <button className="cs-step" onClick={() => setQty(q => q + 1)} aria-label="More">+</button>
              </div>
              <span className="cs-line-total">{fmt(d.price * qty)}</span>
            </div>
            {d.sizes &&
              <div className="cs-size-row">
                <span className="cs-size-label">Size</span>
                <div className="cs-sizes">
                  {d.sizes.map(s =>
                    <button key={s} className={'cs-size' + (s === size ? ' cs-size--on' : '')}
                      onClick={() => setSize(s)}>{s}</button>)}
                </div>
              </div>}
            <p className="cs-desc">{d.desc}</p>
            <div className="cs-stamp">In stock — print on demand</div>
            <div>
              {d.specs.map(([k, v]) =>
                <div key={k} className="cs-spec-row">
                  <span className="cs-spec-k">{k}</span><span className="cs-spec-v">{v}</span>
                </div>)}
            </div>
          </div>
        </div>
      </div>}
  </div>;
}
