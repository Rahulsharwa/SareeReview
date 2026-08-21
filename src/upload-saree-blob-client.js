import { upload } from "@vercel/blob/client";
import heic2any from "heic2any";

const PREFIX = "upload-saree/staging";
const HEIC_MIME_TYPES = new Set(["image/heic", "image/heif"]);
const HEIC_EXTENSIONS = new Set(["heic", "heif"]);
const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);

function getUploadFileExtension(file) {
  return String(file?.name || "").split(".").pop().toLowerCase();
}

function isHeicUploadFile(file) {
  if (!file) return false;
  const mimeType = String(file.type || "").trim().toLowerCase();
  return HEIC_MIME_TYPES.has(mimeType) || HEIC_EXTENSIONS.has(getUploadFileExtension(file));
}

async function looksLikeHeicContainer(file) {
  if (!file) return false;
  const bytes = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  if (bytes.length < 12) return false;

  const readBrand = (offset) => String.fromCharCode(...bytes.slice(offset, offset + 4)).toLowerCase();
  if (readBrand(4) !== "ftyp") return false;
  if (HEIC_BRANDS.has(readBrand(8))) return true;

  for (let offset = 16; offset + 4 <= bytes.length; offset += 4) {
    if (HEIC_BRANDS.has(readBrand(offset))) return true;
  }
  return false;
}

function isLikelyMemoryError(error) {
  const message = String(error?.message || "").toLowerCase();
  return error instanceof RangeError || /memory|allocation|array buffer|out of bounds/.test(message);
}

async function convertHeicToJpeg(file, { quality = 0.94 } = {}) {
  if (!isHeicUploadFile(file)) return file;
  if (!(await looksLikeHeicContainer(file))) {
    throw new Error("This file does not appear to be a valid HEIC/HEIF image.");
  }

  let converted;
  try {
    converted = await heic2any({ blob: file, toType: "image/jpeg", quality });
  } catch (error) {
    console.warn("HEIC conversion failed", {
      name: file.name,
      size: file.size,
      message: error?.message,
    });
    if (isLikelyMemoryError(error)) {
      throw new Error("This HEIC image could not be processed on this device. Please try a smaller image or convert it to JPG first.");
    }
    throw new Error("The HEIC image could not be converted. Please try another image.");
  }

  const blob = Array.isArray(converted) ? converted[0] : converted;
  if (!(blob instanceof Blob)) {
    throw new Error("The HEIC image could not be converted. Please try another image.");
  }

  const originalBaseName = String(file.name || "image").replace(/\.(heic|heif)$/i, "");
  return new File([blob], `${originalBaseName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

window.uploadSareeHeic = Object.freeze({
  isHeicUploadFile,
  looksLikeHeicContainer,
  convertHeicToJpeg,
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
