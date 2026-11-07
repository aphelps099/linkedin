import React from 'react';
import ReactDOM from 'react-dom/client';
import '../brand/fonts.css';
import Roast from './Roast.jsx';

const root=import.meta.hot?.data.root??ReactDOM.createRoot(document.getElementById('root'));
if(import.meta.hot)import.meta.hot.data.root=root;
root.render(<Roast/>);
