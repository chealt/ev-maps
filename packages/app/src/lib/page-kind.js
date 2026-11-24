// The kind of page, by its path: /en/ (home), /en/hu/ (country), /en/privacy/
// (legal); null for the admin area.
const pageKind = (pathname) => {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[1] === "admin" || parts[1] === "suggestions") {
    return null;
  }
  if (parts.length <= 1) {
    return "home";
  }
  return ["privacy", "terms"].includes(parts[1]) ? "legal" : "country";
};

export { pageKind };
