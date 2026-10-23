import React from 'react';
import ReactDOM from 'react-dom/client';
import Homepage from './home-test/Homepage.jsx';

// Preserve links shared before the homepage moved the mixer to /studio/.
if (location.hash.startsWith('#beat=')) {
  location.replace(`./studio/${location.search}${location.hash}`);
} else if (location.hash === '#roast') {
  location.replace(`./roast/${location.search}`);
} else {
  ReactDOM.createRoot(document.getElementById('root')).render(<Homepage />);
}
