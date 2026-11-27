// German: the admin area's page of chargers reported unavailable (#371). See
// ../index.js for how the sections are put together and which pages get which.

const adminUnavailability = {
  page: {
    adminUnavailability: "Nicht verfügbare Ladestationen",
    adminConfirmUnavailable: "Als nicht verfügbar markieren",
    adminDismissUnavailable: "Verwerfen",
  },
  messages: {
    adminUnavailabilityNotLoaded:
      "Die Meldungen über nicht verfügbare Ladestationen konnten nicht geladen werden. Versuche es erneut.",
    adminNoUnavailability: "Keine Ladestationen als nicht verfügbar gemeldet.",
    adminUnavailabilityCount: {
      one: "{count} Ladestation als nicht verfügbar gemeldet",
      other: "{count} Ladestationen als nicht verfügbar gemeldet",
    },
    adminUnavailabilityReporters: { one: "{count} Person", other: "{count} Personen" },
    adminUnavailabilityPhotos: { one: "{count} Foto", other: "{count} Fotos" },
    adminCurrentStatus: "Aktuell: {status}",
  },
};

export { adminUnavailability };
