import { upload } from "@vercel/blob/client";

const PREFIX = "upload-saree/staging";
const HEIC_DECODER_SRC = "/upload-saree-heic-converter.bundle.js";
const HEIC_MIME_TYPES = new Set(["image/heic", "image/heif"]);
const HEIC_EXTENSIONS = new Set(["heic", "heif"]);
let heicModulePromise = null;

function getUploadFileExtension(file) {
  return String(file?.name || "").split(".").pop().toLowerCase();
}

function isHeicUploadFile(file) {
  if (!file) return false;
  const mimeType = String(file.type || "").trim().toLowerCase();
  return HEIC_MIME_TYPES.has(mimeType) || HEIC_EXTENSIONS.has(getUploadFileExtension(file));
}

function createHeicError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

async function getHeicModule() {
  if (window.JSHHeicTo?.heicTo && window.JSHHeicTo?.isHeic) return window.JSHHeicTo;
  if (!heicModulePromise) {
    heicModulePromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = HEIC_DECODER_SRC;
      script.async = true;
      script.dataset.jshHeicDecoder = "true";
      script.onload = () => {
        if (window.JSHHeicTo?.heicTo && window.JSHHeicTo?.isHeic) {
          resolve(window.JSHHeicTo);
          return;
        }
        reject(new Error("HEIC decoder did not initialize."));
      };
      script.onerror = () => reject(new Error("HEIC decoder could not be loaded."));
      document.head.appendChild(script);
    }).catch((error) => {
      heicModulePromise = null;
      document.querySelector("script[data-jsh-heic-decoder='true']")?.remove();
      throw error;
    });
  }
  return heicModulePromise;
}

async function readHeicDimensions(file) {
  const scanSize = Math.min(file.size, 4 * 1024 * 1024);
  const bytes = new Uint8Array(await file.slice(0, scanSize).arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let largest = null;
  const candidates = [];

  for (let offset = 4; offset + 16 <= bytes.length; offset += 1) {
    if (bytes[offset] !== 0x69 || bytes[offset + 1] !== 0x73 || bytes[offset + 2] !== 0x70 || bytes[offset + 3] !== 0x65) {
      continue;
    }
    const boxSize = view.getUint32(offset - 4, false);
    if (boxSize < 20 || offset - 4 + boxSize > bytes.length) continue;
    const width = view.getUint32(offset + 8, false);
    const height = view.getUint32(offset + 12, false);
    const pixels = width * height;
    if (!width || !height || !Number.isSafeInteger(pixels)) continue;
    if (!candidates.some((candidate) => candidate.width === width && candidate.height === height)) {
      candidates.push({ width, height, pixels });
    }
    if (!largest || pixels > largest.pixels) largest = { width, height, pixels };
  }

  return largest ? { ...largest, candidates } : null;
}

async function readDecodedImageDimensions(file) {
  const bitmap = await createImageBitmap(file);
  try {
    return { width: bitmap.width, height: bitmap.height, pixels: bitmap.width * bitmap.height };
  } finally {
    bitmap.close?.();
  }
}

function isLikelyMemoryError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return error instanceof RangeError || /memory|allocation|array buffer|out of bounds/.test(message);
}

