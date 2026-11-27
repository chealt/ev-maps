// Spanish: the admin area's page of chargers reported unavailable (#371). See
// ../index.js for how the sections are put together and which pages get which.

const adminUnavailability = {
  page: {
    adminUnavailability: "Cargadores no disponibles",
    adminConfirmUnavailable: "Marcar como no disponible",
    adminDismissUnavailable: "Descartar",
  },
  messages: {
    adminUnavailabilityNotLoaded:
      "No se han podido cargar los avisos de no disponibilidad. Inténtalo de nuevo.",
    adminNoUnavailability: "No hay cargadores notificados como no disponibles.",
    adminUnavailabilityCount: {
      one: "{count} cargador notificado como no disponible",
      other: "{count} cargadores notificados como no disponibles",
    },
    adminUnavailabilityReporters: { one: "{count} persona", other: "{count} personas" },
    adminUnavailabilityPhotos: { one: "{count} foto", other: "{count} fotos" },
    adminCurrentStatus: "Ahora: {status}",
  },
};

export { adminUnavailability };
