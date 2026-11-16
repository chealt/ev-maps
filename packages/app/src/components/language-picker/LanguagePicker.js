// The Worker reads this cookie when it redirects / (packages/worker), so the
// picked language wins over the browser's.
const LANGUAGE_COOKIE = "ev-maps-language";
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

const saveLanguage = (language) => {
  document.cookie = `${LANGUAGE_COOKIE}=${language}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
};

class LanguagePickerElement extends HTMLElement {
  connectedCallback() {
    this.addEventListener("click", (event) => {
      const option = event.target.closest("[data-language]");
      if (option) {
        saveLanguage(option.dataset.language);
      }
    });
  }
}

customElements.define("ev-language-picker", LanguagePickerElement);

export { LanguagePickerElement };
