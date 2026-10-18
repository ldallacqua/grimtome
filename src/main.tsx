import '@fontsource-variable/cinzel';
import '@fontsource-variable/inter';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/cormorant-garamond/600-italic.css';
import './design-system/tokens.css';
import './design-system/base.css';
import './app/app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { OverlayApp } from './features/overlay/OverlayApp';
import { currentWindowKind } from './services/platform';

const kind = currentWindowKind();
document.documentElement.dataset.window = kind;

createRoot(document.getElementById('root')!).render(<StrictMode>{kind === 'overlay' ? <OverlayApp /> : <App />}</StrictMode>);
