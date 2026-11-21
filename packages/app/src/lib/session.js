// Whether someone is signed in, as <ev-user-menu> finds out from the Worker,
// for the parts of the page that need it (live availability, routes).
// Until the session has loaded, nobody is.

const listeners = new Set();
let signedIn = false;

const isSignedIn = () => signedIn;

const setSignedIn = (value) => {
  if (signedIn !== value) {
    signedIn = value;
    for (const listener of listeners) {
      listener(value);
    }
  }
};

// Calls `listener(signedIn)` whenever it changes.
const onSessionChange = (listener) => {
  listeners.add(listener);
};

// Opens the account menu, with its sign-in options.
const requestSignIn = () => document.getElementById("account-menu")?.showPopover();

export { isSignedIn, onSessionChange, requestSignIn, setSignedIn };
