// Spanish: the admin area's frame: navigation, overview. See ../index.js for how
// the sections are put together and which pages get which.

const admin = {
  page: {
    adminOverview: "Resumen",
    adminGroupCommunity: "Comunidad",
    adminGroupInsights: "Análisis",
    adminGroupEngineering: "Ingeniería",
    adminCollapseNav: "Contraer la navegación",
    adminSignOut: "Cerrar sesión",
    adminFilterRows: "Filtrar las filas",
    adminNoMatchingRows: "Ninguna fila coincide.",
    adminErrors: "Errores",
    adminUsage: "Uso",
    adminSponsors: "Patrocinadores",
  },
  messages: {
    adminSignedInAs: "Sesión iniciada como {email}",
    adminSignedOut: "Inicia sesión con una cuenta de administrador para ver esta página.",
    // Shared by the admin pages with pages.
    adminPageOf: "Página {page} de {pages}",
    // A bar of a chart (components/bar-chart).
    adminDayCount: "{day}: {count}",
  },
};

export { admin };
