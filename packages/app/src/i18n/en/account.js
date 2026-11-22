// English: the account menu: sign-in, theme, language, favorites. See ../index.js for how
// the sections are put together and which pages get which.

const account = {
  page: {
    loadingAccount: "Loading your account",
    signInWith: "Sign in with {provider}",
    closeFavorites: "Close favorites",
    noFavorites: "No favorites yet. Open a charger and press the heart to save it here.",
    nearestToMapCenter: "Nearest to the map's center first",
    signInWithPasskey: "Sign in with a passkey",
    orWithEmail: "or with your email",
    emailAddress: "Email address",
    emailMeALink: "Email me a sign-in link",
    emailLinkHint: "New here? The link creates your account once you open it.",
    addPasskey: "Add a passkey",
    addPasskeyHint: "Next time, sign in with your fingerprint, face or screen lock.",
    account: "Account",
    signedInAs: "Signed in as",
    signOut: "Sign out",
    theme: "Theme",
    themes: {
      system: "System",
      light: "Light",
      dark: "Dark",
    },
    language: "Language",
  },
  messages: {
    signInFailed: "Sign-in failed. Please try again.",
    removeFavorite: "Remove {name} from favorites",
    signInLinkSent: "We've sent a sign-in link to {email}. Open it within 15 minutes.",
    tooManySignInEmails: "Too many sign-in emails. Try again in a minute.",
    passkeySignInFailed: "Signing in with a passkey didn't work. Try again, or use your email.",
    passkeyAdded: "Passkey added. Next time, sign in with it.",
    passkeyNotAdded: "The passkey couldn't be added. Try again.",
    accountOf: "Account: {name}",
  },
};

export { account };
