import React from 'react';
import {createRoot} from 'react-dom/client';
import ConceptHero from './Hero.jsx';

const base = new URL('../', window.location.href).pathname;
createRoot(document.getElementById('root')).render(<ConceptHero base={base}/>);
