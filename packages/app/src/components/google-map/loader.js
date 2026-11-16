const CALLBACK_NAME = "__evMapsGoogleMapsLoaded";
const scriptLoads = new Map();

const loadScript = (src, beforeLoad) => {
  if (!scriptLoads.has(src)) {
    scriptLoads.set(
      src,
      new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.onerror = () => {
          // Forget the failed load, so it can be retried (e.g. back online).
          scriptLoads.delete(src);
          script.remove();
          reject(new Error(`Failed to load ${src}`));
        };
        beforeLoad?.(resolve, script);
        document.head.append(script);
      })
    );
  }
  return scriptLoads.get(src);
};

const loadGoogleMaps = (apiKey) => {
  if (window.google?.maps?.importLibrary) {
    return Promise.resolve(window.google.maps);
  }
  const params = new URLSearchParams({
    key: apiKey,
    v: "weekly",
    loading: "async",
    callback: CALLBACK_NAME,
  });
  return loadScript(`https://maps.googleapis.com/maps/api/js?${params}`, (resolve) => {
    window[CALLBACK_NAME] = () => {
      delete window[CALLBACK_NAME];
      resolve(window.google.maps);
    };
  });
};

const loadGoogleIdentity = () => {
  return loadScript("https://accounts.google.com/gsi/client", (resolve, script) => {
    script.onload = () => resolve(window.google.accounts);
  });
};

export { loadGoogleMaps, loadGoogleIdentity };
