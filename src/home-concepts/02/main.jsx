import React from 'react';
import {createRoot} from 'react-dom/client';
import Meeting from './Meeting.jsx';

const base = new URL('../../', window.location.href).pathname;
createRoot(document.getElementById('root')).render(<Meeting base={base}/>);
