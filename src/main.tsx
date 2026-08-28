import { createRoot } from "react-dom/client";
import { ThemeProvider } from "./contexts/ThemeContext";
import App from "./App.tsx";
import "./index.css";

// Ensure default blue theme on startup
document.documentElement.removeAttribute('data-theme-color');

// Remove the static boot loader once the bundle is ready
document.getElementById('boot-loader')?.remove();

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
