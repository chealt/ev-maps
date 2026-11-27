// The Worker reads this cookie when it redirects / (packages/worker), so the
// picked language wins over the browser's.
const LANGUAGE_COOKIE = "ev-maps-language";
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

const saveLanguage = (language) => {
  document.cookie = `${LANGUAGE_COOKIE}=${language}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
};

class LanguagePickerElement extends HTMLElement {
  connectedCallback() {
    this.addEventListener("change", (event) => {
      const option = event.target.selectedOptions?.[0];
      if (option) {
        saveLanguage(option.value);
        window.location.assign(option.dataset.href);
      }
    });
  }
}

customElements.define("ev-language-picker", LanguagePickerElement);

export { LanguagePickerElement };
