# Circle Back — component reference sources

Design-reference implementations (React JSX + prop contracts). Recreate in your codebase; do not ship as-is.

## chassis/Bay.d.ts
```ts
/**
 * Column section: 2px rule on top, uppercase title left, blue aside right.
 * @startingPoint section="Chassis" subtitle="Ruled column section" viewport="700x180"
 */
export interface BayProps {
  /** Uppercase section title, e.g. "Phrase index" */
  title?: string;
  /** Right-aligned blue annotation, e.g. "01–16" or "Press to opine" */
  aside?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
```

## chassis/Bay.jsx
```jsx
import React from 'react';
import { Silk } from './Silk.jsx';
export function Bay({title, aside, children, style}){
  return <div style={style}>
    {(title||aside) && <div style={{borderTop:'var(--rule-section) solid var(--ink)',paddingTop:7,marginBottom:'var(--space-head)',display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
      <Silk>{title}</Silk>
      {aside !== undefined && <Silk blue>{aside}</Silk>}
    </div>}
    {children}
  </div>;
}
```

## chassis/Bay.prompt.md
```md
Ruled column section (the ".ch" pattern): 2px top rule, uppercase title, blue aside. Use for every grid column.

```jsx
<Bay title="Registers" aside="Cal. A">…dials…</Bay>
```
```

## chassis/Masthead.d.ts
```ts
/**
 * Masthead: logo left, uppercase meta items right, heavy rule below.
 * @startingPoint section="Chassis" subtitle="Logo + meta bar with heavy rule" viewport="700x120"
 */
export interface MastheadProps {
  /** Wordmark text, default "Circle Back" */
  logo?: string;
  /** Registered mark superscript, default "®" */
  mark?: string;
  /** Right-side items, e.g. ["Form CB-16","Rev. 2026-08"] */
  meta?: React.ReactNode[];
  style?: React.CSSProperties;
}
```

## chassis/Masthead.jsx
```jsx
import React from 'react';
export function Masthead({logo='Circle Back', mark='®', meta=[], style}){
  return <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',borderBottom:'var(--rule-heavy) solid var(--ink)',paddingBottom:10,...style}}>
    <span style={{fontSize:'var(--logo-size)',fontWeight:700,letterSpacing:'-.02em'}}>{logo}<sup style={{fontSize:9,verticalAlign:10}}>{mark}</sup></span>
    <span style={{display:'flex',gap:28,fontSize:'var(--label-size)',fontWeight:'var(--label-weight)',letterSpacing:'.14em',textTransform:'uppercase'}}>
      {meta.map((m,i)=><span key={i}>{m}</span>)}
    </span>
  </div>;
}
```

## chassis/Masthead.prompt.md
```md
Masthead bar — wordmark left, corporate-form meta right, 3px rule below. Tops every screen.

```jsx
<Masthead meta={["Form CB-16","Rev. 2026-08","For internal thought leadership only"]}/>
```
```

## chassis/Readout.d.ts
```ts
/** Mono tabular value text — IBM Plex Mono, blue by default. */
export interface ReadoutProps {
  children?: React.ReactNode;
  /** Ink instead of blue */
  ink?: boolean;
  style?: React.CSSProperties;
}
```

## chassis/Readout.jsx
```jsx
import React from 'react';
export function Readout({children, ink, style}){
  return <span style={{fontFamily:'var(--mono)',fontVariantNumeric:'tabular-nums',fontSize:'var(--readout-size)',color:ink?'var(--ink)':'var(--blue)',...style}}>{children}</span>;
}
```

## chassis/Readout.prompt.md
```md
Mono numeric readout, blue: `96 BPM`, `12%`, `01`. Ink variant for footnotes.

```jsx
<Readout>96 BPM</Readout>
```
```

## chassis/Silk.d.ts
```ts
/** House label: 9.5px uppercase, .16em tracking, bold ink. blue/muted variants. */
export interface SilkProps {
  children?: React.ReactNode;
  /** Corporate blue */
  blue?: boolean;
  /** 40% ink for tertiary meta */
  muted?: boolean;
  style?: React.CSSProperties;
}
```

## chassis/Silk.jsx
```jsx
import React from 'react';
export function Silk({children, blue, muted, style}){
  return <span style={{fontSize:'var(--label-size)',letterSpacing:'var(--label-tracking)',textTransform:'uppercase',fontWeight:'var(--label-weight)',fontFamily:'var(--sans)',color:blue?'var(--blue)':muted?'var(--text-meta)':'var(--ink)',...style}}>{children}</span>;
}
```

