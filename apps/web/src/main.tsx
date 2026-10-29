import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/cockpit.css';
import './styles/monitor.css';
import './styles/responsive.css';
import './styles/flight-deck.css';
import './styles/mobile-controls.css';
import './styles/mobile-visual-refinement.css';
import './styles/mobile-speed-tape-refinement.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
