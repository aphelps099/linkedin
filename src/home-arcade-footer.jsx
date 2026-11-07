import React from 'react';
import {createRoot} from 'react-dom/client';
import {HomepageEncore} from './home-2/HomepageEncore.jsx';
import {SiteFooter} from './brand/SiteFooter.jsx';
const root=import.meta.hot?.data.root??createRoot(document.getElementById('homepage-ending'));
if(import.meta.hot)import.meta.hot.data.root=root;
root.render(<><HomepageEncore/><div id="homepage-footer"><SiteFooter base="/"/></div></>);
