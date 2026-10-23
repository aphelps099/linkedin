import React from 'react';
import {createRoot} from 'react-dom/client';
import Homepage from './Homepage.jsx';

const assetBase=new URL('../',window.location.href).pathname;
createRoot(document.getElementById('root')).render(<Homepage assetBase={assetBase}/>);
