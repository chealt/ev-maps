// Portuguese: the admin area's errors page. See ../index.js for how
// the sections are put together and which pages get which.

const adminErrors = {
  page: {
    adminErrorColumn: "Erro",
    adminSourceColumn: "Onde",
    adminBrowserColumn: "Navegador",
    adminOsColumn: "Sistema",
    adminErrorFilters: "Filtrar os erros",
    adminFilterAll: "Todos",
    adminFilterSearch: "Pesquisar",
    adminFilterApply: "Aplicar",
    adminFilterClear: "Limpar filtros",
    adminCountColumn: "Vezes",
    adminUsersColumn: "Utilizadores",
    adminLastSeenColumn: "Última ocorrência",
    adminFirstSeenColumn: "Primeira ocorrência",
    adminPages: "Páginas",
    adminPreviousPage: "Anterior",
    adminNextPage: "Seguinte",
    adminAllErrors: "Todos os erros",
    adminTimeLabel: "Hora",
    adminUrlLabel: "URL",
    adminContextLabel: "Tarefa",
    adminBrowserLabel: "Navegador",
    adminUserLabel: "Utilizador",
    adminCountryLabel: "País",
    adminStackTrace: "Rastreio da pilha",
    adminErrorsNotLoaded: "Não foi possível carregar os erros. Tente novamente.",
    adminNoErrors: "Sem erros nos últimos 30 dias.",
    adminNone: "–",
    adminErrorGroups: {
      one: "{count} tipo de erro nos últimos 30 dias",
      other: "{count} tipos de erros nos últimos 30 dias",
    },
    adminOccurrences: {
      one: "Ocorreu {count} vez nos últimos 30 dias",
      other: "Ocorreu {count} vezes nos últimos 30 dias",
    },
    // Where an error happened.
    adminErrorSources: {
      worker: "Servidor",
      page: "Navegador",
    },
  },
};

export { adminErrors };
