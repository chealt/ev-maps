// Magyar: the account menu: sign-in, theme, language, favorites. See ../index.js for how
// the sections are put together and which pages get which.

const account = {
  page: {
    loadingAccount: "Fiók betöltése",
    signInWith: "Bejelentkezés {provider}-fiókkal",
    closeFavorites: "Kedvencek bezárása",
    noFavorites:
      "Még nincs kedvenced. Nyiss meg egy töltőt, és nyomd meg a szívet, hogy ide mentsd.",
    nearestToMapCenter: "A térkép közepéhez legközelebbiek elöl",
    signInWithPasskey: "Bejelentkezés jelkulccsal",
    orWithEmail: "vagy az e-mail-címeddel",
    emailAddress: "E-mail-cím",
    emailMeALink: "Küldj bejelentkezési linket",
    emailLinkHint: "Új vagy itt? A link megnyitásakor létrejön a fiókod.",
    addPasskey: "Jelkulcs hozzáadása",
    addPasskeyHint:
      "Legközelebb az ujjlenyomatoddal, arcoddal vagy képernyőzárral jelentkezhetsz be.",
    account: "Fiók",
    signedInAs: "Bejelentkezve mint",
    signOut: "Kijelentkezés",
    theme: "Téma",
    themes: {
      system: "Rendszer",
      light: "Világos",
      dark: "Sötét",
    },
    animations: "Animációk",
    animationsReducedMotion: "Kikapcsolva: a rendszered csökkentett mozgást kér.",
    language: "Nyelv",
    mapsApp: "Térképalkalmazás",
    mapsAppAsk: "Mindig kérdezzen",
  },
  messages: {
    signInFailed: "A bejelentkezés nem sikerült. Próbáld újra.",
    removeFavorite: "{name} eltávolítása a kedvencek közül",
    signInLinkSent: "Bejelentkezési linket küldtünk a(z) {email} címre. 15 percen belül nyisd meg.",
    tooManySignInEmails: "Túl sok bejelentkezési e-mail. Próbáld újra egy perc múlva.",
    passkeySignInFailed:
      "A jelkulcsos bejelentkezés nem sikerült. Próbáld újra, vagy használd az e-mail-címedet.",
    passkeyAdded: "Jelkulcs hozzáadva. Legközelebb jelentkezz be vele.",
    passkeyNotAdded: "Nem sikerült hozzáadni a jelkulcsot. Próbáld újra.",
    accountOf: "Fiók: {name}",
  },
  values: {
    mapsApps: {
      google: "Google Térkép",
      osm: "OpenStreetMap",
      apple: "Apple Térképek",
    },
  },
};

export { account };
