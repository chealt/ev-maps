(() => {
  const FAKE_CREDENTIAL = [
    "header",
    btoa(JSON.stringify({ name: "Ada Lovelace", email: "ada@example.com" })),
    "signature",
  ].join(".");

  window.__gsi = {};

  const id = {
    initialize(config) {
      window.__gsi.config = config;
    },
    renderButton(container, options) {
      window.__gsi.buttonOptions = options;
      const button = document.createElement("button");
      button.className = "fake-google-signin";
      button.textContent = "G";
      button.setAttribute("aria-label", "Sign in with Google");
      button.style.cssText = "width: 40px; height: 40px; border-radius: 50%;";
      button.addEventListener("click", () =>
        window.__gsi.config.callback({ credential: FAKE_CREDENTIAL })
      );
      container.append(button);
    },
  };

  window.google = { ...window.google, accounts: { id } };
})();
