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
    distanceUnit: "Jednostka odległości",
    distanceUnits: {
      auto: "Automatycznie",
      metric: "Kilometry",
      imperial: "Mile",
    },
    suggestCharger: "Zgłoś stację",
    signInToSuggestCharger: "Zaloguj się, aby zgłosić nową stację ładowania.",
    closeSuggestCharger: "Zamknij zgłaszanie stacji",
    suggestChargerHint:
      "Podaj dane lokalizacji, co najmniej jedną ładowarkę z typem złącza i mocą oraz zdjęcie potwierdzające.",
    suggestChargerName: "Nazwa lokalizacji",
    suggestChargerAddress: "Adres",
    suggestChargerOperator: "Operator",
    suggestChargerLat: "Szerokość geograficzna",
    suggestChargerLng: "Długość geograficzna",
    suggestChargerUnits: "Ładowarki w tej lokalizacji",
    addChargerUnit: "Dodaj ładowarkę",
    removeChargerUnit: "Usuń ładowarkę",
    suggestChargerPowerKw: "Moc (kW)",
    suggestChargerQuantity: "Liczba punktów",
    suggestChargerPhoto: "Zdjęcie potwierdzające",
    suggestChargerPhotoHint: "Dodaj zdjęcie pokazujące stację ładowania w tym miejscu.",
    submitChargerSuggestion: "Wyślij zgłoszenie",
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
    chargerUnitNumber: "Ładowarka {number}",
    suggestChargerSubmitted: "Dziękujemy! Twoje zgłoszenie stacji zostało wysłane do weryfikacji.",
    suggestChargerInvalid:
      "Podaj nazwę, współrzędne, co najmniej jedną ładowarkę oraz zdjęcie potwierdzające.",
    suggestChargerFailed: "Nie udało się wysłać zgłoszenia. Spróbuj ponownie.",
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