async function convertHeicToLosslessPng(file, { maxPixels, maxBytes, maxSizeMb } = {}) {
  if (!isHeicUploadFile(file)) {
    return { originalFile: file, uploadFile: file, convertedFromHeic: false, dimensions: null };
  }

  const configuredMaxPixels = Number(maxPixels);
  const pixelLimit = Number.isFinite(configuredMaxPixels) && configuredMaxPixels > 0
    ? configuredMaxPixels
    : 100000000;
  const sourceDimensions = await readHeicDimensions(file);
  if (sourceDimensions?.pixels > pixelLimit) {
    throw createHeicError(
      "This HEIC image is too large to decode safely on this device. It was not resized or compressed.",
      "HEIC_PIXEL_LIMIT",
      { sourceDimensions },
    );
  }

  const { heicTo, isHeic } = await getHeicModule();
  if (!(await isHeic(file))) {
    throw createHeicError("This HEIC/HEIF image could not be decoded.", "INVALID_HEIC");
  }

  let converted;
  try {
    converted = await heicTo({ blob: file, type: "image/png" });
  } catch (error) {
    console.error("HEIC conversion failed", {
      name: file.name,
      size: file.size,
      message: error?.message || String(error),
    });
    if (isLikelyMemoryError(error)) {
      throw createHeicError(
        "This HEIC image is too large to decode safely on this device. It was not resized or compressed.",
        "HEIC_MEMORY_LIMIT",
      );
    }
    throw createHeicError(
      "This HEIC image could not be decoded. Please try another HEIC file or upload the original from an Apple device again.",
      "HEIC_DECODE_FAILED",
    );
  }

  const blob = Array.isArray(converted) ? converted[0] : converted;
  if (!(blob instanceof Blob)) {
    throw createHeicError("HEIC conversion did not produce a valid image.", "INVALID_PNG_OUTPUT");
  }

  const baseName = String(file.name || "image").replace(/\.(heic|heif)$/i, "");
  const pngFile = new File([blob], `${baseName}.png`, {
    type: "image/png",
    lastModified: file.lastModified || Date.now(),
  });
  const dimensions = await readDecodedImageDimensions(pngFile);
  if (dimensions.pixels > pixelLimit) {
    throw createHeicError(
      "This HEIC image is too large to decode safely on this device. It was not resized or compressed.",
      "HEIC_PIXEL_LIMIT",
      { sourceDimensions, dimensions },
    );
  }
  const sourceCandidates = sourceDimensions?.candidates?.length ? sourceDimensions.candidates : [sourceDimensions];
  const dimensionsMatch = !sourceDimensions || sourceCandidates.some((candidate) => (
    (dimensions.width === candidate.width && dimensions.height === candidate.height)
    || (dimensions.width === candidate.height && dimensions.height === candidate.width)
  ));
  if (!dimensionsMatch) {
    throw createHeicError(
      "The HEIC image dimensions could not be preserved. The original file has not been modified.",
      "HEIC_DIMENSION_MISMATCH",
      { sourceDimensions, dimensions },
    );
  }

  const configuredMaxBytes = Number(maxBytes);
  if (Number.isFinite(configuredMaxBytes) && configuredMaxBytes > 0 && pngFile.size > configuredMaxBytes) {
    const convertedSizeMb = pngFile.size / (1024 * 1024);
    throw createHeicError(
      `Full-quality PNG exceeds the ${Number(maxSizeMb) || 50} MB upload limit. No compression was applied. Converted PNG size: ${convertedSizeMb.toFixed(1)} MB.`,
      "PNG_TOO_LARGE",
      { convertedSizeBytes: pngFile.size, convertedSizeMb, sourceDimensions, dimensions },
    );
  }

  return { originalFile: file, uploadFile: pngFile, convertedFromHeic: true, sourceDimensions, dimensions };
}

window.uploadSareeHeic = Object.freeze({
  isHeicUploadFile,
  readHeicDimensions,
  convertHeicToLosslessPng,
});

function safeUploadFilename(file, role) {
  const extension = String(file.name || "").split(".").pop().toLowerCase();
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${PREFIX}/${role}/${new Date().toISOString().slice(0, 10)}/${suffix}.${extension}`;
}

window.uploadSareeFileToBlob = async function uploadSareeFileToBlob({ file, role, onProgress, signal }) {
  const contentType = file.type === "image/jpg" ? "image/jpeg" : file.type;
  return upload(safeUploadFilename(file, role), file, {
    access: "private",
    handleUploadUrl: "/api/upload-saree/blob-upload",
    clientPayload: JSON.stringify({
      role,
      originalFilename: file.name,
      declaredSize: file.size,
      mimeType: contentType,
    }),
    contentType,
    multipart: true,
    onUploadProgress(progressEvent) {
      onProgress?.(progressEvent);
    },
    abortSignal: signal,
  });
};
