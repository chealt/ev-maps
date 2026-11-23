# Motion

The page animates by default: the full-screen dialogs (filters, route
planner, shortcuts) rise in and sink out, also when Escape closes them, the
charger details slide in and, when closed, out, and the charger list and the
favorites morph from the button that opened them. Dialogs and the details
move with view transitions (`src/lib/motion.js`, `global.css`), and the rest
with CSS animations and transitions built on the `--transition-*` tokens.

The account menu's "Animations" setting turns all of it off: it's saved in
`localStorage` (`ev-maps:animations`), and an inline script in `Layout.astro`
applies it before the first paint as `data-animations="off"` on `<html>`,
which makes the motion tokens take no time and stops view transitions.

The system's reduced motion setting overrides the user's: while it's on,
nothing animates, and the setting shows unticked and disabled, with a note
saying why. Once the system stops asking, the user's own choice is back.

The end-to-end tests run with reduced motion (`playwright.config.js`), so
a test can act as soon as something shows; `tests/motion.spec.js` turns
motion on to check the animated path.
