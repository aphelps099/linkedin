import React from 'react';

// Keyboard key chip used in hint prose.
export function Kbd({ children, style }) {
  return <kbd style={{ fontFamily: 'var(--mono)', fontSize: 10.5, background: 'var(--white)', border: '1px solid var(--ink)', borderBottomWidth: 2, padding: '1px 5px', color: 'var(--ink)', ...style }}>{children}</kbd>;
}
