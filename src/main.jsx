import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// TEMP: Remove StrictMode to avoid double rendering during debugging
console.log('🏁 main.jsx starting...');

try {
  const rootElement = document.getElementById('root');
  console.log('🏁 Root element found:', !!rootElement);

  ReactDOM.createRoot(rootElement).render(
    <App />
  );
} catch (error) {
  console.error('❌ CRITICAL ERROR in main.jsx:', error);
  document.body.innerHTML = `
    <div style="padding: 20px; font-family: monospace; background: red; color: white;">
      <h1>❌ FATAL ERROR</h1>
      <pre>${error.message}</pre>
      <pre>${error.stack}</pre>
    </div>
  `;
}
