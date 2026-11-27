// Polski: the admin area's page of chargers reported unavailable (#371). See
// ../index.js for how the sections are put together and which pages get which.

const adminUnavailability = {
  page: {
    adminUnavailability: "Niedostępne ładowarki",
    adminConfirmUnavailable: "Oznacz jako niedostępną",
    adminDismissUnavailable: "Odrzuć",
  },
  messages: {
    adminUnavailabilityNotLoaded:
      "Nie udało się wczytać zgłoszeń niedostępności. Spróbuj ponownie.",
    adminNoUnavailability: "Brak ładowarek zgłoszonych jako niedostępne.",
    adminUnavailabilityCount: {
      one: "{count} ładowarka zgłoszona jako niedostępna",
      few: "{count} ładowarki zgłoszone jako niedostępne",
      many: "{count} ładowarek zgłoszonych jako niedostępne",
      other: "{count} ładowarki zgłoszone jako niedostępne",
    },
    adminUnavailabilityReporters: {
      one: "{count} osoba",
      few: "{count} osoby",
      many: "{count} osób",
      other: "{count} osoby",
    },
    adminUnavailabilityPhotos: {
      one: "{count} zdjęcie",
      few: "{count} zdjęcia",
      many: "{count} zdjęć",
      other: "{count} zdjęcia",
    },
    adminCurrentStatus: "Teraz: {status}",
  },
};

export { adminUnavailability };
