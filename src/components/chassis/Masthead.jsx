import React from 'react';

// Masthead: logo left, uppercase meta items right, heavy rule below.
export function Masthead({ logo = 'Circle Back', mark = '®', meta = [], style }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: 'var(--rule-heavy) solid var(--ink)', paddingBottom: 10, ...style }}>
    <span style={{ fontSize: 'var(--logo-size)', fontWeight: 700, letterSpacing: '-.02em' }}>{logo}<sup style={{ fontSize: 9, verticalAlign: 10 }}>{mark}</sup></span>
    <span style={{ display: 'flex', gap: 28, fontSize: 'var(--label-size)', fontWeight: 'var(--label-weight)', letterSpacing: '.14em', textTransform: 'uppercase' }}>
      {meta.map((m, i) => <span key={i}>{m}</span>)}
    </span>
  </div>;
}
