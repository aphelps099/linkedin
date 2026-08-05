import React from 'react';

// Flat Swiss button: white, 1.5px ink border, uppercase label.
// Hover/press inverts to ink; latched = blue fill (rec latches ink).
export function Button({ on, variant = 'default', children, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  let bg = 'var(--white)', color = 'var(--ink)', border = 'var(--ink)';
  if (on && variant === 'rec') { bg = 'var(--ink)'; color = '#fff'; }
  else if (on) { bg = 'var(--blue)'; color = '#fff'; border = 'var(--blue)'; }
  else if (press) { bg = 'var(--ink)'; color = '#fff'; }
  else if (hover) { bg = 'var(--ink)'; color = '#fff'; }
  return <button {...rest}
    onMouseEnter={e => { setHover(true); rest.onMouseEnter && rest.onMouseEnter(e); }}
    onMouseLeave={e => { setHover(false); setPress(false); rest.onMouseLeave && rest.onMouseLeave(e); }}
    onMouseDown={e => { setPress(true); rest.onMouseDown && rest.onMouseDown(e); }}
    onMouseUp={e => { setPress(false); rest.onMouseUp && rest.onMouseUp(e); }}
    style={{ fontFamily: 'var(--sans)', fontSize: 'var(--label-size)', letterSpacing: 'var(--label-tracking)', textTransform: 'uppercase', fontWeight: 700, color, background: bg, borderWidth: 'var(--rule-frame)', borderStyle: 'solid', borderColor: border, borderRadius: 0, padding: '10px 15px', cursor: 'pointer', transition: 'background var(--ease-ui), color var(--ease-ui)', ...style }}>{children}</button>;
}
