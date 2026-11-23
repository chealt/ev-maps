import { animateEscape, closeDialog, openDialog } from "../../lib/motion.js";

class ShortcutsDialogElement extends HTMLElement {
  connectedCallback() {
    this.dialog = this.querySelector("dialog");
    this.dialog?.querySelector(".close")?.addEventListener("click", () => closeDialog(this.dialog));
    if (this.dialog) {
      animateEscape(this.dialog);
    }
    document.addEventListener("keydown", (event) => {
      if (event.key !== "?" || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      // Not while typing (e.g. a place to route from) or in a dialog: those
      // keys belong to it.
      const target = event.target;
      if (
        target.matches?.("input, textarea, select, [contenteditable]") ||
        document.querySelector("dialog[open]")
      ) {
        return;
      }
      event.preventDefault();
      openDialog(this.dialog);
    });
  }
}

customElements.define("ev-shortcuts", ShortcutsDialogElement);

export { ShortcutsDialogElement };
