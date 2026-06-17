import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/theme.css';
import './styles/hud.css';
import { GameApp } from './app/GameApp';
import { HudRoot } from './ui/HudRoot';
import { I18nProvider } from './i18n/I18nProvider';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root element not found');

// The engine lives outside React. The camera <video> and WebGL <canvas> are
// layered behind the React HUD (#root) via z-index in hud.css.
const app = new GameApp();
app.mount(document.body);

createRoot(rootEl).render(
  <StrictMode>
    <I18nProvider>
      <HudRoot app={app} />
    </I18nProvider>
  </StrictMode>,
);
