import React from 'react';
import {createRoot} from 'react-dom/client';
import ConceptHome from '../home-2/ConceptHome.jsx';

const variant=/\/home-3(?:\/|$)/.test(window.location.pathname)?'laptop':'screenless';
createRoot(document.getElementById('root')).render(<ConceptHome variant={variant}/>);
