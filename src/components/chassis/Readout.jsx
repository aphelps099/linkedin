import React from 'react';

// Mono tabular value text — IBM Plex Mono, blue by default.
export function Readout({ children, ink, style }) {
  return <span style={{ fontFamily: 'var(--mono)', fontVariantNumeric: 'tabular-nums', fontSize: 'var(--readout-size)', color: ink ? 'var(--ink)' : 'var(--blue)', ...style }}>{children}</span>;
}
