import React from 'react';
import PegLabel from '../synth/PegLabel.jsx';

// Use the same hand-drawn PEG glyphs as the All Hands stage.
export function BeatType({text,face=5}){
  return <span className={`pb-peg-label pb-peg-${face}`}><span className="sr-only">{text}</span><span aria-hidden="true"><PegLabel text={text} face={face} pitch={face===9?4:2} maxCols={500}/></span></span>;
}