## chassis/Silk.prompt.md
```md
House label — tiny uppercase bold tracked Helvetica. All labels, section titles, buttons text.

```jsx
<Silk>Phrase index</Silk> <Silk blue>01–16</Silk>
```
```

## chassis/Stamp.d.ts
```ts
/** Rotated blue approval stamp: "Approved — HR". Satirical bureaucratic seal. */
export interface StampProps {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
```

## chassis/Stamp.jsx
```jsx
import React from 'react';
export function Stamp({children, style}){
  return <span style={{display:'inline-block',border:'2px solid var(--blue)',color:'var(--blue)',fontWeight:700,fontSize:10,letterSpacing:'.2em',textTransform:'uppercase',padding:'6px 10px',transform:'rotate(-4deg)',fontFamily:'var(--sans)',...style}}>{children}</span>;
}
```

## chassis/Stamp.prompt.md
```md
Bureaucratic approval stamp, rotated −4°, blue double border.

```jsx
<Stamp>Approved — HR</Stamp>
```
```

## chassis/Ticker.d.ts
```ts
/**
 * Blue ticker bar: white chip label + uppercase mono text + block cursor. The phrase display.
 * @startingPoint section="Chassis" subtitle="Blue now-playing ticker bar" viewport="700x100"
 */
export interface TickerProps {
  /** Chip text, default "Now playing" */
  label?: string;
  /** Ticker text (rendered uppercase mono) */
  children?: React.ReactNode;
  /** Show the block cursor, default true */
  cursor?: boolean;
  style?: React.CSSProperties;
}
```

## chassis/Ticker.jsx
```jsx
import React from 'react';
export function Ticker({label='Now playing', children, cursor=true, style}){
  return <div style={{background:'var(--blue)',color:'#fff',display:'flex',alignItems:'center',gap:18,padding:'13px 16px',...style}}>
    <span style={{fontSize:9,fontWeight:700,letterSpacing:'.2em',textTransform:'uppercase',background:'#fff',color:'var(--blue)',padding:'3px 6px',flex:'none'}}>{label}</span>
    <span style={{fontFamily:'var(--mono)',fontSize:'var(--ticker-size)',letterSpacing:'.03em',whiteSpace:'nowrap',overflow:'hidden',textTransform:'uppercase'}}>
      {children}{cursor && <span style={{background:'#fff',color:'var(--blue)',padding:'0 3px',marginLeft:6}}>▮</span>}
    </span>
  </div>;
}
```

## chassis/Ticker.prompt.md
```md
Blue ticker bar — where the current phrase prints. Full-width, chip label, mono uppercase, block cursor.

```jsx
<Ticker>Humbled and honored to announce</Ticker>
```
```

## chassis/Unit.d.ts
```ts
/** The paper sheet: page container with house padding, paper background, Helvetica. One per screen. */
export interface UnitProps {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
```

## chassis/Unit.jsx
```jsx
import React from 'react';
export function Unit({children, style}){
  return <div style={{width:'100%',maxWidth:1120,background:'var(--surface-page)',color:'var(--text-body)',fontFamily:'var(--sans)',WebkitFontSmoothing:'antialiased',padding:'var(--space-page-y) var(--space-page-x)',boxSizing:'border-box',...style}}>{children}</div>;
}
```

## chassis/Unit.prompt.md
```md
The paper sheet — page container every Circle Back screen sits on. Swiss grid inside; no shadows, no radii.

```jsx
<Unit><Masthead …/>…</Unit>
```
```

## controls/Button.d.ts
```ts
/**
 * Flat Swiss button: white, 1.5px ink border, uppercase label. Hover/press inverts to ink; latched = blue fill (rec latches ink).
 * @startingPoint section="Controls" subtitle="Flat bordered button, invert on hover" viewport="700x100"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Latched: blue fill (or ink when variant="rec") */
  on?: boolean;
  variant?: 'default' | 'rec';
  children?: React.ReactNode;
}
```

