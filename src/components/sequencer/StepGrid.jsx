import React, { useState, useRef, useEffect } from 'react';

// Sequencer as a ruled Swiss table: 1px ink grid, blue = hit, ink = accent,
// vox rows print 2-letter phrase codes. Click cycles, drag paints.
// Vox cells use a -1 "current armed phrase" sentinel resolved by the consumer via onChange.
export function StepGrid({ voices, steps = 16, pattern, onChange, playhead = null, selected, onSelect, voxLabels }) {
  const [pat, setPat] = useState(() => pattern || voices.map(() => Array(steps).fill(0)));
  useEffect(() => { if (pattern) setPat(pattern); }, [pattern]);
  const painting = useRef(null);
  useEffect(() => {
    const up = () => painting.current = null;
    window.addEventListener('pointerup', up); return () => window.removeEventListener('pointerup', up);
  }, []);
  const commit = p => { setPat(p); onChange && onChange(p); };
  const cycle = (i, s) => {
    const p = pat.map(r => [...r]);
    if (voices[i].vox) { p[i][s] = p[i][s] ? 0 : -1; painting.current = p[i][s]; }
    else { p[i][s] = (p[i][s] + 1) % 3; painting.current = p[i][s]; }
    commit(p); onSelect && onSelect(i);
  };
  const paint = (i, s) => {
    if (painting.current === null || painting.current === undefined) return;
    if (!!voices[i].vox !== (painting.current < 0 || painting.current === 0)) return;
    const p = pat.map(r => [...r]); p[i][s] = painting.current; commit(p);
  };
  const border = '1px solid var(--ink)';
  return <div style={{ display: 'grid', gridTemplateColumns: `110px repeat(${steps},1fr)`, borderTop: border, borderLeft: border, fontFamily: 'var(--sans)' }}>
    {voices.map((v, i) => {
      const isSel = selected === i;
      return <React.Fragment key={i}>
        <div onClick={() => onSelect && onSelect(i)}
          style={{ border, borderTop: 'none', borderLeft: 'none', height: 'var(--seq-cell-h)', display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: 'var(--label-size)', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer', background: isSel ? 'var(--ink)' : 'var(--white)', color: isSel ? '#fff' : 'var(--ink)', boxSizing: 'border-box' }}>{v.name}</div>
        {pat[i].map((val, s) => {
          const isPh = s === playhead;
          let bg = 'var(--white)', txt = null;
          if (v.vox) { if (val) { bg = 'var(--white)'; txt = (voxLabels && voxLabels[i] && voxLabels[i][s]) || '••'; } }
          else if (val === 2) bg = 'var(--ink)';
          else if (val === 1) bg = 'var(--blue)';
          return <div key={s}
            onPointerDown={e => { e.preventDefault(); cycle(i, s); }}
            onPointerEnter={() => paint(i, s)}
            style={{ border, borderTop: 'none', borderLeft: 'none', height: 'var(--seq-cell-h)', cursor: 'pointer', touchAction: 'none', background: bg, boxSizing: 'border-box', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {txt && <span style={{ fontWeight: 500, fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--blue)' }}>{txt}</span>}
            {isPh && <span style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 0 2px var(--blue-light)', pointerEvents: 'none' }}></span>}
          </div>;
        })}
      </React.Fragment>;
    })}
  </div>;
}
