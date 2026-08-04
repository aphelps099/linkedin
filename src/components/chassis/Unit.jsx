import React from 'react';

// The paper sheet: page container with house padding, paper background, Helvetica. One per screen.
export function Unit({ children, style }) {
  return <div style={{ width: '100%', maxWidth: 1120, background: 'var(--surface-page)', color: 'var(--text-body)', fontFamily: 'var(--sans)', WebkitFontSmoothing: 'antialiased', padding: 'var(--space-page-y) var(--space-page-x)', boxSizing: 'border-box', ...style }}>{children}</div>;
}
