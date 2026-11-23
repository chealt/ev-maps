// Whether a request is real users' traffic, for the admin area's
// performance numbers: production's own addresses (PRODUCTION_HOSTS in
// wrangler.toml), not the pull requests' previews, which share its
// databases. Without the setting (local development), every request is.

const isRealTraffic = (request, env) => {
  const hosts = env.PRODUCTION_HOSTS?.split(",")
    .map((host) => host.trim())
    .filter(Boolean);
  return !hosts?.length || hosts.includes(new URL(request.url).hostname);
};

export { isRealTraffic };
