import { createRoot } from "react-dom/client";
import { ThemeProvider } from "./contexts/ThemeContext";
import App from "./App.tsx";
import "./index.css";

// Ensure default blue theme on startup
document.documentElement.removeAttribute('data-theme-color');

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);

// Dismiss the boot overlay: on the homepage it plays one full cycle of the
// supplied intro GIF; everywhere else it disappears as soon as the app mounts.
// A hard cap guarantees nobody is ever trapped on the overlay.
(function dismissBootLoader() {
  const el = document.getElementById('boot-loader');
  if (!el) return;
  const w = window as unknown as { __DKAI_BOOT_MIN__?: number; __DKAI_BOOT_MAX__?: number };
  const min = w.__DKAI_BOOT_MIN__ ?? 0;
  const max = w.__DKAI_BOOT_MAX__ ?? Date.now();
  const delay = Math.max(0, Math.min(min, max) - Date.now());

  const hide = () => {
    el.style.opacity = '0';
    window.setTimeout(() => el.remove(), 400);
  };
  window.setTimeout(hide, delay);
  window.setTimeout(() => document.getElementById('boot-loader')?.remove(), Math.max(0, max - Date.now()) + 500);
})();
