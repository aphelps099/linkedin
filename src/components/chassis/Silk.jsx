import React from 'react';

// House label: 9.5px uppercase, .16em tracking, bold ink. blue/muted variants.
export function Silk({ children, blue, muted, style }) {
  return <span style={{ fontSize: 'var(--label-size)', letterSpacing: 'var(--label-tracking)', textTransform: 'uppercase', fontWeight: 'var(--label-weight)', fontFamily: 'var(--sans)', color: blue ? 'var(--blue)' : muted ? 'var(--text-meta)' : 'var(--ink)', ...style }}>{children}</span>;
}
