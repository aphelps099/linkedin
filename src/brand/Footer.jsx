import React from 'react';
import './fonts.css';
import './footer.css';

export function Footer(){
  const backToTop=()=>{
    window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    document.querySelector('.cb-header-brand')?.focus({preventScroll:true});
  };
  return <footer id="about" className="brand-footer">
    <div className="brand-footer-top"><span>END OF BROADCAST.</span><nav aria-label="Aaron Phelps online">
      <a href="https://look-serious.com/">Look Serious ↗</a>
      <a href="https://aaroncphelps.com/">aaroncphelps.com ↗</a>
      <a href="https://www.linkedin.com/in/aaroncphelps/">LinkedIn ↗</a>
    </nav></div>
    <svg className="brand-footer-wordmark" viewBox="0 0 1000 180" role="img" aria-label="LinkedIn Beats"><text x="0" y="158" textLength="1000" lengthAdjust="spacingAndGlyphs">LINKEDIN BEATS</text></svg>
    <div className="brand-footer-credit"><span><i aria-hidden="true"/>DEPARTMENT OF PROFESSIONAL NONSENSE</span><span>A SIDE PROJECT BY AARON PHELPS</span></div>
    <div className="brand-footer-bottom"><span>© {new Date().getFullYear()} LINKEDIN BEATS</span><small>Independent parody. Not affiliated with LinkedIn.</small><button onClick={backToTop}>Back to top ↑</button></div>
  </footer>;
}
