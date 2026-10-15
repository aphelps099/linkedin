import {Header} from '../brand/Header.jsx';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {ArrowUpRight, ArrowRight, X, Minus, Plus} from 'lucide-react';
import {CATEGORIES, PRODUCTS, bySku, fmt} from './products.js';
import {ProductVisual, isDesignPreview} from './ProductVisual.jsx';
import {Footer} from '../brand/Footer.jsx';

const CART_KEY = 'cs-order';
const endpoint = () => import.meta.env.VITE_VOICE_API_URL
  ? new URL('/api/checkout', import.meta.env.VITE_VOICE_API_URL).href : '/api/checkout';

function loadCart(){
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    if(!Array.isArray(saved)) return [];
    const clean = [];
    for(const line of saved){
      const p = bySku(line?.sku), qty = Number(line?.qty);
      if(!p || !Number.isInteger(qty) || qty < 1 || (p.sizes && !p.sizes.includes(line.size))) continue;
      const size = p.sizes ? line.size : null;
      const existing = clean.find(c => c.sku === p.sku && c.size === size);
      if(existing) existing.qty = Math.min(99, existing.qty + qty);
      else clean.push({sku:p.sku, size, qty:Math.min(99,qty)});
    }
    return clean;
  } catch { return []; }
}

function Modal({kind, label, onClose, children}){
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current.showModal();
    return () => {
      document.body.style.overflow = overflow;
      if(previous?.isConnected) previous.focus();
    };
  }, []);
  return <dialog ref={ref} className={`shop-dialog shop-dialog-${kind}`} aria-labelledby={label}
    onCancel={e => {e.preventDefault(); onClose();}}
    onClick={e => {if(e.target === e.currentTarget){const r=e.currentTarget.getBoundingClientRect(); if(e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose();}}}>
    {children}
  </dialog>;
}

function Quantity({value, max=99, onChange, label='Quantity'}){
  return <div className="shop-quantity" role="group" aria-label={label}>
    <button type="button" aria-label={`Decrease ${label.toLowerCase()}`} disabled={value<=1} onClick={()=>onChange(value-1)}><Minus size={15}/></button>
    <output aria-live="polite">{value}</output>
    <button type="button" aria-label={`Increase ${label.toLowerCase()}`} disabled={value>=max} onClick={()=>onChange(value+1)}><Plus size={15}/></button>
  </div>;
}

