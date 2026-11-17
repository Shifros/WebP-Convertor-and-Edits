/*
 * Image Studio automation interface.
 *
 * A small, documented API on `window.ShifrosImageStudio` so that automated
 * agents running in a visitor's browser can convert, resize and crop images
 * in one call, without driving the interface. Everything runs on the device;
 * nothing is uploaded. The same guide is published at /llms.txt.
 */
import {
  MAX_PIXELS,
  MAX_SIDE,
  download,
  exportImage,
  extension,
  loadImage,
  transformedSize,
  uniqueFilename,
} from "./image-tools";

export const API_VERSION = "1.0.0";
const FORMATS = { webp: "webp", jpg: "jpeg", jpeg: "jpeg", png: "png" };
const FITS = ["cover", "contain", "fill"];

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

async function toBlob(input) {
  if (input instanceof Blob) return input;
  if (typeof input === "string") {
    let response;
    try {
      response = await fetch(input);
    } catch {
      throw new Error(
        "Could not fetch the image. The URL must allow cross-origin requests (CORS); otherwise pass a File, Blob or data: URL.",
      );
    }
    if (!response.ok)
      throw new Error(`Could not fetch the image (HTTP ${response.status}).`);
    return response.blob();
  }
  throw new Error("input must be a File, Blob, image URL or data: URL.");
}

const nameFor = (input, blob) => {
  if (blob.name) return blob.name;
  if (typeof input === "string" && !input.startsWith("data:")) {
    const last = input.split("?")[0].split("#")[0].split("/").pop();
    if (last) return decodeURIComponent(last);
  }
  return `image.${(blob.type.split("/")[1] || "png").replace("jpeg", "jpg")}`;
};

function checkSize(name, value) {
  if (value == null) return undefined;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > MAX_SIDE)
    throw new Error(`${name} must be a whole number from 1 to ${MAX_SIDE}.`);
  return number;
}

/**
 * Convert one image.
 * @param input  File | Blob | image URL | data: URL
 * @param options see /llms.txt
 */
