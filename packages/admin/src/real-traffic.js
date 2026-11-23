// Whether a request is real users' traffic, for the admin area's
// performance numbers: the production hosts (the PRODUCTION_HOSTS
// setting), not previews, which share the databases. Without the setting
// (local development), every request is.

const isRealTraffic = (request, env) => {
  const hosts = env.PRODUCTION_HOSTS?.split(",")
    .map((host) => host.trim())
    .filter(Boolean);
  return !hosts?.length || hosts.includes(new URL(request.url).hostname);
};

export { isRealTraffic };