## controls/Button.jsx
```jsx
import React from 'react';
export function Button({on, variant='default', children, style, ...rest}){
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  let bg = 'var(--white)', color = 'var(--ink)', border = 'var(--ink)';
  if(on && variant==='rec'){ bg = 'var(--ink)'; color = '#fff'; }
  else if(on){ bg = 'var(--blue)'; color = '#fff'; border = 'var(--blue)'; }
  else if(press){ bg = 'var(--ink)'; color = '#fff'; }
  else if(hover){ bg = 'var(--ink)'; color = '#fff'; }
  return <button {...rest}
    onMouseEnter={e=>{setHover(true); rest.onMouseEnter&&rest.onMouseEnter(e);}}
    onMouseLeave={e=>{setHover(false); setPress(false); rest.onMouseLeave&&rest.onMouseLeave(e);}}
    onMouseDown={e=>{setPress(true); rest.onMouseDown&&rest.onMouseDown(e);}}
    onMouseUp={e=>{setPress(false); rest.onMouseUp&&rest.onMouseUp(e);}}
    style={{fontFamily:'var(--sans)',fontSize:'var(--label-size)',letterSpacing:'var(--label-tracking)',textTransform:'uppercase',fontWeight:700,color,background:bg,border:`var(--rule-frame) solid ${border}`,borderRadius:0,padding:'10px 15px',cursor:'pointer',transition:'background var(--ease-ui), color var(--ease-ui)',...style}}>{children}</button>;
}
```

## controls/Button.prompt.md
```md
Flat bordered button; hover inverts to ink, latched fills blue. Labels are verbs.

```jsx
<Button>Load beat</Button> <Button on>Play</Button> <Button variant="rec" on>Record</Button>
```
```

## controls/Kbd.d.ts
```ts
/** Keyboard key chip used in hint prose. */
export interface KbdProps {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
```

## controls/Kbd.jsx
```jsx
import React from 'react';
export function Kbd({children, style}){
  return <kbd style={{fontFamily:'var(--mono)',fontSize:10.5,background:'var(--white)',border:'1px solid var(--ink)',borderBottomWidth:2,padding:'1px 5px',color:'var(--ink)',...style}}>{children}</kbd>;
}
```

## controls/Kbd.prompt.md
```md
Keyboard key chip for instructional hints.

```jsx
Press <Kbd>space</Kbd> to start.
```
```

## controls/Knob.d.ts
```ts
/**
 * Register dial: flat gauge, ink ring, blue needle; label + blue mono value beside it. Drag up/down; shift = fine; dbl-click = reset; wheel steps.
 * @startingPoint section="Controls" subtitle="Flat register dial with blue needle" viewport="700x120"
 */
export interface KnobProps {
  /** Uppercase label beside the dial, e.g. "Sincerity" */
  label: string;
  /** 0–1. Controlled when provided (pair with onChange) */
  value?: number;
  /** Initial + dbl-click reset value, default 0.5 */
  defaultValue?: number;
  onChange?: (v: number) => void;
  /** Value → readout string; default percent */
  format?: (v: number) => React.ReactNode;
}
```

## controls/Knob.jsx
```jsx
import React, { useRef, useState } from 'react';
import { Silk } from '../chassis/Silk.jsx';
import { Readout } from '../chassis/Readout.jsx';
export function Knob({label, value, defaultValue=.5, onChange, format}){
  const [inner, setInner] = useState(defaultValue);
  const v = value !== undefined ? value : inner;
  const set = x => { const nv = Math.min(1, Math.max(0, x)); if(value === undefined) setInner(nv); onChange && onChange(nv); };
  const drag = useRef(null);
  const fmt = format || (x => Math.round(x*100) + '%');
  const deg = -135 + v*270;
  return <div style={{display:'flex',gap:14,alignItems:'center',userSelect:'none'}}>
    <div style={{width:'var(--dial-size)',height:'var(--dial-size)',borderRadius:'50%',border:'var(--rule-frame) solid var(--ink)',position:'relative',background:'var(--white)',flex:'none',cursor:'ns-resize',touchAction:'none'}}
      onPointerDown={e=>{ drag.current = {y:e.clientY, v}; e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault(); }}
      onPointerMove={e=>{ if(!drag.current) return; const fine = e.shiftKey?.4:1; set(drag.current.v + (drag.current.y - e.clientY)/180*fine); }}
      onPointerUp={()=> drag.current = null} onPointerCancel={()=> drag.current = null}
      onDoubleClick={()=> set(defaultValue)}
      onWheel={e=>{ e.preventDefault(); set(v - Math.sign(e.deltaY)*.03); }}>
      <span style={{position:'absolute',left:'50%',top:'50%',width:2,height:'calc(var(--dial-size)/2 - 8px)',background:'var(--blue)',transformOrigin:'50% 0',transform:`rotate(${deg+180}deg)`,display:'block'}}></span>
      <span style={{position:'absolute',left:'50%',top:'50%',width:6,height:6,margin:-3,borderRadius:'50%',background:'var(--ink)',display:'block'}}></span>
    </div>
    <div>
      <div><Silk>{label}</Silk></div>
      <div style={{marginTop:3}}><Readout>{fmt(v)}</Readout></div>
    </div>
  </div>;
}
```

