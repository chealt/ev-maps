import {
  animationsWanted,
  onSystemMotionChange,
  setAnimationsWanted,
  systemReducesMotion,
} from "../../lib/motion.js";

class MotionSettingElement extends HTMLElement {
  connectedCallback() {
    this.checkbox = this.querySelector(".animations");
    this.checkbox.addEventListener("change", () => setAnimationsWanted(this.checkbox.checked));
    this.show();
    onSystemMotionChange(() => this.show());
  }

  // While the system asks for reduced motion, animations are off and can't
  // be turned on here: the box is unticked and disabled, and the hint says
  // why. Otherwise it shows the user's choice.
  show() {
    const overridden = systemReducesMotion();
    this.checkbox.checked = !overridden && animationsWanted();
    this.checkbox.disabled = overridden;
    this.querySelector(".hint").hidden = !overridden;
  }
}

customElements.define("ev-motion-setting", MotionSettingElement);

export { MotionSettingElement };