export async function convert(input, options = {}) {
  const format = FORMATS[String(options.format || "webp").toLowerCase()];
  if (!format) throw new Error('format must be "webp", "jpg" or "png".');
  const quality = Math.round(Number(options.quality ?? 85));
  if (!(quality >= 1 && quality <= 100))
    throw new Error("quality must be a number from 1 to 100.");
  const width = checkSize("width", options.width);
  const height = checkSize("height", options.height);
  const fit = options.fit || "cover";
  if (!FITS.includes(fit))
    throw new Error('fit must be "cover", "contain" or "fill".');
  const rotation = (((Number(options.rotate) || 0) % 360) + 360) % 360;
  if (rotation % 90) throw new Error("rotate must be 0, 90, 180 or 270.");

  const blob = await toBlob(input);
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    const item = {
      name: options.filename || nameFor(input, blob),
      url,
      width: image.naturalWidth,
      height: image.naturalHeight,
      rotation,
      flipped: !!options.flip,
      crop: null,
      out: null,
      format: null,
      quality: null,
    };
    if (!item.width || !item.height)
      throw new Error("This image could not be decoded.");
    if (item.width * item.height > MAX_PIXELS)
      throw new Error("Image exceeds the 64 megapixel limit.");
    const full = transformedSize(item);
    const settings = {
      format,
      quality,
      resize: false,
      width: "",
      height: "",
      locked: true,
      upscale: !!options.upscale,
      suffix: options.suffix || "",
    };

    if (options.crop) {
      const { x = 0, y = 0, width: cw, height: ch } = options.crop;
      if (
        ![x, y, cw, ch].every(Number.isFinite) ||
        cw < 1 ||
        ch < 1 ||
        x < 0 ||
        y < 0 ||
        x + cw > full.width ||
        y + ch > full.height
      )
        throw new Error(
          `crop must be {x, y, width, height} in pixels inside the ${full.width} × ${full.height} image.`,
        );
      item.crop = {
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(cw),
        height: Math.round(ch),
      };
    }
    const area = item.crop || { x: 0, y: 0, ...full };

    if (width && height && fit === "fill") {
      item.out = { width, height };
    } else if (width && height && fit === "cover") {
      // Centre-crop (inside any given crop) to the target shape, then scale.
      const ratio = width / height;
      const cw = Math.max(1, Math.min(area.width, Math.round(area.height * ratio)));
      const ch = Math.max(1, Math.min(area.height, Math.round(cw / ratio)));
      item.crop = {
        x: area.x + Math.round((area.width - cw) / 2),
        y: area.y + Math.round((area.height - ch) / 2),
        width: cw,
        height: ch,
      };
      item.out = { width, height };
    } else if (width || height) {
      // Fit inside the box and keep proportions.
      Object.assign(settings, {
        resize: true,
        width: width ? String(width) : "",
        height: height ? String(height) : "",
        locked: true,
      });
    }

    const result = await exportImage(item, settings);
    const output = {
      blob: result.blob,
      filename: result.filename,
      format: extension(result.format),
      mimeType: result.blob.type,
      width: result.width,
      height: result.height,
      bytes: result.blob.size,
      originalBytes: blob.size,
      originalWidth: item.width,
      originalHeight: item.height,
      url: result.url,
    };
    if (options.returnDataUrl) output.dataUrl = await blobToDataUrl(result.blob);
    if (options.download !== false) download(result.url, result.filename);
    return output;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Convert several images with the same options. Downloads one ZIP by default. */
export async function convertAll(inputs, options = {}) {
  if (!Array.isArray(inputs) || !inputs.length)
    throw new Error("inputs must be a non-empty array.");
  const results = [];
  for (const input of inputs)
    results.push(await convert(input, { ...options, download: false }));
  if (options.download !== false) {
    if (results.length === 1) download(results[0].url, results[0].filename);
    else {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const used = new Set();
      results.forEach((r) => zip.file(uniqueFilename(r.filename, used), r.blob));
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      download(url, options.zipName || "shifros-images.zip");
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
  }
  return results;
}

const describe = () => ({
  name: "Shifros Image Studio",
  version: API_VERSION,
  runsOn: "browser only; no server, no HTTP API",
  guide: "/llms.txt",
  functions: {
    "convert(input, options)":
      "input: File | Blob | image URL | data: URL. Returns { blob, filename, width, height, bytes, url, dataUrl? }.",
    "convertAll(inputs, options)":
      "Same options for every image. Downloads one ZIP unless download: false.",
  },
  options: {
    format: '"webp" (default) | "jpg" | "png"',
    quality: "1-100, default 85 (ignored for png)",
    width: "pixels",
    height: "pixels",
    fit: '"cover" (default: crop to fill exactly) | "contain" (fit inside, keep proportions) | "fill" (stretch)',
    crop: "{ x, y, width, height } in pixels, applied before resizing",
    rotate: "0 | 90 | 180 | 270 (clockwise)",
    flip: "true to mirror horizontally",
    upscale: "true to allow enlarging with fit: contain",
    suffix: 'text added to the filename, e.g. "-800w"',
    filename: "override the source filename",
    download: "default true: save the file to the user's downloads",
    returnDataUrl: "true to also return a base64 data: URL",
  },
});

const TOOL_SCHEMA = {
  type: "object",
  properties: {
    image_url: {
      type: "string",
      description:
        "Image to convert: an http(s) URL that allows CORS, or a data: URL.",
    },
    format: { type: "string", enum: ["webp", "jpg", "png"], default: "webp" },
    quality: { type: "integer", minimum: 1, maximum: 100, default: 85 },
    width: { type: "integer", minimum: 1, maximum: MAX_SIDE },
    height: { type: "integer", minimum: 1, maximum: MAX_SIDE },
    fit: { type: "string", enum: FITS, default: "cover" },
    rotate: { type: "integer", enum: [0, 90, 180, 270], default: 0 },
    flip: { type: "boolean", default: false },
    download: { type: "boolean", default: true },
    return_data_url: { type: "boolean", default: false },
  },
  required: ["image_url"],
};

/** Install the API on window and offer it as a tool to agent-aware browsers. */
export function installAgentApi() {
  const api = Object.freeze({
    version: API_VERSION,
    convert,
    convertAll,
    describe,
    guide: "/llms.txt",
  });
  window.ShifrosImageStudio = api;

  // Progressive enhancement for browsers that expose page tools to agents
  // (the WebMCP proposal). Silently skipped everywhere else.
  const context = navigator.modelContext;
  if (!context) return;
  const tool = {
    name: "convert_image",
    description:
      "Convert, resize, crop, rotate or flip an image on this device and return the result. Formats: WebP, JPG, PNG.",
    inputSchema: TOOL_SCHEMA,
    async execute(args = {}) {
      const result = await convert(args.image_url, {
        format: args.format,
        quality: args.quality,
        width: args.width,
        height: args.height,
        fit: args.fit,
        rotate: args.rotate,
        flip: args.flip,
        download: args.download,
        returnDataUrl: args.return_data_url,
      });
      const { blob, url, ...summary } = result;
      return { content: [{ type: "text", text: JSON.stringify(summary) }] };
    },
  };
  try {
    if (typeof context.registerTool === "function") context.registerTool(tool);
    else if (typeof context.provideContext === "function")
      context.provideContext({ tools: [tool] });
  } catch {}
}
