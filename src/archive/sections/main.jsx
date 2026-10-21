import React from 'react';
import {createRoot} from 'react-dom/client';
import {Campaigns} from './LinkedInifierGraphPaper.jsx';
import '../../brand/fonts.css';
import '../../brand/type-system.css';
import './graph-paper.css';
import './sheet.css';

createRoot(document.getElementById('root')).render(<main className="section-archive">
  <header className="archive-heading"><a href="/">← LinkedIn Beats</a><p>Section archive / 001</p><h1>LinkedInifier</h1><p>Graph paper edition · Saved October 21, 2026</p><span>Original layout, robot, frame and working examples.</span></header>
  <div className="c2-home c2-home--conversation"><Campaigns base="/"/></div>
</main>);
