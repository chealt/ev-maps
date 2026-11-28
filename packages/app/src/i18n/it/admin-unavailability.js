// Italian: the admin area's page of chargers reported unavailable (#371). See
// ../index.js for how the sections are put together and which pages get which.

const adminUnavailability = {
  page: {
    adminUnavailability: "Colonnine non disponibili",
    adminConfirmUnavailable: "Segna come non disponibile",
    adminDismissUnavailable: "Ignora",
  },
  messages: {
    adminUnavailabilityNotLoaded:
      "Impossibile caricare le segnalazioni di non disponibilità. Riprovi.",
    adminNoUnavailability: "Nessuna colonnina segnalata come non disponibile.",
    adminUnavailabilityCount: {
      one: "{count} colonnina segnalata come non disponibile",
      other: "{count} colonnine segnalate come non disponibili",
    },
    adminUnavailabilityReporters: { one: "{count} persona", other: "{count} persone" },
    adminUnavailabilityPhotos: { one: "{count} foto", other: "{count} foto" },
    adminCurrentStatus: "Ora: {status}",
  },
};

export { adminUnavailability };
