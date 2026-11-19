// theme.js -- light/dark theme. The initial theme is applied by a tiny inline
// script in index.html's <head> (so there's no flash of the wrong theme);
// this module owns toggling, persistence, and notifying panels that draw
// with colors CSS can't reach (the map basemap and the Chart.js canvases).
const STORAGE_KEY = "earthpulse-theme";
const listeners = [];

export function getTheme() {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export function onThemeChange(callback) {
  listeners.push(callback);
}

// Read a CSS custom property, so canvas-drawn UI uses the same palette as the page.
export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function applyTheme(theme, persist) {
  document.documentElement.setAttribute("data-theme", theme);
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      /* storage blocked (private mode etc.) -- theme still applies this session */
    }
  }
  syncButton(theme);
  listeners.forEach((cb) => cb(theme));
}

function syncButton(theme) {
  const button = document.getElementById("theme-toggle");
  if (!button) return;
  const next = theme === "light" ? "dark" : "light";
  button.setAttribute("aria-label", `Switch to ${next} theme`);
}

export function initTheme() {
  const button = document.getElementById("theme-toggle");
  syncButton(getTheme());
  if (button) {
    button.addEventListener("click", () => applyTheme(getTheme() === "light" ? "dark" : "light", true));
  }

  // Follow the OS setting live -- but only until the visitor picks a theme themselves.
  const media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;
  if (media && media.addEventListener) {
    media.addEventListener("change", (event) => {
      let saved = null;
      try {
        saved = localStorage.getItem(STORAGE_KEY);
      } catch (e) {}
      if (!saved) applyTheme(event.matches ? "light" : "dark", false);
    });
  }
}
