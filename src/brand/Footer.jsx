import React from 'react';
import './footer.css';

export function Footer(){
  return <footer id="about" className="brand-footer">
    <div><span>LINKEDIN BEATS</span><small>Independent parody. Not affiliated with LinkedIn.</small></div>
    <nav aria-label="Aaron Phelps online">
      <a href="https://look-serious.com/">Look Serious ↗</a>
      <a href="https://aaroncphelps.com/">Aaron Phelps ↗</a>
      <a href="https://www.linkedin.com/in/aaroncphelps/">LinkedIn ↗</a>
    </nav>
  </footer>;
}
