// Polski: the admin area's errors page. See ../index.js for how
// the sections are put together and which pages get which.

const adminErrors = {
  page: {
    adminErrorColumn: "Błąd",
    adminSourceColumn: "Gdzie",
    adminCountColumn: "Razy",
    adminUsersColumn: "Użytkownicy",
    adminLastSeenColumn: "Ostatnio",
    adminFirstSeenColumn: "Pierwszy raz",
    adminPages: "Strony",
    adminPreviousPage: "Poprzednia",
    adminNextPage: "Następna",
    adminAllErrors: "Wszystkie błędy",
    adminTimeLabel: "Czas",
    adminUrlLabel: "Adres URL",
    adminContextLabel: "Zadanie",
    adminBrowserLabel: "Przeglądarka",
    adminUserLabel: "Użytkownik",
    adminCountryLabel: "Kraj",
    adminStackTrace: "Ślad stosu",
  },
  messages: {
    adminErrorsNotLoaded: "Nie udało się wczytać błędów. Spróbuj ponownie.",
    adminNoErrors: "Brak błędów w ostatnich 30 dniach.",
    adminPageOf: "Strona {page} z {pages}",
    adminNone: "–",
    adminErrorGroups: {
      one: "{count} rodzaj błędu w ostatnich 30 dniach",
      few: "{count} rodzaje błędów w ostatnich 30 dniach",
      many: "{count} rodzajów błędów w ostatnich 30 dniach",
      other: "Rodzaje błędów w ostatnich 30 dniach: {count}",
    },
    adminOccurrences: {
      one: "Wystąpił {count} raz w ostatnich 30 dniach",
      few: "Wystąpił {count} razy w ostatnich 30 dniach",
      many: "Wystąpił {count} razy w ostatnich 30 dniach",
      other: "Wystąpienia w ostatnich 30 dniach: {count}",
    },
  },
  values: {
    errorSources: {
      worker: "Serwer",
      page: "Przeglądarka",
    },
  },
};

export { adminErrors };
