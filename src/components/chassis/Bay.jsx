import React from 'react';
import { Silk } from './Silk.jsx';

// Column section: 2px rule on top, uppercase title left, blue aside right.
export function Bay({ title, aside, children, style }) {
  return <div style={style}>
    {(title || aside) && <div style={{ borderTop: 'var(--rule-section) solid var(--ink)', paddingTop: 7, marginBottom: 'var(--space-head)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Silk>{title}</Silk>
      {aside !== undefined && <Silk blue>{aside}</Silk>}
    </div>}
    {children}
  </div>;
}
