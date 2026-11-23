// Polski: the account menu: sign-in, theme, language, favorites. See ../index.js for how
// the sections are put together and which pages get which.

const account = {
  page: {
    loadingAccount: "Wczytywanie konta",
    signInWith: "Zaloguj się przez {provider}",
    closeFavorites: "Zamknij ulubione",
    noFavorites: "Nie masz jeszcze ulubionych. Otwórz stację i naciśnij serce, aby ją tu zapisać.",
    nearestToMapCenter: "Najpierw najbliższe środka mapy",
    signInWithPasskey: "Zaloguj się kluczem dostępu",
    orWithEmail: "lub adresem e-mail",
    emailAddress: "Adres e-mail",
    emailMeALink: "Wyślij mi link do logowania",
    emailLinkHint: "Jesteś tu pierwszy raz? Link utworzy konto, gdy go otworzysz.",
    addPasskey: "Dodaj klucz dostępu",
    addPasskeyHint: "Następnym razem zaloguj się odciskiem palca, twarzą lub blokadą ekranu.",
    account: "Konto",
    signedInAs: "Zalogowano jako",
    signOut: "Wyloguj się",
    theme: "Motyw",
    themes: {
      system: "Systemowy",
      light: "Jasny",
      dark: "Ciemny",
    },
    animations: "Animacje",
    animationsReducedMotion: "Wyłączone: Twój system prosi o ograniczenie ruchu.",
    language: "Język",
    mapsApp: "Aplikacja map",
    mapsAppAsk: "Pytaj za każdym razem",
  },
  messages: {
    signInFailed: "Logowanie nie powiodło się. Spróbuj ponownie.",
    removeFavorite: "Usuń {name} z ulubionych",
    signInLinkSent: "Wysłaliśmy link do logowania na adres {email}. Otwórz go w ciągu 15 minut.",
    tooManySignInEmails: "Zbyt wiele wiadomości z linkiem. Spróbuj ponownie za minutę.",
    passkeySignInFailed:
      "Logowanie kluczem dostępu nie powiodło się. Spróbuj ponownie lub użyj adresu e-mail.",
    passkeyAdded: "Dodano klucz dostępu. Następnym razem zaloguj się nim.",
    passkeyNotAdded: "Nie udało się dodać klucza dostępu. Spróbuj ponownie.",
    accountOf: "Konto: {name}",
  },
  values: {
    mapsApps: {
      google: "Mapy Google",
      osm: "OpenStreetMap",
      apple: "Mapy Apple",
    },
  },
};

export { account };
