// The fake Google map, run in Node with a little DOM: the part the e2e
// screenshots depend on, markers placed where the map's own view puts them
// (the full fake runs in the tests' browser; see fake-google-maps.js).
import { describe, expect, test } from "bun:test";

class FakeElement {
  style = {};
  constructor(tag) {
    this.tag = tag;
  }
  append() {}
  prepend() {}
  remove() {}
  setAttribute() {}
  replaceChildren() {}
}

const fake = async () => {
  const source = (await Bun.file(new URL("./fake-google-maps.js", import.meta.url)).text()).replace(
    "window[callbackName]();",
    ""
  );
  const sandboxWindow = { addEventListener: () => {} };
  const document = {
    currentScript: { src: "https://maps.googleapis.com/maps/api/js?callback=cb" },
    createElementNS: () => new FakeElement("svg-part"),
    createElement: (tag) => new FakeElement(tag),
  };
  new Function("window", "document", source)(sandboxWindow, document);
  const { Map } = await sandboxWindow.google.maps.importLibrary("maps");
  const { AdvancedMarkerElement } = await sandboxWindow.google.maps.importLibrary("marker");
  return { Map, AdvancedMarkerElement };
};

const mapElement = () => {
  const element = new FakeElement("div");
  element.clientWidth = 800;
  element.clientHeight = 600;
  return element;
};

describe("the fake map's markers", () => {
  test("sit where the map's view puts their position", async () => {
    const { Map, AdvancedMarkerElement } = await fake();
    const map = new Map(mapElement(), { center: { lat: 40.73, lng: -73.97 }, zoom: 12 });
    const pin = new AdvancedMarkerElement({ map, position: { lat: 40.71, lng: -74.0 } });
    // Somewhere in the map's element, in pixels.
    expect(pin.element.style.left).toMatch(/^-?\d+(\.\d+)?px$/);
    expect(Number.parseFloat(pin.element.style.top)).toBeGreaterThan(0);
  });

  test("follow the view when it moves", async () => {
    const { Map, AdvancedMarkerElement } = await fake();
    const map = new Map(mapElement(), { center: { lat: 40.73, lng: -73.97 }, zoom: 12 });
    const pin = new AdvancedMarkerElement({ map, position: { lat: 40.71, lng: -74.0 } });
    const before = { ...pin.element.style };
    map.setZoom(10);
    expect(pin.element.style).not.toEqual(before);
  });

  test("the map keeps its markers, and lets them go", async () => {
    const { Map, AdvancedMarkerElement } = await fake();
    const map = new Map(mapElement(), { center: { lat: 40.73, lng: -73.97 }, zoom: 12 });
    const pin = new AdvancedMarkerElement({ map, position: { lat: 40.71, lng: -74.0 } });
    expect(map.markers.size).toBe(1);
    pin.map = null;
    expect(map.markers.size).toBe(0);
  });
});
