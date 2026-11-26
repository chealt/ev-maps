// A photo the user picked, ready to send: scaled down to fit MAX_SIDE and
// re-encoded as a JPEG data URL, so a phone camera's photo fits the API's
// limit (packages/worker/src/charger-reports.js) and loses its EXIF data
// (where and when it was taken: the device's location is sent apart).

const MAX_SIDE = 1600;
const QUALITY = 0.82;

const scaledPhoto = async (file) => {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  // JPEG has no transparency: white behind a transparent PNG.
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", QUALITY);
};

export { scaledPhoto };
