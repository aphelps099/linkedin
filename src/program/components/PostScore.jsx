import React from 'react';
import {score} from '../engine/performer.js';

export function PostScore({text, title='Post score'}){
  const s = score(text);
  const rows = [['Buzzwords per 100 words', s.buzzDensity], ['Gratitude', s.gratitudeLabel], ['Dramatic one-liners', s.oneLiners], ['Journeys referenced', s.journeys]];
  return <section className={`pg-score${s.index >= 88 ? ' is-maximal' : ''}`} aria-label={title}>
    <div className="pg-score-summary">
      <div className="pg-score-gauge" role="meter" aria-label={title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.index} aria-valuetext={`${s.index} out of 100. ${s.rank}`}>
        <svg viewBox="0 0 120 120" aria-hidden="true"><circle className="pg-gauge-track" cx="60" cy="60" r="52"/><circle className="pg-gauge-fill" cx="60" cy="60" r="52" pathLength="100" strokeDasharray={`${s.index} 100`} style={{opacity:s.index ? 1 : 0}}/></svg>
        <span className="pg-gauge-value" aria-hidden="true"><strong>{s.index}</strong><span>/ 100</span></span>
      </div>
      <div className="pg-score-caption"><span className="pg-score-label">{title} · LinkedIn intensity</span><h3>{s.rank}</h3><p>{s.index >= 88 ? 'You have exceeded your recommended daily allowance of thought leadership.' : s.index >= 50 ? 'The facts are still in there. Somewhere beneath the personal brand.' : 'Still recognizably human. There is no need to fix that.'}</p></div>
    </div>
    <div className="pg-score-metrics">{[['Humble-brag', s.humbleBrag], ['“Well deserved!” potential', s.wellDeserved]].map(([label, value])=><div className="pg-score-metric" key={label}>
      <div><span>{label}</span><strong>{value}%</strong></div><div className="pg-metric-track" aria-hidden="true"><span style={{width:`${value}%`}}/></div>
    </div>)}</div>
    <details className="pg-score-details"><summary>What’s behind the score?</summary><dl>{rows.map(([label, value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p>Satirical posting metrics. This measures LinkedIn-ness, not the quality of your work.</p></details>
  </section>;
}
