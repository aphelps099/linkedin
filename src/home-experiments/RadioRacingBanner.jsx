import React, {memo} from 'react';
import {Heart, Lightbulb, Pause, Play, ThumbsUp} from 'lucide-react';

const REACTIONS=[{label:'Like',Icon:ThumbsUp},{label:'Love',Icon:Heart},{label:'Insightful',Icon:Lightbulb}];

export const RadioRacingBanner=memo(function RadioRacingBanner({base,motion,running,paused,onPause}){
  return <div className="development-racing" data-running={running}>
    <div className="development-racing-viewport" aria-hidden="true">
      <div className="development-racing-track">
        {/* Each lap ends at the next droid. A third identical lap keeps the
            viewport covered throughout the rightward, one-lap translation. */}
        {[0,1,2].map(copy=><div className="development-racing-lap" key={copy}>
          <img className="development-racing-droid" src={`${base}home-experiments/office-droid.svg`} width="800" height="540" alt="" decoding="async" draggable="false"/>
          <span className="development-racing-gap"/>
          <div className="development-racing-pennant">
            <div className="development-racing-message">
              <span>Humbled.</span><span>Honored.</span><strong>Thrilled.</strong>
            </div>
            <div className="development-racing-reactions">
              {REACTIONS.map(({label,Icon},index)=><span key={label} style={{'--reaction-delay':`${index*1.8}s`}}>
                <Icon fill={index===1?'currentColor':'none'}/><span>{label}</span>
              </span>)}
            </div>
          </div>
          <span className="development-racing-tow"/>
        </div>)}
      </div>
    </div>
    {motion&&<button type="button" className="development-scene-toggle" aria-label={paused?'Resume background animation':'Pause background animation'} aria-pressed={paused} onClick={onPause}>
      {paused?<Play aria-hidden="true"/>:<Pause aria-hidden="true"/>}
    </button>}
  </div>;
});
