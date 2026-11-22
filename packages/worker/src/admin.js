// The admin area, for Chealt's own people: users whose verified email is at
// ADMIN_EMAIL_DOMAIN (wrangler.toml). Checked here, on the server, for both
// the admin pages (/{lang}/admin/) and the admin API (/api/admin/*).

const ADMIN_PAGE_PATH = /^\/(en|pl|hu)\/admin(\/.*)?$/;
const ADMIN_API_PREFIX = "/api/admin/";

// `user` is { id, email } of a signed-in user with a verified email, or null.
const isAdmin = (env, user) => {
  const domain = env.ADMIN_EMAIL_DOMAIN?.toLowerCase();
  return Boolean(domain && user?.email?.toLowerCase().endsWith(`@${domain}`));
};

const isAdminPage = (pathname) => ADMIN_PAGE_PATH.test(pathname);

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

// An admin page for admins; for everyone else, as if there were none.
const adminPageResponse = async (request, env, user) => {
  if (!isAdmin(env, user)) {
    return new Response("Not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }
  const page = await env.ASSETS.fetch(request);
  const headers = new Headers(page.headers);
  // Per user: no shared cache may keep it.
  headers.set("cache-control", "private, no-store");
  headers.set("x-robots-tag", "noindex, nofollow");
  return new Response(page.body, { status: page.status, headers });
};

// GET /api/admin/me: who the admin is (the guard has checked they are one).
const adminApiResponse = (request, user) => {
  const { pathname } = new URL(request.url);
  if (pathname === `${ADMIN_API_PREFIX}me` && request.method === "GET") {
    return json({ admin: true, email: user.email });
  }
  return json({ error: "Not found" }, 404);
};

export { ADMIN_API_PREFIX, adminApiResponse, adminPageResponse, isAdmin, isAdminPage };
