import React from 'react';
import {createRoot} from 'react-dom/client';
import Showcase from './Showcase.jsx';

const base = new URL('../../', window.location.href).pathname;
createRoot(document.getElementById('root')).render(<Showcase base={base}/>);
