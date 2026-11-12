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
      button.type = "button";
      button.textContent = "Sign in with Google";
      button.addEventListener("click", () =>
        window.__gsi.config.callback({ credential: FAKE_CREDENTIAL })
      );
      container.append(button);
    },
  };

  window.google = { ...window.google, accounts: { id } };
})();
