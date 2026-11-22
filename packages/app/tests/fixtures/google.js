import { readFile } from "node:fs/promises";

const fixture = (name) => readFile(new URL(`./${name}`, import.meta.url));

const fakeMapsScript = await fixture("fake-google-maps.js");

const fakeGoogleMaps = (page) =>
  page.route("https://maps.googleapis.com/maps/api/js?**", (route) =>
    route.fulfill({ contentType: "text/javascript", body: fakeMapsScript })
  );

export { fakeGoogleMaps };
