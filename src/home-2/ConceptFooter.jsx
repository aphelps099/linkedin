import React, {memo} from 'react';
import {Linkedin} from 'lucide-react';

const MARKS = [
  {slug:'global-nonsense', label:'Certified global nonsense'},
  {slug:'synergy-checked', label:'Certified synergy checked'},
  {slug:'office-safe-ish', label:'Certified office safe-ish'},
];

export const ConceptFooter = memo(function ConceptFooter({base='/'}) {
  return <footer id="c2-footer" className="c2-footer">
    <div className="c2-container">
      <div className="c2-footer-main">
        <div className="c2-footer-identity">
          <a className="c2-footer-brand" href={base} aria-label="LinkedIn Beats home"><img src={`${base}home-2/brand/wordmark-stacked.svg`} width="562" height="252" alt="LinkedIn Beats" loading="lazy"/></a>
          <p>Independent music<br/>for dependent employees.</p>
        </div>
        <div className="c2-footer-fineprint">
          <h2>The necessary small print</h2>
          <p>LinkedIn Beats is an independent parody project. Not affiliated with, endorsed by, or sponsored by LinkedIn Corporation. All trademarks belong to their respective owners.</p>
          <p>For recreational professional development only. No guarantee of promotion, strategic alignment, or stakeholder buy-in. Any resemblance to your Monday meeting is entirely plausible. Use headphones. Exercise judgment. Circle back responsibly.</p>
        </div>
        <div className="c2-footer-assurance">
          <ul className="c2-footer-marks" aria-label="Fictional corporate assurance marks">
            {MARKS.map(({slug,label})=><li key={slug}>
              <span className="c2-footer-seal" style={{'--seal-art':`url("${base}home-2/brand/certified-${slug}.svg")`}}>
                <img src={`${base}home-2/brand/certified-${slug}.svg`} width="300" height="444" loading="lazy" alt={`${label} — fictional corporate assurance mark`}/>
                <span className="c2-footer-metal" aria-hidden="true"/>
              </span>
            </li>)}
          </ul>
          <p>Internal standards. Entirely made up.</p>
        </div>
      </div>
      <div className="c2-footer-bottom">
        <p>© {new Date().getFullYear()} LinkedIn Beats.<span> All expectations managed.</span></p>
        <div className="c2-footer-credit">
          <a className="c2-footer-builder" href="https://look-serious.com/">Built by <strong>Look Serious</strong></a>
          <a className="c2-footer-linkedin" href="https://www.linkedin.com/in/aaroncphelps/" aria-label="Aaron Phelps on LinkedIn" title="Aaron Phelps on LinkedIn"><Linkedin aria-hidden="true"/></a>
        </div>
      </div>
    </div>
  </footer>;
});
