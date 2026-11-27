// Norsk bokmål: the admin area's page of chargers reported unavailable (#371). See
// ../index.js for how the sections are put together and which pages get which.

const adminUnavailability = {
  page: {
    adminUnavailability: "Utilgjengelige ladestasjoner",
    adminConfirmUnavailable: "Merk som utilgjengelig",
    adminDismissUnavailable: "Avvis",
  },
  messages: {
    adminUnavailabilityNotLoaded: "Rapportene om utilgjengelighet kunne ikke lastes. Prøv igjen.",
    adminNoUnavailability: "Ingen ladestasjoner er rapportert utilgjengelige.",
    adminUnavailabilityCount: {
      one: "{count} ladestasjon rapportert utilgjengelig",
      other: "{count} ladestasjoner rapportert utilgjengelige",
    },
    adminUnavailabilityReporters: { one: "{count} person", other: "{count} personer" },
    adminUnavailabilityPhotos: { one: "{count} bilde", other: "{count} bilder" },
    adminCurrentStatus: "Nå: {status}",
  },
};

export { adminUnavailability };
