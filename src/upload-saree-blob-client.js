import { upload } from "@vercel/blob/client";

const PREFIX = "upload-saree/staging";

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
