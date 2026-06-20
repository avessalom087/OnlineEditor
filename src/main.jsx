import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { LanguageProvider } from './utils/localization';
import './index.css';

// Helper to update styled range slider fill (active track)
function updateRangeFill(el) {
  const min = parseFloat(el.min) !== undefined && el.min !== "" ? parseFloat(el.min) : 0;
  const max = parseFloat(el.max) !== undefined && el.max !== "" ? parseFloat(el.max) : 100;
  const val = parseFloat(el.value) !== undefined && el.value !== "" ? parseFloat(el.value) : 0;
  const percent = ((val - min) / (max - min)) * 100;
  el.style.setProperty('--range-percent', `${percent}%`);
}

// Global listener for slider dragging
document.addEventListener('input', (e) => {
  if (e.target && e.target.type === 'range') {
    updateRangeFill(e.target);
  }
});

// Update on mouse over or focus (acts as failsafe for dynamic mounts)
document.addEventListener('mouseenter', (e) => {
  if (e.target && e.target.type === 'range') {
    updateRangeFill(e.target);
  }
}, true);

document.addEventListener('focus', (e) => {
  if (e.target && e.target.type === 'range') {
    updateRangeFill(e.target);
  }
}, true);

// Periodic sync scanning to support React state updates
setInterval(() => {
  const ranges = document.querySelectorAll('input[type="range"]');
  for (let i = 0; i < ranges.length; i++) {
    updateRangeFill(ranges[i]);
  }
}, 300);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </React.StrictMode>
);
