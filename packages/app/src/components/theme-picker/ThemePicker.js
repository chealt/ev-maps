// Layout.astro reads the same key before the first paint.
const THEME_KEY = "ev-maps:theme";
const THEMES = ["system", "light", "dark"];

const readTheme = () => {
  try {
    const theme = localStorage.getItem(THEME_KEY);
    return THEMES.includes(theme) ? theme : "system";
  } catch {
    return "system";
  }
};

const saveTheme = (theme) => {
  try {
    if (theme === "system") {
      localStorage.removeItem(THEME_KEY);
    } else {
      localStorage.setItem(THEME_KEY, theme);
    }
  } catch {
    // Storage can be unavailable (private mode, blocked cookies).
  }
};

class ThemePickerElement extends HTMLElement {
  connectedCallback() {
    const theme = readTheme();
    const input = this.querySelector(`input[value="${theme}"]`);
    if (input) {
      input.checked = true;
    }
    this.addEventListener("change", (event) => this.applyTheme(event.target.value));
  }

  applyTheme(theme) {
    if (theme === "system") {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = theme;
    }
    saveTheme(theme);
    this.dispatchEvent(
      new CustomEvent("theme-change", { detail: { theme }, bubbles: true, composed: true })
    );
  }
}

customElements.define("ev-theme-picker", ThemePickerElement);

export { ThemePickerElement };
