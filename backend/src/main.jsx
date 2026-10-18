import React from 'react';
import { createRoot } from 'react-dom/client';
import PhoneApp from './PhoneApp.jsx';
import TvApp from './TvApp.jsx';
import './styles.css';

// `/` = phone controller (the product); `/?surface=tv` or `/tv` = web host for debugging.
const isTv = new URLSearchParams(location.search).get('surface') === 'tv' || /^\/tv\/?$/.test(location.pathname);
document.body.classList.add(isTv ? 'tv' : 'phone');
createRoot(document.getElementById('root')).render(isTv ? <TvApp /> : <PhoneApp />);
