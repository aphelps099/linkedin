import React from 'react';
import {createRoot} from 'react-dom/client';
import '../home-2/header.css';
import './meeting.css';
import {MeetingStudio} from './MeetingStudio.jsx';
createRoot(document.getElementById('root')).render(<MeetingStudio/>);
