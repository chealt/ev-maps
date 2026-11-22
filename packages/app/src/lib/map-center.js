// Where the map is centered now, for parts of the page outside the map (e.g.
// the favorites list's distances); null until the map has loaded.

let center = null;

const getMapCenter = () => center;

const setMapCenter = (value) => {
  center = value;
};

export { getMapCenter, setMapCenter };
