export type Theme = "light" | "dark";

const STORAGE_KEY = "bandhan-theme";
const CHANGE_EVENT = "bandhan-theme-change";

// Run in the document head so a saved dark theme is applied before first paint.
export const THEME_INIT_SCRIPT = `(() => {
  let theme = "light";
  try { if (localStorage.getItem("${STORAGE_KEY}") === "dark") theme = "dark"; } catch {}
  document.documentElement.dataset.theme = theme;
})();`;

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* Theme still works without storage. */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeTheme(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    document.documentElement.dataset.theme = event.newValue === "dark" ? "dark" : "light";
    onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
