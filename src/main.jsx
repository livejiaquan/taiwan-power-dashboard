import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Self-hosted Inter, Latin subset only (OFL-1.1): the reference's typeface,
// no third-party request. CJK text falls back to the system face.
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';

import { App } from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
