import React from 'react';
import {createRoot} from 'react-dom/client';
import Marquee from './Marquee.jsx';

const base = new URL('../../', window.location.href).pathname;
createRoot(document.getElementById('root')).render(<Marquee base={base}/>);
