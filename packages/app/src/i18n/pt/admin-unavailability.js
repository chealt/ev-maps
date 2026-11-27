// Portuguese: the admin area's page of chargers reported unavailable (#371). See
// ../index.js for how the sections are put together and which pages get which.

const adminUnavailability = {
  page: {
    adminUnavailability: "Carregadores indisponíveis",
    adminConfirmUnavailable: "Marcar como indisponível",
    adminDismissUnavailable: "Descartar",
  },
  messages: {
    adminUnavailabilityNotLoaded:
      "Não foi possível carregar as comunicações de indisponibilidade. Tente novamente.",
    adminNoUnavailability: "Nenhum carregador comunicado como indisponível.",
    adminUnavailabilityCount: {
      one: "{count} carregador comunicado como indisponível",
      other: "{count} carregadores comunicados como indisponíveis",
    },
    adminUnavailabilityReporters: { one: "{count} pessoa", other: "{count} pessoas" },
    adminUnavailabilityPhotos: { one: "{count} fotografia", other: "{count} fotografias" },
    adminCurrentStatus: "Agora: {status}",
  },
};

export { adminUnavailability };
