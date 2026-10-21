import React from 'react';

export function ScoreReadout({score,charging=false,supercharged=false,baseline=score.index,label='Post score',scaleLabel='Out of 100'}){
  const gain=score.index-baseline;
  const gainLabel=`${gain>=0?'+':''}${gain}`;
  return <div className={`el-score-readout${charging?' is-updating':''}${supercharged?' is-supercharged':''}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={score.index} aria-valuetext={`${score.index} out of 100. ${score.rank}. ${supercharged?`Supercharged, ${gainLabel} points from ${baseline}.`:'Standard LinkedIn version.'}`}>
    <span className="el-score-label" aria-hidden="true">{label}</span>
    <div className="el-score-window" aria-hidden="true">
      <span className="el-score-number">{String(score.index).padStart(2,'0')}</span>
      <span className="el-score-scale">{scaleLabel}</span>
    </div>
    <span className="el-score-rank" aria-hidden="true">{score.rank}</span>
    <span className="el-score-stage" aria-hidden="true">{supercharged?<>Supercharged <strong>{gainLabel}</strong></>:'LinkedInified'}</span>
  </div>;
}
