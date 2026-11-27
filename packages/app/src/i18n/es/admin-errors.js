// Spanish: the admin area's errors page. See ../index.js for how
// the sections are put together and which pages get which.

const adminErrors = {
  page: {
    adminErrorColumn: "Error",
    adminSourceColumn: "Dónde",
    adminBrowserColumn: "Navegador",
    adminOsColumn: "Sistema",
    adminErrorFilters: "Filtrar los errores",
    adminFilterAll: "Todos",
    adminFilterSearch: "Buscar",
    adminFilterApply: "Aplicar",
    adminFilterClear: "Borrar filtros",
    adminCountColumn: "Veces",
    adminUsersColumn: "Usuarios",
    adminLastSeenColumn: "Última vez",
    adminFirstSeenColumn: "Primera vez",
    adminPages: "Páginas",
    adminPreviousPage: "Anterior",
    adminNextPage: "Siguiente",
    adminAllErrors: "Todos los errores",
    adminTimeLabel: "Hora",
    adminUrlLabel: "URL",
    adminContextLabel: "Tarea",
    adminBrowserLabel: "Navegador",
    adminUserLabel: "Usuario",
    adminCountryLabel: "País",
    adminStackTrace: "Traza de la pila",
    adminErrorsNotLoaded: "No se han podido cargar los errores. Inténtalo de nuevo.",
    adminNoErrors: "No hay errores en los últimos 30 días.",
    adminNone: "–",
    adminErrorGroups: {
      one: "{count} tipo de error en los últimos 30 días",
      other: "{count} tipos de errores en los últimos 30 días",
    },
    adminOccurrences: {
      one: "Ocurrió {count} vez en los últimos 30 días",
      other: "Ocurrió {count} veces en los últimos 30 días",
    },
    // Where an error happened.
    adminErrorSources: {
      worker: "Servidor",
      page: "Navegador",
    },
  },
};

export { adminErrors };
