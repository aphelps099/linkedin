import React, { useRef, useState } from 'react';
import { Silk } from '../chassis/Silk.jsx';
import { Readout } from '../chassis/Readout.jsx';

// Register dial: flat gauge, ink ring, blue needle; label + blue mono value beside it.
// Drag up/down (180px = full range); shift = 0.4x fine; dbl-click = reset; wheel = ±3%.
export function Knob({ label, value, defaultValue = .5, onChange, format }) {
  const [inner, setInner] = useState(defaultValue);
  const v = value !== undefined ? value : inner;
  const set = x => { const nv = Math.min(1, Math.max(0, x)); if (value === undefined) setInner(nv); onChange && onChange(nv); };
  const drag = useRef(null);
  const fmt = format || (x => Math.round(x * 100) + '%');
  const deg = -135 + v * 270;
  return <div style={{ display: 'flex', gap: 14, alignItems: 'center', userSelect: 'none' }}>
    <div style={{ width: 'var(--dial-size)', height: 'var(--dial-size)', borderRadius: '50%', border: 'var(--rule-frame) solid var(--ink)', position: 'relative', background: 'var(--white)', flex: 'none', cursor: 'ns-resize', touchAction: 'none' }}
      onPointerDown={e => { drag.current = { y: e.clientY, v }; e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault(); }}
      onPointerMove={e => { if (!drag.current) return; const fine = e.shiftKey ? .4 : 1; set(drag.current.v + (drag.current.y - e.clientY) / 180 * fine); }}
      onPointerUp={() => drag.current = null} onPointerCancel={() => drag.current = null}
      onDoubleClick={() => set(defaultValue)}
      onWheel={e => { e.preventDefault(); set(v - Math.sign(e.deltaY) * .03); }}>
      <span style={{ position: 'absolute', left: '50%', top: '50%', width: 2, height: 'calc(var(--dial-size)/2 - 8px)', background: 'var(--blue)', transformOrigin: '50% 0', transform: `rotate(${deg + 180}deg)`, display: 'block' }}></span>
      <span style={{ position: 'absolute', left: '50%', top: '50%', width: 6, height: 6, margin: -3, borderRadius: '50%', background: 'var(--ink)', display: 'block' }}></span>
    </div>
    <div>
      <div><Silk>{label}</Silk></div>
      <div style={{ marginTop: 3 }}><Readout>{fmt(v)}</Readout></div>
    </div>
  </div>;
}
