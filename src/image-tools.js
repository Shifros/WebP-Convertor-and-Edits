export const MAX_FILES = 20;
export const MAX_BYTES = 50 * 1024 * 1024;
export const MAX_SIDE = 16384;
export const MAX_PIXELS = 64000000;
export const FORMATS = {
  webp: "image/webp",
  jpeg: "image/jpeg",
  png: "image/png",
};
export const extension = (format) => (format === "jpeg" ? "jpg" : format);
export const formatBytes = (bytes) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 ** 2
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / 1024 ** 2).toFixed(1)} MB`;

export const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(
        new Error(
          "This image could not be opened. Try a JPG, PNG, WebP, GIF, SVG or BMP file.",
        ),
      );
    image.src = src;
  });

/** Settings that apply to one image: its own overrides, then the batch. */
export const effective = (item, settings) => ({
  ...settings,
  format: item.format || settings.format,
  quality: item.quality ?? settings.quality,
});

/** Size of the image after rotation, before any crop. */
export const transformedSize = (item) =>
  item.rotation % 180 !== 0
    ? { width: item.height, height: item.width }
    : { width: item.width, height: item.height };

/** The crop area in the rotated image, or the whole image. */
export const cropArea = (item) => {
  const full = transformedSize(item);
  return item.crop || { x: 0, y: 0, ...full };
};

export function getOutputDimensions(item, batch) {
  const settings = effective(item, batch);
  if (item.out) return { width: item.out.width, height: item.out.height };
  const { width, height } = cropArea(item);
  if (!settings.resize || (!settings.width && !settings.height))
    return { width, height };
  const maxWidth = Number(settings.width) || Infinity;
  const maxHeight = Number(settings.height) || Infinity;
  if (settings.locked) {
    const ratio = Math.min(
      maxWidth / width,
      maxHeight / height,
      settings.upscale ? Infinity : 1,
    );
    return {
      width: Math.max(1, Math.round(width * ratio)),
      height: Math.max(1, Math.round(height * ratio)),
    };
  }
  const limit = (value, own) =>
    Math.max(
      1,
      Math.round(
        Math.min(Number(value) || own, settings.upscale ? Infinity : own),
      ),
    );
  return {
    width: limit(settings.width, width),
    height: limit(settings.height, height),
  };
}

/** Draw the whole image rotated and flipped onto a canvas. */
function drawTransformed(image, item) {
  const { width, height } = transformedSize(item);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.translate(width / 2, height / 2);
  ctx.rotate((item.rotation * Math.PI) / 180);
  ctx.scale(item.flipped ? -1 : 1, 1);
  ctx.drawImage(image, -item.width / 2, -item.height / 2, item.width, item.height);
  return canvas;
}

const toBlob = (canvas, mime, quality) =>
  new Promise((resolve, reject) =>
    canvas.toBlob(
      (value) =>
        value
          ? resolve(value)
          : reject(
              new Error("Could not export this image. Try smaller dimensions."),
            ),
      mime,
      quality,
    ),
  );

/** A rotated and flipped copy of the image, used as the crop editor's stage. */
export async function makeStage(item) {
  const image = await loadImage(item.url);
  const blob = await toBlob(drawTransformed(image, item), "image/png");
  return URL.createObjectURL(blob);
}

/** A small preview that shows the image the way it will be exported. */
export async function makeThumb(item) {
  const image = await loadImage(item.url);
  const crop = cropArea(item);
  const source =
    item.rotation || item.flipped ? drawTransformed(image, item) : image;
  const scale = Math.min(1, 640 / Math.max(crop.width, crop.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(crop.width * scale));
  canvas.height = Math.max(1, Math.round(crop.height * scale));
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    source,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return URL.createObjectURL(await toBlob(canvas, "image/webp", 0.82));
}

export async function exportImage(item, batch) {
  const settings = effective(item, batch);
  const { width, height } = getOutputDimensions(item, batch);
  if (width > MAX_SIDE || height > MAX_SIDE || width * height > MAX_PIXELS)
    throw new Error(
      "Choose smaller dimensions. The output limit is 64 megapixels and 16,384 pixels per side.",
    );
  const image = await loadImage(item.url);
  const crop = cropArea(item);
  const source =
    item.rotation || item.flipped ? drawTransformed(image, item) : image;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (settings.format === "jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    source,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    width,
    height,
  );
  const mime = FORMATS[settings.format];
  const blob = await toBlob(canvas, mime, settings.quality / 100);
  if (blob.type !== mime)
    throw new Error(
      `${settings.format.toUpperCase()} export is not supported in this browser. Choose PNG or use a recent browser.`,
    );
  return {
    blob,
    width,
    height,
    format: settings.format,
    quality: settings.quality,
    filename: `${item.name.replace(/\.[^/.]+$/, "")}${settings.suffix}.${extension(settings.format)}`,
    url: URL.createObjectURL(blob),
  };
}

export function uniqueFilename(name, used) {
  const dot = name.lastIndexOf(".");
  const stem = dot >= 0 ? name.slice(0, dot) : name;
  const ext = dot >= 0 ? name.slice(dot) : "";
  let candidate = name;
  let count = 2;
  while (used.has(candidate.toLowerCase()))
    candidate = `${stem}-${count++}${ext}`;
  used.add(candidate.toLowerCase());
  return candidate;
}

export function download(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
