import React from 'react';

// Blue ticker bar: white chip label + uppercase mono text + block cursor. The phrase display.
export function Ticker({ label = 'Now playing', children, cursor = true, style }) {
  return <div style={{ background: 'var(--blue)', color: '#fff', display: 'flex', alignItems: 'center', gap: 18, padding: '13px 16px', ...style }}>
    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', background: '#fff', color: 'var(--blue)', padding: '3px 6px', flex: 'none' }}>{label}</span>
    <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--ticker-size)', letterSpacing: '.03em', whiteSpace: 'nowrap', overflow: 'hidden', textTransform: 'uppercase' }}>
      {children}{cursor && <span style={{ background: '#fff', color: 'var(--blue)', padding: '0 3px', marginLeft: 6 }}>▮</span>}
    </span>
  </div>;
}