export default function Store(){
  const [filter,setFilter] = useState('All'), [sel,setSel] = useState(null);
  const [size,setSize] = useState(null), [qty,setQty] = useState(1);
  const [cart,setCart] = useState(loadCart), [drawer,setDrawer] = useState(false);
  const [submitting,setSubmitting] = useState(false), [note,setNote] = useState(''), [notice,setNotice] = useState(null);
  const items = useMemo(()=>PRODUCTS.filter(p=>filter==='All'||p.cat===filter),[filter]);
  const d = bySku(sel);
  const cartCount = cart.reduce((t,c)=>t+c.qty,0);
  const subtotal = cart.reduce((t,c)=>t+bySku(c.sku).price*c.qty,0);
  const remaining = d ? 99 - (cart.find(c=>c.sku===d.sku && c.size===(d.sizes?size:null))?.qty || 0) : 99;

  useEffect(()=>{try{localStorage.setItem(CART_KEY,JSON.stringify(cart));}catch{/* Bag remains usable in memory. */}},[cart]);
  useEffect(()=>{
    const params=new URLSearchParams(location.search), order=params.get('order');
    if(order==='filed'){setNotice('filed');setCart([]);}
    else if(order==='tabled') setNotice('tabled');
    if(order){params.delete('order');history.replaceState(null,'',location.pathname+(params.size?'?'+params.toString():'')+location.hash);}
    const p=bySku(params.get('product'));
    if(p){setSel(p.sku);setSize(null);setQty(1);}
  },[]);

  const openDetail=p=>{setSel(p.sku);setSize(null);setQty(1);};
  const closeDetail=()=>{
    setSel(null);
    const params=new URLSearchParams(location.search);
    if(params.has('product')){params.delete('product');history.replaceState(null,'',location.pathname+(params.size?'?'+params.toString():'')+location.hash);}
  };
  const openBag=()=>{setNote('');setDrawer(true);};
  const addToBag=()=>{
    if(!d || (d.sizes && !size) || qty>remaining) return;
    const chosen=d.sizes?size:null;
    setCart(prev=>{
      const found=prev.find(c=>c.sku===d.sku&&c.size===chosen);
      return found?prev.map(c=>c===found?{...c,qty:c.qty+qty}:c):[...prev,{sku:d.sku,size:chosen,qty}];
    });
    closeDetail();openBag();
  };
  const updateQty=(index,value)=>{setNote('');setCart(prev=>prev.map((c,i)=>i===index?{...c,qty:value}:c));};
  const remove=index=>{setNote('');setCart(prev=>prev.filter((_,i)=>i!==index));};
  const submitOrder=async()=>{
    if(!cart.length||submitting) return;
    setSubmitting(true);setNote('Routing your order for approval…');
    try{
      const res=await fetch(endpoint(),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cart:cart.map(c=>({sku:c.sku,size:c.size,qty:c.qty}))})});
      const body=await res.json().catch(()=>({}));
      if(!res.ok||!body.url) throw new Error(body.error||'Checkout is not configured');
      location.assign(body.url);
    }catch(err){
      setSubmitting(false);
      setNote(/not configured/i.test(err.message||'')?'Checkout is not yet available. Your bag has been saved.':'The order could not be filed. Your bag is saved; please try again.');
    }
  };

  return <div className="shop-app">
    <a className="shop-skip" href="#collection">Skip to products</a>
    <Header base="../" active="Store"><button className="cb-header-bag" onClick={openBag} aria-label={`Open bag, ${cartCount} items`}>Bag ({String(cartCount).padStart(2,'0')})</button></Header>
    <div className="shop-announcement">FREE SHIPPING AT $50 <span>·</span> PRINTED ON DEMAND <span>·</span> WORN OFF THE CLOCK</div>
    {notice&&<div className="shop-notice" role="status"><span>{notice==='filed'?'Order filed. Thank you for your contribution to corporate culture.':'Checkout paused. Your bag is right where you left it.'}</span><button onClick={()=>setNotice(null)} aria-label="Dismiss notice"><X size={18}/></button></div>}
    <main>
      <section className="shop-hero" aria-labelledby="shop-title">
        <div className="shop-hero-copy"><span className="shop-label">THE COMPANY STORE / COLLECTION 01</span><h1 id="shop-title">OUT OF<br/>OFFICE.</h1><p>For the person behind<br/>the professional persona.</p><a href="#collection" className="shop-primary">SHOP THE COLLECTION <ArrowRight size={22}/></a><span className="shop-hero-fine">SHIRTS. HATS. SMALL ACTS OF NONCOMPLIANCE.</span></div>
        <button className="shop-campaign" onClick={()=>openDetail(bySku('CS-102'))} aria-label="Shop Per My Last Email Tee">
          <img src="../store/cs-102.webp" width="1024" height="1024" fetchpriority="high" alt="Off-duty styling with the Per My Last Email Tee"/>
          <span className="shop-campaign-stamp" aria-hidden="true">PER MY<br/>LAST EMAIL.</span>
          <span className="shop-campaign-caption"><span>THE AFTER-HOURS UNIFORM</span><span>$28 <ArrowUpRight size={18}/></span></span>
        </button>
      </section>
      <section className="shop-collection" id="collection" aria-labelledby="collection-title">
        <div className="shop-section-head"><div><span className="shop-label">GOOD TASTE. QUESTIONABLE ATTITUDE.</span><h2 id="collection-title">OFFICE ESSENTIALS.</h2></div><p>Wear your boundaries.<br/>Decorate accordingly.</p></div>
        <div className="shop-filter-row"><div className="shop-filters" role="group" aria-label="Filter products">{CATEGORIES.map(c=><button key={c} className={c===filter?'is-selected':''} aria-pressed={c===filter} onClick={()=>setFilter(c)}>{c}</button>)}</div><span className="shop-count" aria-live="polite">{String(items.length).padStart(2,'0')} ITEMS</span></div>
        <div className="shop-grid">{items.map(p=><button className="shop-product" key={p.sku} onClick={()=>openDetail(p)} aria-label={`View ${p.name}, ${fmt(p.price)}`}>
          <div className={`shop-product-image shop-image-${p.sku}`}><ProductVisual product={p}/><span className="shop-product-tag">{p.cat}</span><span className="shop-product-open" aria-hidden="true"><ArrowUpRight size={22}/></span></div>
          <div className="shop-product-info"><span>{p.name}</span><span>{fmt(p.price)}</span></div><small>{isDesignPreview(p)?'Design preview':'Circle Back®'}</small>
        </button>)}</div>
      </section>
      <section className="shop-editorial" aria-labelledby="dress-code"><div><span className="shop-label">AN UPDATED EMPLOYEE HANDBOOK</span><h2 id="dress-code">DRESS CODE:<br/>DON’T REPLY ALL.</h2></div><div><span className="shop-editorial-mark" aria-hidden="true">↗</span><p>Big feelings. Small talk.<br/>A soundtrack for all of it.</p><a className="shop-text-link" href="../#listen">Clock in to Circle Back Radio <ArrowUpRight size={18}/></a></div></section>
      <div className="shop-service"><span>01 / INDEPENDENT DESIGN</span><span>02 / PRINTED ON DEMAND</span><span>03 / CORPORATE CULTURE, RECONSIDERED</span></div>
    </main>
    <Footer/>
    {d&&<Modal kind="product" label="product-title" onClose={closeDetail}>
      <button className="shop-close" onClick={closeDetail} aria-label="Close product detail"><X size={23}/></button>
      <div className="shop-detail-image"><ProductVisual product={d} eager/>{isDesignPreview(d)&&<span className="shop-preview-label">DESIGN PREVIEW</span>}</div>
      <div className="shop-detail-info"><span className="shop-label">{d.cat} / {d.sku}</span><h2 id="product-title">{d.name}</h2><div className="shop-detail-price">{fmt(d.price)} <span>USD</span></div><p className="shop-description">{d.desc}</p>
        {d.sizes?<fieldset className="shop-size-field"><legend>SIZE <span>{size||'SELECT YOUR SIZE'}</span></legend><div className="shop-sizes">{d.sizes.map(s=><button key={s} className={s===size?'is-selected':''} aria-pressed={s===size} onClick={()=>{setSize(s);setQty(1);}}>{s}</button>)}</div></fieldset>:<p className="shop-one-size">{d.cat==='Hats'?'ONE SIZE / ADJUSTABLE':'ONE SIZE'}</p>}
        <div className="shop-add-row"><Quantity value={qty} max={remaining} onChange={setQty}/><button className="shop-primary" onClick={addToBag} disabled={(d.sizes&&!size)||remaining<qty}>{remaining<qty?'BAG LIMIT REACHED':d.sizes&&!size?'SELECT A SIZE':'ADD TO BAG'}<ArrowRight size={20}/></button></div>
        <p className="shop-detail-shipping">Printed on demand. Free shipping at $50.</p>
        <details className="shop-details" open><summary>THE FINE PRINT</summary><dl>{d.specs.map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></details>
      </div>
    </Modal>}
    {drawer&&<Modal kind="bag" label="bag-title" onClose={()=>setDrawer(false)}>
      <div className="shop-bag-head"><div><span className="shop-label">PERSONAL EFFECTS / CS-01</span><h2 id="bag-title">YOUR BAG <span>({String(cartCount).padStart(2,'0')})</span></h2></div><button className="shop-close" onClick={()=>setDrawer(false)} aria-label="Close bag"><X size={23}/></button></div>
      {cart.length===0?<div className="shop-empty"><span aria-hidden="true">(00)</span><h3>NOTHING TO DECLARE.</h3><p>Your next office essential is out there.</p><button className="shop-primary" onClick={()=>{setDrawer(false);document.getElementById('collection').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}}>BACK TO THE COLLECTION <ArrowRight size={19}/></button></div>:<>
        <div className="shop-bag-shipping">{subtotal>=50?'FREE SHIPPING. A WELL-EARNED PERK.':`${fmt(50-subtotal)} AWAY FROM FREE SHIPPING.`}</div>
        <div className="shop-cart-list">{cart.map((c,i)=>{const p=bySku(c.sku);return <div className="shop-cart-row" key={c.sku+(c.size||'')}><div className="shop-cart-image"><ProductVisual product={p}/></div><div className="shop-cart-info"><h3>{p.name}</h3><p>{c.size?`SIZE ${c.size}`:'ONE SIZE'} <span>{fmt(p.price*c.qty)}</span></p><div><Quantity value={c.qty} onChange={v=>updateQty(i,v)} label={`Quantity of ${p.name}${c.size?` size ${c.size}`:''}`}/><button className="shop-remove" onClick={()=>remove(i)} aria-label={`Remove ${p.name}${c.size?` size ${c.size}`:''}`}>Remove</button></div></div></div>;})}</div>
        <div className="shop-bag-bottom"><div className="shop-subtotal"><span>SUBTOTAL</span><strong>{fmt(subtotal)}</strong></div><p>Shipping and taxes calculated at checkout. All sales final.</p><button className="shop-primary" onClick={submitOrder} disabled={submitting}>{submitting?'ROUTING YOUR ORDER…':'CHECKOUT'}<ArrowRight size={20}/></button><p className="shop-bag-note" role="status">{note}</p></div>
      </>}
    </Modal>}
  </div>;
}
