import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Self-hosted, Latin-only subsets (OFL-1.1): no third-party request and no
// render-blocking stylesheet. CJK text falls back to the system face.
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow/latin-700.css';
import '@fontsource/barlow-semi-condensed/latin-500.css';
import '@fontsource/barlow-semi-condensed/latin-600.css';
import '@fontsource/barlow-semi-condensed/latin-700.css';

import { App } from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
