import React from 'react';
import {createRoot} from 'react-dom/client';
import '../styles.css';
import '../brand/fonts.css';
import './stage.css';
import CircleBack from '../CircleBack.jsx';
createRoot(document.getElementById('root')).render(<CircleBack stagePreview/>);
