import { describe, expect, test } from "bun:test";
import { adminApiResponse, adminPageResponse, isAdmin, isAdminPage } from "./admin.js";

const env = {
  ADMIN_EMAIL_DOMAIN: "chealt.com",
  ASSETS: {
    fetch: async () =>
      new Response("<h1>Admin</h1>", { headers: { "cache-control": "public, max-age=600" } }),
  },
};

describe("isAdmin", () => {
  test("only verified users at the admin domain", () => {
    expect(isAdmin(env, { id: "1", email: "grace@chealt.com" })).toBe(true);
    expect(isAdmin(env, { id: "1", email: "Grace@CHEALT.com" })).toBe(true);
    expect(isAdmin(env, { id: "1", email: "grace@notchealt.com" })).toBe(false);
    expect(isAdmin(env, { id: "1", email: "chealt.com@example.com" })).toBe(false);
    expect(isAdmin(env, null)).toBe(false);
    expect(isAdmin({}, { id: "1", email: "grace@chealt.com" })).toBe(false);
  });
});

describe("isAdminPage", () => {
  test("matches the admin pages in every language", () => {
    expect(isAdminPage("/en/admin/")).toBe(true);
    expect(isAdminPage("/hu/admin")).toBe(true);
    expect(isAdminPage("/pl/admin/errors/")).toBe(true);
    expect(isAdminPage("/en/administration/")).toBe(false);
    expect(isAdminPage("/en/hu/")).toBe(false);
  });
});

describe("adminPageResponse", () => {
  const request = new Request("https://ev.chealt.com/en/admin/");

  test("serves the page to admins, never from a shared cache", async () => {
    const response = await adminPageResponse(request, env, { id: "1", email: "grace@chealt.com" });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<h1>Admin</h1>");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  test("is not found for everyone else", async () => {
    expect((await adminPageResponse(request, env, null)).status).toBe(404);
    const user = { id: "2", email: "ada@example.com" };
    expect((await adminPageResponse(request, env, user)).status).toBe(404);
  });
});

describe("adminApiResponse", () => {
  test("says who the admin is", async () => {
    const response = adminApiResponse(new Request("https://ev.chealt.com/api/admin/me"), {
      id: "1",
      email: "grace@chealt.com",
    });
    expect(await response.json()).toEqual({ admin: true, email: "grace@chealt.com" });
  });
});