## controls/Knob.prompt.md
```md
Register dial — flat engraved gauge with blue needle. Stack vertically under a "Registers" Bay.

```jsx
<Knob label="Sincerity" defaultValue={.12}/>
<Knob label="Tempo" format={v=>Math.round(60+v*140)+' BPM'}/>
```
```

## pads/Pad.d.ts
```ts
/**
 * Phrase key: flat white cell, blue mono index top, bold name bottom; fills blue when hot/pressed. Compose inside KeyPlate.
 * @startingPoint section="Pads" subtitle="Flat phrase key, blue when active" viewport="700x160"
 */
export interface PadProps {
  /** Key name, e.g. "Humbled" */
  name: string;
  /** Mono index, e.g. "02" */
  index?: string;
  /** Latched blue (armed/selected) */
  hot?: boolean;
  /** Fired on press / Enter / Space (key flashes blue itself) */
  onTrigger?: () => void;
  style?: React.CSSProperties;
}
/** Collapsed-border grid frame for Pads: 1.5px outer border, keys carry .75px separators. */
export interface KeyPlateProps {
  children?: React.ReactNode;
  /** Grid columns, default 4 */
  columns?: number;
  style?: React.CSSProperties;
}
```

## pads/Pad.jsx
```jsx
import React, { useState } from 'react';
export function Pad({name, index, hot, onTrigger, style}){
  const [hit, setHit] = useState(false);
  const fire = ()=>{ setHit(true); setTimeout(()=>setHit(false), 130); onTrigger && onTrigger(); };
  const active = hot || hit;
  return <div tabIndex={0} role="button" aria-label={name}
    onPointerDown={e=>{ e.preventDefault(); fire(); }}
    onKeyDown={e=>{ if(e.key===' '||e.key==='Enter'){ e.preventDefault(); fire(); } }}
    style={{aspectRatio:'var(--key-ratio)',border:'var(--rule-inner) solid var(--ink)',padding:'9px 11px',display:'flex',flexDirection:'column',justifyContent:'space-between',background:active?'var(--blue)':'var(--white)',cursor:'pointer',userSelect:'none',WebkitTapHighlightColor:'transparent',touchAction:'manipulation',transition:'background var(--ease-ui)',boxSizing:'border-box',...style}}>
    {index !== undefined && <span style={{fontFamily:'var(--mono)',fontWeight:500,fontSize:'var(--key-ix-size)',color:active?'#fff':'var(--blue)'}}>{index}</span>}
    <span style={{fontSize:'var(--key-name-size)',fontWeight:700,letterSpacing:'-.01em',color:active?'#fff':'var(--ink)'}}>{name}</span>
  </div>;
}
export function KeyPlate({children, columns=4, style}){
  return <div style={{display:'grid',gridTemplateColumns:`repeat(${columns},1fr)`,gap:0,border:'var(--rule-frame) solid var(--ink)',...style}}>{children}</div>;
}
```

## pads/Pad.prompt.md
```md
Phrase key + KeyPlate frame. Keys sit edge-to-edge in a bordered plate — no gaps, no radii.

```jsx
<KeyPlate columns={4}>
  <Pad index="01" name="Thrilled" onTrigger={speak}/>
  <Pad index="02" name="Humbled" hot/>
  …
</KeyPlate>
```
```

