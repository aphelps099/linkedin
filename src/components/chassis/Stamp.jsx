import React from 'react';

// Rotated blue approval stamp: "Approved — HR". Satirical bureaucratic seal.
export function Stamp({ children, style }) {
  return <span style={{ display: 'inline-block', border: '2px solid var(--blue)', color: 'var(--blue)', fontWeight: 700, fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', padding: '6px 10px', transform: 'rotate(-4deg)', fontFamily: 'var(--sans)', ...style }}>{children}</span>;
}
