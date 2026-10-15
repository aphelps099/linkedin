import React from 'react';
import ReactDOM from 'react-dom/client';
import Homepage from './home/Homepage.jsx';

// Preserve links shared before the homepage moved the mixer to /studio/.
if (location.hash.startsWith('#beat=')) {
  location.replace(`./studio/${location.search}${location.hash}`);
} else {
  ReactDOM.createRoot(document.getElementById('root')).render(<Homepage />);
}
