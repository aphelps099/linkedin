import React from 'react';
import {Markdown} from '../engine/markdown.jsx';

// The copy stays selectable and accessible. Bold phrases receive the hand-drawn
// underline; artwork is decorative, so screen readers hear the advice only once.
export function SynergyTip({content, celebrate = false, label = 'Synergy says'}){
  return <aside className={`pg-synergy-tip${celebrate ? ' is-celebrating' : ''}`} aria-label={label}>
    <img src={`/learn/art/synergy-${celebrate ? 'celebrate' : 'tip'}-v2.webp`} width="72" height="72" alt="" loading="lazy"/>
    <div><span className="pg-synergy-label">{label}</span><Markdown className="pg-synergy-copy" text={content}/></div>
  </aside>;
}