## sequencer/StepGrid.d.ts
```ts
/**
 * Sequencer as a ruled Swiss table: 1px ink grid, blue = hit, ink = accent, vox rows print 2-letter phrase codes. Click cycles, drag paints.
 * @startingPoint section="Sequencer" subtitle="Ruled table sequencer with vox rows" viewport="700x260"
 */
export interface StepGridProps {
  /** Row per voice; vox rows toggle phrase steps instead of cycling hit/accent */
  voices: { name: string; vox?: boolean }[];
  /** Columns, default 16 */
  steps?: number;
  /** [voice][step]: drums 0 off · 1 hit · 2 accent; vox rows 0 off · nonzero on (consumer resolves -1 sentinel to a phrase id) */
  pattern?: number[][];
  onChange?: (pattern: number[][]) => void;
  /** Step highlighted with an inset blue frame */
  playhead?: number | null;
  /** Selected row index (label inverts to ink) */
  selected?: number;
  onSelect?: (voiceIndex: number) => void;
  /** Per-row array of 2-letter codes shown in active vox cells: voxLabels[row][step] */
  voxLabels?: (string | null)[][];
}
```

## sequencer/StepGrid.jsx
```jsx
import React, { useState, useRef, useEffect } from 'react';
export function StepGrid({voices, steps=16, pattern, onChange, playhead=null, selected, onSelect, voxLabels}){
  const [pat, setPat] = useState(()=> pattern || voices.map(()=> Array(steps).fill(0)));
  useEffect(()=>{ if(pattern) setPat(pattern); },[pattern]);
  const painting = useRef(null);
  useEffect(()=>{ const up = ()=> painting.current = null;
    window.addEventListener('pointerup', up); return ()=> window.removeEventListener('pointerup', up); },[]);
  const commit = p => { setPat(p); onChange && onChange(p); };
  const cycle = (i,s)=>{ const p = pat.map(r=>[...r]);
    if(voices[i].vox){ p[i][s] = p[i][s] ? 0 : -1; painting.current = p[i][s]; } // -1 = "current armed phrase" sentinel resolved by consumer via onChange
    else { p[i][s] = (p[i][s]+1)%3; painting.current = p[i][s]; }
    commit(p); onSelect && onSelect(i); };
  const paint = (i,s)=>{ if(painting.current===null||painting.current===undefined) return;
    if(!!voices[i].vox !== (painting.current<0 || painting.current===0)) return;
    const p = pat.map(r=>[...r]); p[i][s] = painting.current; commit(p); };
  const border = '1px solid var(--ink)';
  return <div style={{display:'grid',gridTemplateColumns:`110px repeat(${steps},1fr)`,borderTop:border,borderLeft:border,fontFamily:'var(--sans)'}}>
    {voices.map((v,i)=>{
      const isSel = selected===i;
      return <React.Fragment key={i}>
        <div onClick={()=> onSelect && onSelect(i)}
          style={{border,borderTop:'none',borderLeft:'none',height:'var(--seq-cell-h)',display:'flex',alignItems:'center',padding:'0 10px',fontSize:'var(--label-size)',fontWeight:700,letterSpacing:'.14em',textTransform:'uppercase',cursor:'pointer',background:isSel?'var(--ink)':'var(--white)',color:isSel?'#fff':'var(--ink)',boxSizing:'border-box'}}>{v.name}</div>
        {pat[i].map((val,s)=>{
          const isPh = s===playhead;
          let bg = 'var(--white)', txt = null;
          if(v.vox){ if(val){ bg = 'var(--white)'; txt = voxLabels && voxLabels[i] && voxLabels[i][s] || '••'; } }
          else if(val===2) bg = 'var(--ink)';
          else if(val===1) bg = 'var(--blue)';
          return <div key={s}
            onPointerDown={e=>{ e.preventDefault(); cycle(i,s); }}
            onPointerEnter={()=> paint(i,s)}
            style={{border,borderTop:'none',borderLeft:'none',height:'var(--seq-cell-h)',cursor:'pointer',touchAction:'none',background:bg,boxSizing:'border-box',position:'relative',display:'flex',alignItems:'center',justifyContent:'center'}}>
            {txt && <span style={{font:'500 9px var(--mono)',fontFamily:'var(--mono)',color:'var(--blue)'}}>{txt}</span>}
            {isPh && <span style={{position:'absolute',inset:0,boxShadow:'inset 0 0 0 2px var(--blue-light)',pointerEvents:'none'}}></span>}
          </div>;
        })}
      </React.Fragment>;
    })}
  </div>;
}
```

## sequencer/StepGrid.prompt.md
```md
Ruled-table sequencer. Drum cells cycle off → blue hit → ink accent; vox rows toggle phrase steps (2-letter codes in blue).

```jsx
<StepGrid voices={[{name:'Kick'},{name:'Snare'},{name:'Vox',vox:true}]}
  pattern={pat} onChange={setPat} playhead={pos} voxLabels={codes}/>
```
```
