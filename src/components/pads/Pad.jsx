import React, { useState } from 'react';

// Phrase key: flat white cell, blue mono index top-left, keyboard letter top-right,
// bold name bottom; fills blue when hot/pressed (130ms flash on trigger). Compose inside KeyPlate.
export function Pad({ name, index, hotkey, hot, onTrigger, style }) {
  const [hit, setHit] = useState(false);
  const fire = () => { setHit(true); setTimeout(() => setHit(false), 130); onTrigger && onTrigger(); };
  const active = hot || hit;
  return <div tabIndex={0} role="button" aria-label={name}
    onPointerDown={e => { e.preventDefault(); fire(); }}
    onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); fire(); } }}
    style={{ aspectRatio: 'var(--key-ratio)', border: 'var(--rule-inner) solid var(--ink)', padding: '9px 11px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: active ? 'var(--blue)' : 'var(--white)', cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', transition: 'background var(--ease-ui)', boxSizing: 'border-box', ...style }}>
    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      {index !== undefined && <span style={{ fontFamily: 'var(--mono)', fontWeight: 500, fontSize: 'var(--key-ix-size)', color: active ? '#fff' : 'var(--blue)' }}>{index}</span>}
      {hotkey !== undefined && <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 10.5, padding: '0 4px', border: `1px solid ${active ? '#fff' : 'var(--hair)'}`, color: active ? '#fff' : 'var(--text-meta)' }}>{hotkey}</span>}
    </span>
    <span style={{ fontSize: 'var(--key-name-size)', fontWeight: 700, letterSpacing: '-.01em', color: active ? '#fff' : 'var(--ink)' }}>{name}</span>
  </div>;
}

// Collapsed-border grid frame for Pads: 1.5px outer border, keys carry .75px separators.
export function KeyPlate({ children, columns = 4, style }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns},1fr)`, gap: 0, border: 'var(--rule-frame) solid var(--ink)', ...style }}>{children}</div>;
}
