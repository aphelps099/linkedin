import React from 'react';

export function ScoreReadout({score,charging=false,supercharged=false,baseline=score.index}){
  const gain=score.index-baseline;
  const gainLabel=`${gain>=0?'+':''}${gain}`;
  return <div className={`el-score-readout${charging?' is-updating':''}${supercharged?' is-supercharged':''}`} role="meter" aria-label="Post score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score.index} aria-valuetext={`${score.index} out of 100. ${score.rank}. ${supercharged?`Supercharged, ${gainLabel} points from ${baseline}.`:'Standard LinkedIn version.'}`}>
    <div className="el-score-caption" aria-hidden="true">
      <span className="el-score-label">Post score</span>
      <span className="el-score-rank">{score.rank}</span>
      <span className="el-score-stage">{supercharged?<>Supercharged <strong>{gainLabel}</strong></>:'LinkedInified'}</span>
    </div>
    <div className="el-score-window" aria-hidden="true">
      <span className="el-score-number">{String(score.index).padStart(2,'0')}</span>
      <span className="el-score-scale">/100</span>
    </div>
  </div>;
}
