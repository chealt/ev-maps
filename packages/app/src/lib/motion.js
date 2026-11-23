// Whether the page animates: on by default, off if the user turned it off in
// the account menu (<ev-motion-setting>), and always off while the system
// asks for reduced motion, whatever the setting. Layout.astro applies the
// saved setting before the first paint (data-animations="off" on <html>,
// which global.css stops every animation for).

const MOTION_KEY = "ev-maps:animations";
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

const systemReducesMotion = () => window.matchMedia(REDUCED_MOTION).matches;

// The user's own choice, ignoring the system's.
const animationsWanted = () => {
  try {
    return localStorage.getItem(MOTION_KEY) !== "off";
  } catch {
    return true;
  }
};

const animationsOn = () => animationsWanted() && !systemReducesMotion();

const setAnimationsWanted = (wanted) => {
  try {
    if (wanted) {
      localStorage.removeItem(MOTION_KEY);
    } else {
      localStorage.setItem(MOTION_KEY, "off");
    }
  } catch {
    // Storage can be unavailable; the choice lasts until the page is left.
  }
  if (wanted) {
    delete document.documentElement.dataset.animations;
  } else {
    document.documentElement.dataset.animations = "off";
  }
};

// Calls `listener` when the system's reduced motion preference changes.
const onSystemMotionChange = (listener) =>
  window.matchMedia(REDUCED_MOTION).addEventListener("change", listener);

// Runs a DOM update as a view transition where supported and animations are
// on; resolves once it's done.
const withViewTransition = (update) => {
  if (!document.startViewTransition || !animationsOn()) {
    update();
    return Promise.resolve();
  }
  return document.startViewTransition(update).finished.catch(() => {});
};

// A full-screen dialog rises in and sinks out (global.css's dialog-motion),
// also when Escape closes it.
const openDialog = (dialog) => withViewTransition(() => dialog.showModal());

const closeDialog = (dialog) =>
  dialog.open ? withViewTransition(() => dialog.close()) : Promise.resolve();

const animateEscape = (dialog) =>
  dialog.addEventListener("cancel", (event) => {
    if (animationsOn() && document.startViewTransition) {
      event.preventDefault();
      closeDialog(dialog);
    }
  });

export {
  animateEscape,
  animationsOn,
  animationsWanted,
  closeDialog,
  onSystemMotionChange,
  openDialog,
  setAnimationsWanted,
  systemReducesMotion,
  withViewTransition,
};
