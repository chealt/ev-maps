// The data of a page Astro renders on the server: the Worker reads it and
// passes it as the request context's props, { data } or { failed: true }
// (packages/admin/src/admin.js). In development, without the Worker in front:
// - the tests set it with the x-ev-maps-page-data header (JSON)
// - otherwise it's read from the Worker's API (`bun run dev`, port 8787), as
//   the signed-in user
const DEV_API = "http://localhost:8787";
const TEST_DATA_HEADER = "x-ev-maps-page-data";

const devPageData = async (request, apiPath) => {
  const testData = request.headers.get(TEST_DATA_HEADER);
  if (testData) {
    return JSON.parse(testData);
  }
  try {
    const response = await fetch(`${DEV_API}${apiPath}`, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
    });
    if (!response.ok) {
      throw new Error(`${apiPath} failed: ${response.status}`);
    }
    return { data: await response.json() };
  } catch (error) {
    console.error("Could not read the page's data from the Worker:", error);
    return { failed: true };
  }
};

// `apiPath`: where the same data is in the Worker's API, for development.
const pageData = (astro, apiPath) => {
  const props = astro.locals.cfContext?.props ?? {};
  if ("data" in props || props.failed) {
    return props;
  }
  return import.meta.env.DEV ? devPageData(astro.request, apiPath) : { failed: true };
};

export { TEST_DATA_HEADER, pageData };
