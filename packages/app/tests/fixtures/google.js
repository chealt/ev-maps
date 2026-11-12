import { readFile } from "node:fs/promises";

const fixture = (name) => readFile(new URL(`./${name}`, import.meta.url));

const [fakeMapsScript, fakeIdentityScript] = await Promise.all([
  fixture("fake-google-maps.js"),
  fixture("fake-google-identity.js"),
]);

export function fakeGoogleMaps(page) {
  return page.route("https://maps.googleapis.com/maps/api/js?**", (route) =>
    route.fulfill({ contentType: "text/javascript", body: fakeMapsScript })
  );
}

export function fakeGoogleIdentity(page) {
  return page.route("https://accounts.google.com/gsi/client", (route) =>
    route.fulfill({ contentType: "text/javascript", body: fakeIdentityScript })
  );
}
