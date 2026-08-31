const UPLOAD_API = {
  status: "/api/upload-saree/status",
  recent: "/api/upload-saree/recent",
  upload: "/api/upload-saree",
  finalize: "/api/upload-saree/finalize",
  cleanupUpload: "/api/upload-saree/cleanup-upload",
  submissions: "/api/upload-saree/submissions",
  reviewAuth: "/api/review-auth",
};

window.JSH_UPLOAD_BUILD = "baserow-form-provider-v1";

const uploadSareeState = {
  active: false,
  loaded: false,
  rows: [],
  selectedRowId: null,
  selectedReferenceKey: "saree",
  selectedGeneratedKey: "front",
  syncTimer: null,
  maxFileSizeMb: 10,
  maxHeicDecodePixels: 100000000,
  detailOpen: false,
  currentRowId: null,
  loadingRecent: false,
  isSyncing: false,
  visibleRowLimit: 20,
  rowSignatures: new Map(),
  visibilityRefreshTimer: null,
  quantityRowId: null,
  quantitySaving: false,
  submitting: false,
  lastRowsSignature: "",
  currentDetailSignature: "",
  detailLastScrollTop: 0,
  detailHeaderHidden: false,
  syncAfterDetailClose: false,
  savedPageScrollY: 0,
  pageScrollLocked: false,
  returnNavigation: null,
  viewerScale: 1,
  viewerX: 0,
  viewerY: 0,
  viewerFit: true,
  viewerPointers: new Map(),
  viewerPinchDistance: 0,
  directStorageEnabled: false,
  storageProvider: "vercel_blob",
  publicConfig: {},
  clientTimeoutMs: 900000,
  allowedMimeTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
  isUploading: false,
  isConverting: false,
  conversionWorkCount: 0,
  conversionQueue: Promise.resolve(),
  conversionIds: { saree: 0, blouse: 0, pallu: 0, border: 0 },
  convertingRoles: { saree: false, blouse: false, pallu: false, border: false },
  files: { saree: null, blouse: null, pallu: null, border: null },
  uploadCancelled: false,
  uploadTimedOut: false,
  uploadAbortController: null,
  uploadedBlobPaths: [],
  submissionId: null,
  submissionFingerprint: "",
  uploadedBaserowFiles: { saree: null, blouse: null, pallu: null, border: null },
  retryCheckRequired: false,
  successMessageTimer: null,
  sareeFile: null,
  blouseFile: null,
  palluFile: null,
  borderFile: null,
  previewUrls: {
    saree: null,
    blouse: null,
    pallu: null,
    border: null,
  },
  fileProgress: {
    saree: 0,
    blouse: 0,
    pallu: 0,
    border: 0,
  },
};

const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const ALLOWED_UPLOAD_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);
const HEIC_UPLOAD_MIME_TYPES = new Set(["image/heic", "image/heif"]);
const HEIC_UPLOAD_EXTENSIONS = new Set(["heic", "heif"]);
const STORED_UPLOAD_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const STORED_UPLOAD_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const UPLOAD_REFERENCE_ROLES = ["saree", "blouse", "pallu", "border"];
const UPLOAD_ROLE_CONFIG = {
  saree: { label: "Saree Image", inputId: "uploadSareeImage", inputName: "sareeImage", required: true },
  blouse: { label: "Blouse Image", inputId: "uploadBlouseImage", inputName: "blouseImage", required: false },
  pallu: { label: "Pallu Image", inputId: "uploadPalluImage", inputName: "palluImage", required: false },
  border: { label: "Border Image", inputId: "uploadBorderImage", inputName: "borderImage", required: false },
};

const UPLOAD_GENERATED_TABS = [
  { key: "front", label: "Front View" },
  { key: "side", label: "Side View" },
  { key: "back", label: "Back View" },
  { key: "closeUp", label: "Close-Up" },
  { key: "blouseGrid", label: "Blouse Grid" },
];
const UPLOAD_REFERENCE_TABS = [
  { key: "saree", label: "Saree Image" },
  { key: "blouse", label: "Blouse Image" },
  { key: "pallu", label: "Pallu Image" },
  { key: "border", label: "Border Image" },
];
const UPLOAD_INITIAL_RENDER_COUNT = 20;
const UPLOAD_RENDER_BATCH_SIZE = 20;
const uploadImageRetryState = new WeakMap();
let uploadImageObserver = null;

function uploadEscapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function uploadEscapeAttr(value) {
  return uploadEscapeHtml(value).replace(/`/g, "&#96;");
}

function uploadDisplay(value, fallback) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function uploadGenerationStatusValue(row) {
  if (!row || typeof row !== "object") return "";
  return row.generationStatus
    ?? row.status
    ?? row["Generation Status"]
    ?? row.field_9535471;
}

function normalizeUploadGenerationStatus(value) {
  if (value && typeof value === "object" && value.value !== undefined) {
    return String(value.value).trim().toLowerCase();
  }
  return String(value || "").trim().toLowerCase();
}

function shouldShowUploadReviewRow(row) {
  if (!row || typeof row !== "object") return false;
  const status = normalizeUploadGenerationStatus(uploadGenerationStatusValue(row));
  return status === "pending" || status === "completed";
}

function canApproveUploadReviewRow(row) {
  if (!row || typeof row !== "object") return false;
  const status = normalizeUploadGenerationStatus(uploadGenerationStatusValue(row));
  if (status === "completed") return true;
  return status === "pending" && hasUploadImage(row?.images?.front);
}

function uploadStatusText(row) {
  const value = uploadGenerationStatusValue(row);
  const displayValue = value && typeof value === "object" && value.value !== undefined ? value.value : value;
  return uploadDisplay(displayValue, "Start");
}

function hasUploadImage(url) {
  return typeof url === "string" && url.trim().length > 0;
}

function getUploadMainImage(row) {
  const images = row?.images || {};
  if (hasUploadImage(images.front)) return { key: "front", url: images.front, type: "generated", label: "Front View" };
  if (hasUploadImage(images.saree)) return { key: "saree", url: images.saree, type: "reference", label: "Saree Image" };
  if (hasUploadImage(images.side)) return { key: "side", url: images.side, type: "generated", label: "Side View" };
  if (hasUploadImage(images.back)) return { key: "back", url: images.back, type: "generated", label: "Back View" };
  if (hasUploadImage(images.closeUp)) return { key: "closeUp", url: images.closeUp, type: "generated", label: "Close-Up" };
  if (hasUploadImage(images.blouseGrid)) return { key: "blouseGrid", url: images.blouseGrid, type: "generated", label: "Blouse Grid" };
  return { key: "", url: "", type: "empty", label: "No reference image" };
}

function getUploadGeneratedImage(row, key = "front") {
  return row?.images?.[key] || row?.generated?.[key] || "";
}

function getAvailableUploadGeneratedTabs(row) {
  return UPLOAD_GENERATED_TABS.filter((tab) => hasUploadImage(getUploadGeneratedImage(row, tab.key)));
}

function getGeneratedImage(row, key = "front") {
  return getUploadGeneratedImage(row, key);
}

function uploadMainImage(row) {
  return getUploadMainImage(row).url;
}

function createUploadImagePlaceholder(label) {
  const placeholder = document.createElement("div");
  placeholder.className = "upload-placeholder";
  placeholder.innerHTML = `${uploadEscapeHtml(label)}<br>-`;
  return placeholder;
}

function getUploadImageObserver() {
  if (uploadImageObserver || typeof IntersectionObserver !== "function") return uploadImageObserver;
  uploadImageObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const image = entry.target;
      const originalUrl = image.dataset.originalSrc || "";
      if (!image.getAttribute("src") && originalUrl) image.src = originalUrl;
      uploadImageObserver.unobserve(image);
    });
  }, { rootMargin: "600px 0px" });
  return uploadImageObserver;
}

function observeUploadLazyImages(scope = document) {
  const images = scope.querySelectorAll?.("img.upload-original-lazy-image[data-original-src]:not([src])") || [];
  const observer = getUploadImageObserver();
  images.forEach((image) => {
    if (observer) observer.observe(image);
    else image.src = image.dataset.originalSrc;
  });
}

function renderUploadImage(src, label, className = "", options = {}) {
  if (!hasUploadImage(src)) {
    return `<div class="upload-empty-media">${uploadEscapeHtml(label)}<br>-</div>`;
  }
  const eager = options.priority === "high";
  const defer = Boolean(options.defer) && !eager;
  return `<img class="upload-media-fit upload-original-lazy-image ${uploadEscapeAttr(className)}" ${defer ? "" : `src="${uploadEscapeAttr(src)}"`} data-original-src="${uploadEscapeAttr(src)}" alt="${uploadEscapeAttr(label)}" loading="${eager ? "eager" : "lazy"}" decoding="async" fetchpriority="${eager ? "high" : "low"}" onload="handleUploadImageLoad(this)" onerror="handleUploadImageError(this, '${uploadEscapeAttr(label)}')" />`;
}

function renderUploadZoomableImage(displayUrl, originalUrl, label, className = "", options = {}) {
  if (!hasUploadImage(displayUrl) || !hasUploadImage(originalUrl)) {
    return `<div class="upload-empty-media">${uploadEscapeHtml(label)}<br>-</div>`;
  }
  return `
    <button class="upload-zoomable-image" type="button" data-upload-zoom-url="${uploadEscapeAttr(originalUrl)}" data-upload-zoom-label="${uploadEscapeAttr(label)}" aria-label="Open ${uploadEscapeAttr(label)} full screen">
      ${renderUploadImage(displayUrl, label, className, options)}
    </button>
  `;
}

function handleUploadImageLoad(image) {
  uploadImageRetryState.delete(image);
  image.classList.add("upload-image-loaded");
  image.classList.remove("upload-image-load-failed");
  const trigger = image.closest(".upload-zoomable-image");
  if (trigger) {
    trigger.classList.remove("image-failed");
    delete trigger.dataset.uploadRetryImage;
    trigger.querySelector(".upload-image-retry-label")?.remove();
  }
}

function retryUploadImage(image, { reset = false } = {}) {
  if (!image?.isConnected) return;
  if (reset) uploadImageRetryState.set(image, 0);
  image.classList.remove("upload-image-load-failed");
  const trigger = image.closest(".upload-zoomable-image");
  trigger?.classList.remove("image-failed");
  if (trigger) {
    delete trigger.dataset.uploadRetryImage;
    trigger.querySelector(".upload-image-retry-label")?.remove();
  }
  const originalUrl = image.dataset.originalSrc || image.getAttribute("src") || "";
  if (!originalUrl) return;
  image.removeAttribute("src");
  requestAnimationFrame(() => {
    if (image.isConnected) image.src = originalUrl;
  });
}

function handleUploadImageError(image, label) {
  const attempts = uploadImageRetryState.get(image) || 0;
  if (attempts < 2) {
    uploadImageRetryState.set(image, attempts + 1);
    setTimeout(() => retryUploadImage(image), attempts === 0 ? 1500 : 5000);
    return;
  }
  image.classList.add("upload-image-load-failed");
  const trigger = image.closest(".upload-zoomable-image");
  if (!trigger) return;
  trigger.classList.add("image-failed");
  trigger.dataset.uploadRetryImage = "true";
  trigger.setAttribute("aria-label", `Retry ${label}`);
  if (!trigger.querySelector(".upload-image-retry-label")) {
    trigger.insertAdjacentHTML("beforeend", `<span class="upload-image-retry-label">Retry Image</span>`);
  }
}

function createUploadRowSignature(row) {
  return JSON.stringify({
    rowId: row.rowId,
    status: row.generationStatus || row.status || "",
    saree: row.images?.saree || "",
    blouse: row.images?.blouse || "",
    pallu: row.images?.pallu || "",
    border: row.images?.border || "",
    front: row.images?.front || "",
    side: row.images?.side || "",
    back: row.images?.back || "",
    closeUp: row.images?.closeUp || "",
    blouseGrid: row.images?.blouseGrid || "",
    title: row.productTitle || "",
    code: row.productCode || "",
    category: row.category || "",
    price: row.price || "",
    descriptions: row.descriptions || "",
    commentNotes: row.commentNotes || "",
    quantity: Number(row.quantity || 1),
  });
}

function stableUploadRowsSignature(rows) {
  return JSON.stringify((rows || []).filter(shouldShowUploadReviewRow).map(createUploadRowSignature));
}

function getUploadDetailSignature(row) {
  return JSON.stringify({
    rowId: row.rowId,
    status: row.generationStatus || row.status || "",
    saree: row.images?.saree || "",
    blouse: row.images?.blouse || "",
    pallu: row.images?.pallu || "",
    border: row.images?.border || "",
    front: row.images?.front || "",
    side: row.images?.side || "",
    back: row.images?.back || "",
    closeUp: row.images?.closeUp || "",
    blouseGrid: row.images?.blouseGrid || "",
    descriptions: row.descriptions || "",
    commentNotes: row.commentNotes || "",
    quantity: Number(row.quantity || 1),
  });
}

function isMobileUploadView() {
  return window.matchMedia("(max-width: 760px)").matches;
}

function getUploadDetailBody() {
  return document.getElementById("uploadDetailBody");
}

function getUploadDetailHeader() {
  return document.getElementById("uploadDetailHeader");
}

function showUploadToast(message, isError = false) {
  let toast = document.getElementById("uploadToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "uploadToast";
    toast.className = "upload-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.toggle("error", Boolean(isError));
  toast.classList.add("show");
  clearTimeout(showUploadToast.timer);
  showUploadToast.timer = setTimeout(() => toast.classList.remove("show"), 3200);
}

function safeUploadUiErrorMessage(error) {
  return String(error?.message || error || "Upload action failed.")
    .replace(/(?:Bearer\s+|vercel_blob_(?:rw|client)_)[a-zA-Z0-9._-]+/gi, "[redacted]")
    .slice(0, 300);
}

function handleUploadUiError(error, fallbackMessage = "Upload action failed. Please retry.") {
  const safeMessage = safeUploadUiErrorMessage(error);
  console.error("Upload UI action failed", { message: safeMessage });
  setUploadMessage(fallbackMessage, true);
  showUploadToast(fallbackMessage, true);
}

function runUploadUiAction(action, fallbackMessage) {
  try {
    return Promise.resolve(action()).catch((error) => handleUploadUiError(error, fallbackMessage));
  } catch (error) {
    handleUploadUiError(error, fallbackMessage);
    return Promise.resolve();
  }
}

function directUploadErrorMessage(error, label) {
  const config = uploadSareeState.publicConfig || {};
  if (!config.blobConfigured || config.blob?.configured === false) {
    return "Upload storage is not configured.";
  }
  const message = safeUploadUiErrorMessage(error).toLowerCase();
  if (error instanceof TypeError || message.includes("network request")) {
    return "The image upload could not reach storage. Check your connection and retry.";
  }
  if (message.includes("vercel blob") || message.includes("client token") || message.includes("403") || message.includes("not allowed")) {
    return "Image upload authorization failed. Please retry.";
  }
  return `${label} could not be uploaded. No Baserow row was created.`;
}

async function uploadAuthenticate() {
  const password = window.prompt("Enter Review Portal password");
  if (!password) throw new Error("Review password required");
  const response = await fetch(UPLOAD_API.reviewAuth, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.error || "Review authentication failed");
}

async function uploadApiCall(url, options = {}, retryAuth = true) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (response.status === 401 && retryAuth && data.error === "Review password required.") {
    await uploadAuthenticate();
    return uploadApiCall(url, options, false);
  }

  if (!response.ok) {
    console.error("Upload failed", {
      route: url === UPLOAD_API.upload ? "/api/upload-saree" : url,
      status: response.status,
      directStorageEnabled: uploadSareeState.publicConfig?.directStorageEnabled,
    });
    if (response.status === 413 && url === UPLOAD_API.upload) {
      throw new Error("This image was sent through the legacy server upload route. Direct large-image upload is not active.");
    }
    if (response.status === 413) {
      throw new Error("The upload was rejected because the request was too large. The direct storage upload is not active or the hosting upload limit was reached.");
    }
    throw new Error(data.error || data.message || `API failed: ${response.status}`);
  }
  return data;
}

function uploadStatusClass(status) {
  const value = normalizeUploadGenerationStatus(status);
  if (value.includes("approved")) return "approved";
  if (value.includes("failed") || value.includes("reject")) return "failed";
  if (value.includes("pending")) return "pending";
  return "start";
}

function currentUploadRow() {
  return uploadSareeState.rows.filter(shouldShowUploadReviewRow).find((row) => Number(row.rowId) === Number(uploadSareeState.selectedRowId)) || null;
}

function setUploadMessage(message, isError = false) {
  const element = document.getElementById("uploadFormMessage");
  if (!element) return;
  clearTimeout(uploadSareeState.successMessageTimer);
  uploadSareeState.successMessageTimer = null;
  element.hidden = !message;
  element.classList.toggle("error", Boolean(isError));
  element.classList.remove("success");
  element.textContent = message || "";
}

function clearUploadError() {
  const element = document.getElementById("uploadFormMessage");
  if (!element) return;
  clearTimeout(uploadSareeState.successMessageTimer);
  uploadSareeState.successMessageTimer = null;
  element.textContent = "";
  element.classList.remove("error", "success");
  element.hidden = true;
}

function showUploadSuccess({ title, message }) {
  const element = document.getElementById("uploadFormMessage");
  const combinedMessage = `${title} ${message}`;
  if (!element) {
    showUploadToast(combinedMessage);
    return;
  }
  clearTimeout(uploadSareeState.successMessageTimer);
  element.hidden = false;
  element.classList.remove("error");
  element.classList.add("success");
  element.innerHTML = `<strong>${uploadEscapeHtml(title)}</strong><span>${uploadEscapeHtml(message)}</span>`;
  uploadSareeState.successMessageTimer = setTimeout(() => {
    if (element.classList.contains("success")) clearUploadError();
  }, 5000);
}

function getMaxUploadSizeBytes() {
  return uploadSareeState.maxFileSizeMb * 1024 * 1024;
}

function getFileExtension(filename) {
  return String(filename || "").split(".").pop().toLowerCase();
}

function isHeicUploadFile(file) {
  if (!file) return false;
  const mimeType = String(file.type || "").trim().toLowerCase();
  return HEIC_UPLOAD_MIME_TYPES.has(mimeType) || HEIC_UPLOAD_EXTENSIONS.has(getFileExtension(file.name));
}

function effectiveUploadMimeType(file) {
  const mimeType = String(file?.type || "").trim().toLowerCase();
  if (mimeType) return mimeType;
  const extension = getFileExtension(file?.name);
  if (extension === "heic") return "image/heic";
  if (extension === "heif") return "image/heif";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "";
}

function validateUploadImageFile(file, label) {
  if (!file) return;
  const mimeType = String(file.type || "").trim().toLowerCase();
  const extension = getFileExtension(file.name);
  if (!ALLOWED_UPLOAD_EXTENSIONS.has(extension) || (mimeType && !ALLOWED_UPLOAD_MIME_TYPES.has(mimeType))) {
    throw new Error("Only JPG, PNG, WEBP, HEIC, and HEIF images are allowed.");
  }
  if (!mimeType && !HEIC_UPLOAD_EXTENSIONS.has(extension)) {
    throw new Error("Only JPG, PNG, WEBP, HEIC, and HEIF images are allowed.");
  }
  if (file.size > getMaxUploadSizeBytes()) {
    throw new Error(`The selected image exceeds the maximum allowed size of ${uploadSareeState.maxFileSizeMb} MB.`);
  }
  if (file.size <= 0) {
    throw new Error(`${label} is empty.`);
  }
}

function validateStoredUploadImageFile(file) {
  const mimeType = String(file?.type || "").trim().toLowerCase();
  const extension = getFileExtension(file?.name);
  const baserowForm = uploadSareeState.storageProvider === "baserow_form";
  const allowedMimeTypes = baserowForm ? ALLOWED_UPLOAD_MIME_TYPES : STORED_UPLOAD_MIME_TYPES;
  const allowedExtensions = baserowForm ? ALLOWED_UPLOAD_EXTENSIONS : STORED_UPLOAD_EXTENSIONS;
  const allowedMime = allowedMimeTypes.has(mimeType) || (baserowForm && !mimeType && HEIC_UPLOAD_EXTENSIONS.has(extension));
  if (!(file instanceof File) || !allowedMime || !allowedExtensions.has(extension)) {
    throw new Error("The image could not be prepared for upload.");
  }
  if (file.size <= 0 || file.size > getMaxUploadSizeBytes()) {
    throw new Error(`The selected image exceeds the maximum allowed size of ${uploadSareeState.maxFileSizeMb} MB.`);
  }
}

function getUploadRoleConfig(role) {
  return UPLOAD_ROLE_CONFIG[role] || null;
}

function getUploadRoleInput(role) {
  const config = getUploadRoleConfig(role);
  return config ? document.getElementById(config.inputId) : null;
}

function getSelectedUploadFiles() {
  return UPLOAD_REFERENCE_ROLES.map((role) => {
    const config = getUploadRoleConfig(role);
    const selection = uploadSareeState.files[role];
    return {
      role,
      label: config.label,
      file: selection?.uploadFile || null,
      originalFile: selection?.originalFile || null,
      convertedFromHeic: Boolean(selection?.convertedFromHeic),
      required: config.required,
    };
  }).filter((item) => item.file instanceof File);
}

function resetBaserowSubmissionClientState() {
  uploadSareeState.submissionId = null;
  uploadSareeState.submissionFingerprint = "";
  uploadSareeState.uploadedBaserowFiles = { saree: null, blouse: null, pallu: null, border: null };
  uploadSareeState.retryCheckRequired = false;
}

function uploadSubmissionFingerprint(form, selectedItems) {
  return JSON.stringify({
    productTitle: getUploadInputValue(form, "productTitle"),
    productCode: getUploadInputValue(form, "productCode"),
    category: getUploadInputValue(form, "category"),
    price: getUploadInputValue(form, "price"),
    descriptions: getUploadInputValue(form, "descriptions"),
    commentNotes: getUploadInputValue(form, "commentNotes"),
    files: selectedItems.map((item) => ({ role: item.role, name: item.file.name, size: item.file.size, type: item.file.type })),
  });
}

function validateSelectedUploadFiles() {
  if (uploadSareeState.isConverting) {
    throw new Error("Please wait for HEIC conversion to finish.");
  }
  const selectedItems = getSelectedUploadFiles();
  const configuredMaximum = Number(uploadSareeState.publicConfig?.maxUploadFiles || UPLOAD_REFERENCE_ROLES.length);
  const maxUploadFiles = configuredMaximum === UPLOAD_REFERENCE_ROLES.length
    ? configuredMaximum
    : UPLOAD_REFERENCE_ROLES.length;

  if (!selectedItems.some((item) => item.role === "saree")) {
    throw new Error("Please upload Saree Image.");
  }
  if (selectedItems.length > maxUploadFiles) {
    throw new Error(`Maximum ${maxUploadFiles} images are allowed per upload.`);
  }
  selectedItems.forEach((item) => {
    validateUploadImageFile(item.originalFile, item.label);
    validateStoredUploadImageFile(item.file);
  });
  return selectedItems;
}

function showUploadProgress(text, percentage = 0) {
  const root = document.getElementById("uploadSareeProgress");
  const textEl = document.getElementById("uploadProgressText");
  const percentEl = document.getElementById("uploadProgressPercent");
  const bar = document.getElementById("uploadProgressBar");
  const safePercent = Math.max(0, Math.min(Math.round(Number(percentage) || 0), 100));
  if (root) root.hidden = false;
  if (textEl) textEl.textContent = text;
  if (percentEl) percentEl.textContent = `${safePercent}%`;
  if (bar) bar.value = safePercent;
  setUploadMessage(text);
}

function hideUploadProgressAfterDelay() {
  setTimeout(() => {
    if (uploadSareeState.isUploading) return;
    const root = document.getElementById("uploadSareeProgress");
    if (root) root.hidden = true;
  }, 900);
}

function calculateTotalUploadProgress(files, progress) {
  const entries = [
    { role: "saree", file: files.saree },
    { role: "blouse", file: files.blouse },
    { role: "pallu", file: files.pallu },
    { role: "border", file: files.border },
  ].filter((entry) => entry.file);
  const totalBytes = entries.reduce((sum, entry) => sum + entry.file.size, 0);
  if (!totalBytes) return 0;
  const uploadedBytes = entries.reduce((sum, entry) => sum + (entry.file.size * (progress[entry.role] || 0)) / 100, 0);
  return Math.round((uploadedBytes / totalBytes) * 100);
}

function setUploadControlsDisabled(disabled) {
  const form = document.getElementById("uploadSareeForm");
  if (!form) return;
  form.querySelectorAll("input, textarea, select, button").forEach((control) => {
    if (control.id === "uploadCancelButton") {
      control.disabled = !disabled;
      return;
    }
    control.disabled = Boolean(disabled);
  });
  if (!disabled) syncUploadConversionControls();
}

function syncUploadConversionControls() {
  const submitButton = document.getElementById("uploadSubmitBtn");
  if (submitButton && !uploadSareeState.isUploading) {
    const hasUnreadySelection = Object.values(uploadSareeState.files)
      .some((selection) => selection && !(selection.uploadFile instanceof File));
    submitButton.disabled = uploadSareeState.isConverting || hasUnreadySelection;
  }
}

function setUploadRoleConverting(role, converting) {
  uploadSareeState.convertingRoles[role] = Boolean(converting);
  uploadSareeState.isConverting = uploadSareeState.conversionWorkCount > 0
    || Object.values(uploadSareeState.convertingRoles).some(Boolean);
  syncUploadConversionControls();
}

function finishUploadConversionWork() {
  uploadSareeState.conversionWorkCount = Math.max(0, uploadSareeState.conversionWorkCount - 1);
  uploadSareeState.isConverting = uploadSareeState.conversionWorkCount > 0
    || Object.values(uploadSareeState.convertingRoles).some(Boolean);
  syncUploadConversionControls();
}

function getUploadInputValue(form, name) {
  return String(form?.elements?.[name]?.value || "").trim();
}

async function cleanupUploadedBlobPaths(pathnames) {
  const validPathnames = Array.isArray(pathnames) ? pathnames.filter(Boolean) : [];
  if (!validPathnames.length) return;
  try {
    await uploadApiCall(UPLOAD_API.cleanupUpload, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ pathnames: validPathnames }),
    });
  } catch (error) {
    console.warn("Temporary upload cleanup failed:", error);
  }
}

function cancelUploadSaree() {
  if (!uploadSareeState.isUploading) return;
  uploadSareeState.uploadCancelled = true;
  uploadSareeState.uploadAbortController?.abort();
}

async function loadUploadStatus() {
  const panel = document.getElementById("uploadStatusPanel");
  try {
    const data = await uploadApiCall(UPLOAD_API.status);
    uploadSareeState.publicConfig = data || {};
    uploadSareeState.storageProvider = String(data.storageProvider || "vercel_blob");
    uploadSareeState.maxFileSizeMb = Number(data.maxUploadSizeMb || data.maxFileSizeMb || 50);
    uploadSareeState.maxHeicDecodePixels = Number(data.maxHeicDecodePixels || 100000000);
    uploadSareeState.directStorageEnabled = Boolean(data.directStorageEnabled);
    uploadSareeState.clientTimeoutMs = Number(data.clientTimeoutMs || 900000);
    if (Array.isArray(data.allowedMimeTypes)) uploadSareeState.allowedMimeTypes = data.allowedMimeTypes;
    populateUploadCategorySelect(data.categoryGroups);
    document.getElementById("uploadMaxSizeText").textContent = `JPG, JPEG, PNG, WEBP, HEIC, HEIF - Max ${uploadSareeState.maxFileSizeMb} MB per image`;
    panel.className = `upload-status ${data.ok ? "ok" : "error"}`;
    panel.textContent = data.ok
      ? `Upload backend connected - Table ${data.tableId}`
      : data.message || `Upload backend not configured: ${(data.missing || []).join(", ")}`;
    return data;
  } catch (error) {
    panel.className = "upload-status error";
    panel.textContent = error.message;
    return null;
  }
}

async function loadUploadSarees({ refresh = false, force = false } = {}) {
  return loadRecentUploadSarees({ force: refresh || force, preserveDetail: true, silent: !(refresh || force) });
}

async function loadRecentUploadSarees(options = {}) {
  const {
    force = false,
    preserveDetail = true,
    silent = false,
    submissionId = "",
  } = options;
  const root = document.getElementById("uploadRecentRows");
  if (uploadSareeState.isSyncing) return;
  if (!uploadSareeState.active && silent) return;
  if (!silent && !uploadSareeState.rows.length) {
    root.innerHTML = `<div class="upload-empty">Loading uploaded sarees...</div>`;
  }

  try {
    uploadSareeState.isSyncing = true;
    uploadSareeState.loadingRecent = true;
    const params = new URLSearchParams();
    if (force) params.set("refresh", "1");
    if (submissionId) params.set("submissionId", submissionId);
    const response = await fetch(`${UPLOAD_API.recent}${params.size ? `?${params.toString()}` : ""}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && data.error === "Review password required.") {
      await uploadAuthenticate();
      uploadSareeState.isSyncing = false;
      return loadRecentUploadSarees({ force, preserveDetail, silent, submissionId });
    }
    if (!response.ok) throw new Error(data.error || data.message || "Unable to load uploaded sarees.");

    const rawRows = Array.isArray(data.rows)
      ? data.rows
      : Array.isArray(data.uploads)
        ? data.uploads
        : [];
    const nextRows = rawRows.filter(shouldShowUploadReviewRow);

    const nextSignature = stableUploadRowsSignature(nextRows);
    if (uploadSareeState.lastRowsSignature !== nextSignature) {
      uploadSareeState.lastRowsSignature = nextSignature;
      uploadSareeState.rows = nextRows;
      renderUploadRows();
    }
    updateUploadSyncTime();

    if (preserveDetail && uploadSareeState.detailOpen && uploadSareeState.currentRowId) {
      const updatedRow = uploadSareeState.rows.filter(shouldShowUploadReviewRow).find((row) => Number(row.rowId) === Number(uploadSareeState.currentRowId));
      if (updatedRow) {
        uploadSareeState.selectedRowId = updatedRow.rowId;
        const nextDetailSignature = getUploadDetailSignature(updatedRow);
        if (uploadSareeState.currentDetailSignature !== nextDetailSignature) {
          uploadSareeState.currentDetailSignature = nextDetailSignature;
          renderUploadDetail(updatedRow, { keepOpen: true, preserveGeneratedKey: true });
        }
      } else {
        closeUploadImageFullscreen();
        closeUploadDetail({ refreshAfterClose: false });
      }
    }

    if (!silent) showUploadToast("Upload saree data synced.");
    return data;
  } catch (error) {
    console.error("Upload recent sync failed:", error);
    if (!uploadSareeState.rows.length) {
      root.innerHTML = `<div class="upload-empty">Upload API failed: ${uploadEscapeHtml(error.message)}</div>`;
    } else if (!silent) {
      showUploadToast(error.message || "Unable to sync upload sarees.", true);
    }
  } finally {
    uploadSareeState.loadingRecent = false;
    uploadSareeState.isSyncing = false;
  }
}

function updateUploadSyncTime() {
  const updatedAt = document.getElementById("uploadUpdatedAt");
  if (updatedAt) updatedAt.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
}

async function syncUploadSareesNow() {
  await loadRecentUploadSarees({ force: true, preserveDetail: true, silent: false });
}

function captureUploadViewportAnchor() {
  const cards = Array.from(document.querySelectorAll("#uploadRecentRows [data-upload-row-id]"));
  const anchor = cards.find((card) => card.getBoundingClientRect().bottom > 0);
  if (!anchor) return { rowId: null, offset: 0, scrollY: window.scrollY };
  return {
    rowId: anchor.dataset.uploadRowId,
    offset: anchor.getBoundingClientRect().top,
    scrollY: window.scrollY,
  };
}

function restoreUploadViewportAnchor(anchor) {
  if (!anchor) return;
  requestAnimationFrame(() => {
    const card = anchor.rowId
      ? document.querySelector(`#uploadRecentRows [data-upload-row-id="${CSS.escape(String(anchor.rowId))}"]`)
      : null;
    if (card) {
      window.scrollBy(0, card.getBoundingClientRect().top - anchor.offset);
    } else {
      window.scrollTo(0, anchor.scrollY || 0);
    }
  });
}

function setUploadElementText(root, selector, value) {
  const element = root.querySelector(selector);
  const nextText = String(value ?? "");
  if (element && element.textContent !== nextText) element.textContent = nextText;
}

function updateUploadMediaContainer(container, { url, label, className = "", defer = true, priority = "low" }) {
  if (!container) return;
  const existingImage = container.querySelector("img[data-original-src]");
  const currentUrl = existingImage?.dataset.originalSrc || "";
  if (hasUploadImage(url) && currentUrl === url) return;
  if (!hasUploadImage(url) && !existingImage && container.querySelector(".upload-empty-media")) return;

  if (existingImage && uploadImageObserver) uploadImageObserver.unobserve(existingImage);
  container.innerHTML = hasUploadImage(url)
    ? renderUploadZoomableImage(url, url, label, className, { defer, priority })
    : `<div class="upload-empty-media">${uploadEscapeHtml(label)}<br>-</div>`;
  observeUploadLazyImages(container);
}

function uploadCardMediaItems(row, mainImage) {
  return [
    { key: "saree", label: "Saree" },
    { key: "blouse", label: "Blouse" },
    { key: "pallu", label: "Pallu" },
    { key: "border", label: "Border" },
    { key: "front", label: "Front View" },
    { key: "side", label: "Side View" },
    { key: "back", label: "Back View" },
    { key: "closeUp", label: "Close-Up" },
    { key: "blouseGrid", label: "Blouse Grid" },
  ].filter((item) => item.key !== mainImage.key && hasUploadImage(row.images?.[item.key]));
}

function createUploadCardElement(row) {
  const card = document.createElement("article");
  card.className = "upload-card upload-recent-card";
  card.dataset.uploadRowId = String(row.rowId);
  card.innerHTML = `
    <div class="upload-card-media upload-main-image upload-recent-main-media" data-upload-card-main></div>
    <div class="upload-card-body upload-recent-card-body">
      <div class="upload-card-kicker" data-upload-field="code"></div>
      <div class="upload-card-title" data-upload-field="title"></div>
      <div class="upload-card-meta" data-upload-field="category"></div>
      <div class="upload-card-price" data-upload-field="price"></div>
      <div class="upload-badges">
        <span class="upload-badge" data-upload-field="status"></span>
        <span class="upload-badge">Upload Saree</span>
      </div>
      <div class="upload-card-quantity">
        <strong data-upload-field="quantity"></strong>
        <button class="upload-btn compact" type="button" data-upload-action="quantity" onclick="openUploadQuantityEditor(${Number(row.rowId)})">Quantity</button>
      </div>
      <div class="upload-thumb-row" data-upload-card-thumbs></div>
      <div class="upload-card-actions">
        <button class="upload-btn" type="button" data-upload-action="detail">View Detail</button>
        <button class="upload-btn primary" type="button" data-upload-action="approve">Approve</button>
      </div>
    </div>
  `;
  return card;
}

function reconcileUploadCardThumbs(card, row, mainImage) {
  const root = card.querySelector("[data-upload-card-thumbs]");
  const items = uploadCardMediaItems(row, mainImage);
  const existing = new Map(Array.from(root.children).map((element) => [element.dataset.uploadMediaKey, element]));

  items.forEach((item, index) => {
    let thumb = existing.get(item.key);
    if (!thumb) {
      thumb = document.createElement("div");
      thumb.className = "upload-thumb";
      thumb.dataset.uploadMediaKey = item.key;
      thumb.title = item.label;
      thumb.innerHTML = `<div class="upload-thumb-media upload-media-thumb"></div><span>${uploadEscapeHtml(item.label)}</span>`;
    }
    updateUploadMediaContainer(thumb.querySelector(".upload-thumb-media"), {
      url: row.images[item.key],
      label: item.label,
      defer: true,
      priority: "low",
    });
    if (root.children[index] !== thumb) root.insertBefore(thumb, root.children[index] || null);
    existing.delete(item.key);
  });
  existing.forEach((element) => element.remove());
}

function updateUploadCardElement(card, row, index) {
  const status = uploadStatusText(row);
  const statusBadge = card.querySelector('[data-upload-field="status"]');
  const mainImage = getUploadMainImage(row);
  const quantity = Number(row.quantity || 1);

  setUploadElementText(card, '[data-upload-field="code"]', uploadDisplay(row.productCode, "No product code"));
  setUploadElementText(card, '[data-upload-field="title"]', uploadDisplay(row.productTitle, "Untitled Upload"));
  setUploadElementText(card, '[data-upload-field="category"]', uploadDisplay(row.category, "No category"));
  setUploadElementText(card, '[data-upload-field="price"]', uploadDisplay(row.price, "Price not added"));
  setUploadElementText(card, '[data-upload-field="status"]', status);
  setUploadElementText(card, '[data-upload-field="quantity"]', `Quantity: ${quantity}`);
  statusBadge.className = `upload-badge ${uploadStatusClass(status)}`;

  const mainContainer = card.querySelector("[data-upload-card-main]");
  mainContainer.classList.remove("reference", "generated", "empty");
  mainContainer.classList.add(mainImage.type);
  updateUploadMediaContainer(mainContainer, {
    url: mainImage.url,
    label: mainImage.label,
    className: "upload-card-main-img",
    defer: index >= 2,
    priority: index < 2 ? "high" : "low",
  });
  reconcileUploadCardThumbs(card, row, mainImage);

  const detailButton = card.querySelector('[data-upload-action="detail"]');
  const quantityButton = card.querySelector('[data-upload-action="quantity"]');
  const approveButton = card.querySelector('[data-upload-action="approve"]');
  detailButton.onclick = () => openUploadDetail(Number(row.rowId));
  quantityButton.onclick = () => openUploadQuantityEditor(Number(row.rowId));
  approveButton.onclick = (event) => approveUploadSareeFromCard(Number(row.rowId), event);
  quantityButton.setAttribute("onclick", `openUploadQuantityEditor(${Number(row.rowId)})`);
  approveButton.disabled = !canApproveUploadReviewRow(row);
  card.dataset.uploadRowSignature = createUploadRowSignature(row);
}

function renderUploadRows({ preserveViewport = true } = {}) {
  const root = document.getElementById("uploadRecentRows");
  const count = document.getElementById("uploadRecentCount");
  const viewportAnchor = preserveViewport && !uploadSareeState.detailOpen
    ? captureUploadViewportAnchor()
    : null;
  const visibleRows = uploadSareeState.rows.filter(shouldShowUploadReviewRow);
  const renderLimit = Math.max(UPLOAD_INITIAL_RENDER_COUNT, uploadSareeState.visibleRowLimit || 0);
  const renderedRows = visibleRows.slice(0, renderLimit);
  count.textContent = renderedRows.length < visibleRows.length
    ? `${renderedRows.length} of ${visibleRows.length} rows`
    : `${visibleRows.length} rows`;

  if (!visibleRows.length) {
    root.replaceChildren();
    const empty = document.createElement("div");
    empty.className = "upload-empty";
    empty.textContent = "No uploaded sarees found.";
    root.appendChild(empty);
    uploadSareeState.rowSignatures.clear();
    const loadMore = document.getElementById("uploadLoadMore");
    if (loadMore) loadMore.hidden = true;
    restoreUploadViewportAnchor(viewportAnchor);
    return;
  }

  root.querySelectorAll(":scope > .upload-empty").forEach((element) => element.remove());
  const existingCards = new Map(Array.from(root.querySelectorAll(":scope > [data-upload-row-id]"))
    .map((card) => [String(card.dataset.uploadRowId), card]));
  const renderedIds = new Set();

  renderedRows.forEach((row, index) => {
    const rowKey = String(row.rowId);
    const signature = createUploadRowSignature(row);
    let card = existingCards.get(rowKey);
    if (!card) card = createUploadCardElement(row);
    if (card.dataset.uploadRowSignature !== signature) updateUploadCardElement(card, row, index);
    if (root.children[index] !== card) root.insertBefore(card, root.children[index] || null);
    uploadSareeState.rowSignatures.set(rowKey, signature);
    renderedIds.add(rowKey);
  });

  existingCards.forEach((card, rowKey) => {
    if (!renderedIds.has(rowKey)) {
      card.querySelectorAll("img").forEach((image) => uploadImageObserver?.unobserve(image));
      card.remove();
      uploadSareeState.rowSignatures.delete(rowKey);
    }
  });

  const loadMore = document.getElementById("uploadLoadMore");
  if (loadMore) {
    loadMore.hidden = renderedRows.length >= visibleRows.length;
    loadMore.textContent = `Load More (${visibleRows.length - renderedRows.length} remaining)`;
  }
  observeUploadLazyImages(root);
  restoreUploadViewportAnchor(viewportAnchor);
}

function loadMoreUploadRows() {
  uploadSareeState.visibleRowLimit += UPLOAD_RENDER_BATCH_SIZE;
  renderUploadRows({ preserveViewport: true });
}

function renderUploadDetail(row = currentUploadRow(), options = {}) {
  if (!row) return;
  if (options.preserveGeneratedKey !== true) uploadSareeState.selectedGeneratedKey = "front";

  const status = uploadStatusText(row);
  document.getElementById("uploadDetailTitle").textContent = uploadDisplay(row.productTitle, "Untitled Upload");
  document.getElementById("uploadDetailMeta").textContent = `${uploadDisplay(row.productCode, "No product code")} - ${uploadDisplay(row.category, "No category")} - Status: ${status}`;
  const feedback = row.commentNotes || "";
  document.getElementById("uploadFeedbackInput").value = feedback;
  const mobileFeedback = document.getElementById("uploadApprovalNote");
  if (mobileFeedback) mobileFeedback.value = feedback;

  const information = document.getElementById("uploadProductInformation");
  const informationItems = [
    ...(String(row.descriptions || "").trim()
      ? [{ label: "Descriptions", value: row.descriptions, className: "upload-detail-description" }]
      : []),
    ...(String(row.commentNotes || "").trim()
      ? [{ label: "Comment / Notes", value: row.commentNotes, className: "upload-detail-notes" }]
      : []),
  ];
  if (information) {
    information.hidden = informationItems.length === 0;
    information.innerHTML = informationItems.map((item) => `
      <div class="upload-detail-info-item">
        <h3>${uploadEscapeHtml(item.label)}</h3>
        <div class="${uploadEscapeAttr(item.className)}">${uploadEscapeHtml(item.value)}</div>
      </div>
    `).join("");
  }

  const detailQuantity = document.getElementById("uploadDetailQuantityValue");
  if (detailQuantity) detailQuantity.textContent = `Quantity: ${Number(row.quantity || 1)}`;
  const detailQuantityButton = document.getElementById("uploadDetailQuantityButton");
  if (detailQuantityButton) detailQuantityButton.onclick = () => openUploadQuantityEditor(Number(row.rowId));

  const referenceTabs = UPLOAD_REFERENCE_TABS.filter((tab) => hasUploadImage(row.images?.[tab.key]));
  const selectedReference = referenceTabs.find((tab) => tab.key === uploadSareeState.selectedReferenceKey)
    || referenceTabs.find((tab) => tab.key === "saree")
    || referenceTabs[0]
    || null;
  uploadSareeState.selectedReferenceKey = selectedReference?.key || "";
  const referenceRoot = document.getElementById("uploadReferenceImages");
  referenceRoot.innerHTML = selectedReference
    ? `<div class="upload-reference-tabs">${referenceTabs.map((tab) => `
        <button class="upload-btn ${tab.key === selectedReference.key ? "active" : ""}" type="button" data-key="${uploadEscapeAttr(tab.key)}" onclick="selectUploadReference('${uploadEscapeAttr(tab.key)}')">${uploadEscapeHtml(tab.label)}</button>
      `).join("")}</div>
      <div class="upload-media-box">
        <div class="upload-media-label">${uploadEscapeHtml(selectedReference.label)}</div>
        <div id="uploadReferencePreview" class="upload-media-img upload-compare-image upload-reference-stage upload-detail-reference-stage">${renderUploadZoomableImage(row.images[selectedReference.key], row.images[selectedReference.key], selectedReference.label, "", { priority: "high" })}</div>
      </div>`
    : `<div class="upload-empty-media">No reference images available</div>`;

  const availableTabs = getAvailableUploadGeneratedTabs(row);
  const selected = availableTabs.find((tab) => tab.key === uploadSareeState.selectedGeneratedKey)
    || availableTabs.find((tab) => tab.key === "front")
    || availableTabs[0]
    || null;
  uploadSareeState.selectedGeneratedKey = selected?.key || "";
  document.getElementById("uploadGeneratedTabs").innerHTML = availableTabs.map((tab) => `
    <button class="upload-btn ${tab.key === selected?.key ? "active" : ""}" type="button" data-key="${uploadEscapeAttr(tab.key)}" onclick="selectUploadGenerated('${tab.key}')">${uploadEscapeHtml(tab.label)}</button>
  `).join("");

  if (selected) {
    renderUploadGeneratedStage(row, selected.key, getUploadGeneratedImage(row, selected.key));
  } else {
    const stage = document.getElementById("uploadGeneratedPreview");
    if (stage) stage.innerHTML = `<div class="upload-empty-media">No generated outputs available</div>`;
  }
  const fullscreenButton = document.getElementById("uploadFullscreenButton");
  if (fullscreenButton) fullscreenButton.hidden = !selected;

  const approveBtn = document.getElementById("uploadApproveBtn");
  const approveEnabled = canApproveUploadReviewRow(row);
  approveBtn.disabled = !approveEnabled;
  approveBtn.title = approveEnabled ? "Approve generated output" : "Pending approval requires a generated Front View";
  const sheetApproveBtn = document.getElementById("uploadApproveButton");
  if (sheetApproveBtn) {
    sheetApproveBtn.disabled = !approveEnabled;
    sheetApproveBtn.title = approveBtn.title;
  }
  requestAnimationFrame(() => {
    bindUploadDetailActions();
  });
}

function selectUploadReference(key) {
  const row = currentUploadRow();
  const tab = UPLOAD_REFERENCE_TABS.find((item) => item.key === key);
  if (!row || !tab || !hasUploadImage(row.images?.[key])) return;
  uploadSareeState.selectedReferenceKey = key;
  document.querySelectorAll("#uploadReferenceImages .upload-reference-tabs button").forEach((button) => {
    button.classList.toggle("active", button.dataset.key === key);
  });
  const preview = document.getElementById("uploadReferencePreview");
  const box = preview?.closest(".upload-media-box");
  const label = box?.querySelector(".upload-media-label");
  if (label) label.textContent = tab.label;
  updateUploadMediaContainer(preview, {
    url: row.images[key],
    label: tab.label,
    defer: false,
    priority: "high",
  });
}

function openUploadQuantityEditor(rowId) {
  const row = uploadSareeState.rows.find((item) => Number(item.rowId) === Number(rowId));
  const backdrop = document.getElementById("uploadQuantityBackdrop");
  const input = document.getElementById("uploadQuantityInput");
  const error = document.getElementById("uploadQuantityError");
  if (!row || !backdrop || !input) return;
  uploadSareeState.quantityRowId = Number(rowId);
  input.value = String(Number(row.quantity || 1));
  input.setAttribute("aria-invalid", "false");
  if (error) {
    error.hidden = true;
    error.textContent = "";
  }
  backdrop.classList.add("open");
  backdrop.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => {
    input.focus({ preventScroll: true });
    input.select();
  });
}

function closeUploadQuantityEditor(event) {
  event?.preventDefault();
  event?.stopPropagation();
  if (uploadSareeState.quantitySaving) return;
  const backdrop = document.getElementById("uploadQuantityBackdrop");
  backdrop?.classList.remove("open");
  backdrop?.setAttribute("aria-hidden", "true");
  uploadSareeState.quantityRowId = null;
}

function handleUploadQuantityBackdrop(event) {
  if (event.target.id === "uploadQuantityBackdrop") closeUploadQuantityEditor(event);
}

function parseUploadQuantity(value) {
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= 99999 ? quantity : null;
}

async function saveUploadQuantity(event) {
  event?.preventDefault();
  const rowId = uploadSareeState.quantityRowId;
  const input = document.getElementById("uploadQuantityInput");
  const error = document.getElementById("uploadQuantityError");
  const saveButton = document.getElementById("uploadQuantitySave");
  const quantity = parseUploadQuantity(input?.value);
  if (!rowId || quantity === null) {
    if (input) input.setAttribute("aria-invalid", "true");
    if (error) {
      error.hidden = false;
      error.textContent = "Enter a whole number from 1 to 99999.";
    }
    return;
  }

  uploadSareeState.quantitySaving = true;
  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = "Saving...";
  }
  try {
    const response = await uploadApiCall(`/api/upload-saree/${rowId}/quantity`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ quantity }),
    });
    const row = uploadSareeState.rows.find((item) => Number(item.rowId) === Number(rowId));
    if (row) row.quantity = Number(response.quantity);
    renderUploadRows({ preserveViewport: true });
    if (uploadSareeState.detailOpen && Number(uploadSareeState.currentRowId) === Number(rowId)) {
      const detailValue = document.getElementById("uploadDetailQuantityValue");
      if (detailValue) detailValue.textContent = `Quantity: ${Number(response.quantity)}`;
      uploadSareeState.currentDetailSignature = getUploadDetailSignature(row);
    }
    uploadSareeState.lastRowsSignature = stableUploadRowsSignature(uploadSareeState.rows);
    showUploadToast(`Quantity updated to ${Number(response.quantity)}.`);
    uploadSareeState.quantitySaving = false;
    closeUploadQuantityEditor();
  } catch (saveError) {
    if (error) {
      error.hidden = false;
      error.textContent = saveError.message || "Unable to update quantity.";
    }
    showUploadToast(saveError.message || "Unable to update quantity.", true);
  } finally {
    uploadSareeState.quantitySaving = false;
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = "Save Quantity";
    }
  }
}

function captureUploadReturnNavigation(rowId) {
  const visibleRows = uploadSareeState.rows.filter(shouldShowUploadReviewRow);
  const index = visibleRows.findIndex((item) => Number(item.rowId) === Number(rowId));
  uploadSareeState.returnNavigation = {
    rowId: String(rowId),
    nextRowId: index >= 0 ? visibleRows[index + 1]?.rowId || null : null,
    previousRowId: index > 0 ? visibleRows[index - 1]?.rowId || null : null,
    scrollY: window.scrollY,
  };
}

function lockUploadPageScroll() {
  if (uploadSareeState.pageScrollLocked) return;
  uploadSareeState.savedPageScrollY = window.scrollY;
  uploadSareeState.pageScrollLocked = true;
  document.body.style.position = "fixed";
  document.body.style.top = `-${uploadSareeState.savedPageScrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
  document.documentElement.classList.add("upload-detail-open");
  document.body.classList.add("upload-detail-open");
}

function unlockUploadPageScroll({ restoreScroll = true } = {}) {
  if (!uploadSareeState.pageScrollLocked) return;
  const scrollY = uploadSareeState.savedPageScrollY;
  uploadSareeState.pageScrollLocked = false;
  document.documentElement.classList.remove("upload-detail-open");
  document.body.classList.remove("upload-detail-open");
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  if (restoreScroll) window.scrollTo(0, scrollY);
}

function restoreUploadNavigationAfterMutation() {
  const navigation = uploadSareeState.returnNavigation;
  uploadSareeState.returnNavigation = null;
  requestAnimationFrame(() => {
    const targetIds = [navigation?.nextRowId, navigation?.previousRowId].filter(Boolean);
    const target = targetIds
      .map((rowId) => document.querySelector(`#uploadRecentRows [data-upload-row-id="${CSS.escape(String(rowId))}"]`))
      .find(Boolean);
    if (target) target.scrollIntoView({ block: "center" });
    else window.scrollTo(0, navigation?.scrollY || uploadSareeState.savedPageScrollY || 0);
  });
}

function openUploadDetail(rowId) {
  const row = uploadSareeState.rows.filter(shouldShowUploadReviewRow).find((item) => Number(item.rowId) === Number(rowId));
  if (!row) return;
  captureUploadReturnNavigation(rowId);
  uploadSareeState.detailOpen = true;
  uploadSareeState.currentRowId = rowId;
  uploadSareeState.selectedRowId = rowId;
  uploadSareeState.selectedReferenceKey = "saree";
  uploadSareeState.selectedGeneratedKey = "front";
  uploadSareeState.currentDetailSignature = getUploadDetailSignature(row);
  uploadSareeState.detailLastScrollTop = 0;
  uploadSareeState.detailHeaderHidden = false;
  lockUploadPageScroll();
  getUploadDetailHeader()?.classList.remove("header-hidden");
  renderUploadDetail(row, { keepOpen: false, preserveGeneratedKey: true });
  document.getElementById("uploadDetailBackdrop").classList.add("open");
  requestAnimationFrame(() => {
    const detailBody = getUploadDetailBody();
    if (detailBody) detailBody.scrollTop = 0;
    setupUploadDetailHeaderAutoHide();
  });
}

function closeUploadDetail({ refreshAfterClose = true, restoreScroll = true, preserveNavigation = false } = {}) {
  const shouldRefresh = refreshAfterClose && uploadSareeState.syncAfterDetailClose && uploadSareeState.active;
  uploadSareeState.detailOpen = false;
  uploadSareeState.currentRowId = null;
  uploadSareeState.currentDetailSignature = "";
  uploadSareeState.detailLastScrollTop = 0;
  uploadSareeState.detailHeaderHidden = false;
  uploadSareeState.syncAfterDetailClose = false;
  unlockUploadPageScroll({ restoreScroll });
  getUploadDetailHeader()?.classList.remove("header-hidden");
  closeUploadReviewActions();
  closeUploadImageFullscreen();
  document.getElementById("uploadDetailBackdrop").classList.remove("open");
  if (!preserveNavigation) uploadSareeState.returnNavigation = null;
  if (shouldRefresh) {
    loadRecentUploadSarees({ force: false, preserveDetail: false, silent: true });
  }
}

function setupUploadDetailHeaderAutoHide() {
  const detailBody = getUploadDetailBody();
  const detailHeader = getUploadDetailHeader();
  if (!detailBody || !detailHeader) return;
  detailBody.removeEventListener("scroll", handleUploadDetailScroll);
  detailBody.addEventListener("scroll", handleUploadDetailScroll, { passive: true });
}

function handleUploadDetailScroll(event) {
  if (!isMobileUploadView()) return;

  const detailBody = event.currentTarget;
  const currentScrollTop = Math.max(0, detailBody.scrollTop);
  const previousScrollTop = uploadSareeState.detailLastScrollTop || 0;
  const header = getUploadDetailHeader();
  if (!header) return;

  if (currentScrollTop <= 24) {
    header.classList.remove("header-hidden");
    uploadSareeState.detailHeaderHidden = false;
  } else if (currentScrollTop > previousScrollTop + 6) {
    header.classList.add("header-hidden");
    uploadSareeState.detailHeaderHidden = true;
  } else if (currentScrollTop < previousScrollTop - 6) {
    header.classList.remove("header-hidden");
    uploadSareeState.detailHeaderHidden = false;
  }

  uploadSareeState.detailLastScrollTop = currentScrollTop;
}

function uploadGeneratedPlaceholder(row, key) {
  const status = uploadStatusText(row);
  const lowerStatus = status.toLowerCase();
  if (lowerStatus === "start") return "Generation not started yet<br>Status: Start";
  if (lowerStatus === "pending") return `${key === "front" ? "Front View" : "Selected view"} not generated yet<br>Status: Pending`;
  return `${key === "front" ? "Front View" : "Selected view"} not generated yet<br>Status: ${uploadEscapeHtml(status)}`;
}

function renderMissingUploadGeneratedView(row, key) {
  const stage = document.getElementById("uploadGeneratedPreview");
  if (!stage) return;
  stage.innerHTML = `<div class="upload-empty-media">${uploadGeneratedPlaceholder(row, key)}</div>`;
  updateUploadGeneratedTabs();
}

function renderUploadGeneratedStage(row, key, url) {
  const stage = document.getElementById("uploadGeneratedPreview");
  if (!stage) return;
  const tab = UPLOAD_GENERATED_TABS.find((item) => item.key === key) || UPLOAD_GENERATED_TABS[0];
  stage.innerHTML = hasUploadImage(url)
    ? renderUploadZoomableImage(url, url, tab.label)
    : `<div class="upload-empty-media">${uploadGeneratedPlaceholder(row, key)}</div>`;
}

function getCurrentUploadGeneratedUrl() {
  const row = uploadSareeState.rows.filter(shouldShowUploadReviewRow).find((item) => Number(item.rowId) === Number(uploadSareeState.currentRowId));
  if (!row) return "";
  const key = uploadSareeState.selectedGeneratedKey || "front";
  return getUploadGeneratedImage(row, key);
}

function getCurrentUploadRow() {
  return uploadSareeState.rows.filter(shouldShowUploadReviewRow).find((row) => Number(row.rowId) === Number(uploadSareeState.currentRowId)) || null;
}

function openUploadImageFullscreen(event) {
  event?.preventDefault();
  event?.stopPropagation();

  const url = getCurrentUploadGeneratedUrl();
  if (!hasUploadImage(url)) {
    showUploadToast("Generated image is not available.", true);
    return;
  }

  const tab = UPLOAD_GENERATED_TABS.find((item) => item.key === uploadSareeState.selectedGeneratedKey);
  openUploadImageViewer(url, tab?.label || "Generated output");
}

function updateUploadViewerTransform() {
  const image = document.getElementById("uploadFullscreenImage");
  const percent = document.getElementById("uploadZoomPercent");
  const zoomOut = document.getElementById("uploadZoomOut");
  const zoomIn = document.getElementById("uploadZoomIn");
  if (image) {
    image.style.transform = `translate3d(${uploadSareeState.viewerX}px, ${uploadSareeState.viewerY}px, 0) scale(${uploadSareeState.viewerScale})`;
  }
  if (percent) percent.textContent = `${Math.round(uploadSareeState.viewerScale * 100)}%`;
  if (zoomOut) zoomOut.disabled = uploadSareeState.viewerScale <= 0.5;
  if (zoomIn) zoomIn.disabled = uploadSareeState.viewerScale >= 4;
}

function setUploadViewerScale(nextScale) {
  uploadSareeState.viewerScale = Math.min(4, Math.max(0.5, nextScale));
  uploadSareeState.viewerFit = uploadSareeState.viewerScale === 1
    && uploadSareeState.viewerX === 0
    && uploadSareeState.viewerY === 0;
  if (uploadSareeState.viewerScale <= 1) {
    uploadSareeState.viewerX = 0;
    uploadSareeState.viewerY = 0;
  }
  updateUploadViewerTransform();
}

function fitUploadViewer() {
  uploadSareeState.viewerScale = 1;
  uploadSareeState.viewerX = 0;
  uploadSareeState.viewerY = 0;
  uploadSareeState.viewerFit = true;
  updateUploadViewerTransform();
}

function openUploadImageViewer(url, label = "Upload image") {
  const viewer = document.getElementById("uploadImageFullscreen");
  const image = document.getElementById("uploadFullscreenImage");
  if (!viewer || !image) {
    console.error("Fullscreen viewer elements are missing.");
    showUploadToast("Unable to open full-screen image.", true);
    return;
  }

  image.src = url;
  image.alt = label;
  fitUploadViewer();
  viewer.classList.add("open");
  viewer.setAttribute("aria-hidden", "false");
  document.documentElement.classList.add("upload-fullscreen-open");
  document.body.classList.add("upload-fullscreen-open");
  document.getElementById("uploadFullscreenClose")?.focus({ preventScroll: true });
}

function closeUploadImageFullscreen(event) {
  event?.preventDefault();
  event?.stopPropagation();

  const viewer = document.getElementById("uploadImageFullscreen");
  const image = document.getElementById("uploadFullscreenImage");
  viewer?.classList.remove("open");
  viewer?.setAttribute("aria-hidden", "true");
  if (image) image.removeAttribute("src");
  uploadSareeState.viewerPointers.clear();
  uploadSareeState.viewerPinchDistance = 0;
  fitUploadViewer();
  document.documentElement.classList.remove("upload-fullscreen-open");
  document.body.classList.remove("upload-fullscreen-open");
}

function handleUploadZoomClick(event) {
  const trigger = event.target.closest("[data-upload-zoom-url]");
  if (!trigger) return;
  event.preventDefault();
  event.stopPropagation();
  if (trigger.dataset.uploadRetryImage === "true") {
    const image = trigger.querySelector("img[data-original-src]");
    if (image) retryUploadImage(image, { reset: true });
    return;
  }
  openUploadImageViewer(trigger.dataset.uploadZoomUrl, trigger.dataset.uploadZoomLabel || "Upload image");
}

function handleUploadViewerWheel(event) {
  if (!document.getElementById("uploadImageFullscreen")?.classList.contains("open")) return;
  event.preventDefault();
  setUploadViewerScale(uploadSareeState.viewerScale + (event.deltaY < 0 ? 0.2 : -0.2));
}

function uploadPointerDistance(points) {
  if (points.length < 2) return 0;
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

function handleUploadViewerPointerDown(event) {
  event.currentTarget.setPointerCapture?.(event.pointerId);
  uploadSareeState.viewerPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  uploadSareeState.viewerPinchDistance = uploadPointerDistance(Array.from(uploadSareeState.viewerPointers.values()));
}

function handleUploadViewerPointerMove(event) {
  const previous = uploadSareeState.viewerPointers.get(event.pointerId);
  if (!previous) return;
  const next = { x: event.clientX, y: event.clientY };
  uploadSareeState.viewerPointers.set(event.pointerId, next);
  const points = Array.from(uploadSareeState.viewerPointers.values());
  if (points.length >= 2) {
    const distance = uploadPointerDistance(points);
    if (uploadSareeState.viewerPinchDistance > 0) {
      setUploadViewerScale(uploadSareeState.viewerScale * (distance / uploadSareeState.viewerPinchDistance));
    }
    uploadSareeState.viewerPinchDistance = distance;
    return;
  }
  if (uploadSareeState.viewerScale > 1) {
    uploadSareeState.viewerX += next.x - previous.x;
    uploadSareeState.viewerY += next.y - previous.y;
    uploadSareeState.viewerFit = false;
    updateUploadViewerTransform();
  }
}

function handleUploadViewerPointerEnd(event) {
  uploadSareeState.viewerPointers.delete(event.pointerId);
  uploadSareeState.viewerPinchDistance = uploadPointerDistance(Array.from(uploadSareeState.viewerPointers.values()));
}

function handleUploadViewerKeydown(event) {
  if (event.key === "Escape" && document.getElementById("uploadImageFullscreen")?.classList.contains("open")) {
    closeUploadImageFullscreen(event);
  } else if (event.key === "Escape" && document.getElementById("uploadQuantityBackdrop")?.classList.contains("open")) {
    closeUploadQuantityEditor(event);
  }
}

function handleUploadFullscreenBackdrop(event) {
  if (event.target.id === "uploadImageFullscreen") {
    closeUploadImageFullscreen(event);
  }
}

function updateUploadGeneratedTabs() {
  document.querySelectorAll("#uploadGeneratedTabs button").forEach((button) => {
    button.classList.toggle("active", button.dataset.key === uploadSareeState.selectedGeneratedKey);
  });
}

async function selectUploadGenerated(key) {
  const row = currentUploadRow();
  if (!row) return;
  if (!getAvailableUploadGeneratedTabs(row).some((tab) => tab.key === key)) return;
  const url = getUploadGeneratedImage(row, key);
  if (!hasUploadImage(url)) {
    uploadSareeState.selectedGeneratedKey = key;
    renderMissingUploadGeneratedView(row, key);
    return;
  }
  uploadSareeState.selectedGeneratedKey = key;
  renderUploadGeneratedStage(row, key, url);
  updateUploadGeneratedTabs();
}

function selectUploadGeneratedLegacy(key) {
  uploadSareeState.selectedGeneratedKey = key;
  renderUploadDetail();
}

function isRunningOnVercelProduction() {
  return (
    window.location.hostname.endsWith(".vercel.app") ||
    window.location.hostname === "saree-review.vercel.app"
  );
}

async function createBaserowSubmissionSession(form, selectedItems, fingerprint) {
  const data = await uploadApiCall(UPLOAD_API.submissions, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      productTitle: getUploadInputValue(form, "productTitle"),
      productCode: getUploadInputValue(form, "productCode"),
      category: getUploadInputValue(form, "category"),
      files: selectedItems.map((item) => ({
        role: item.role,
        name: item.file.name,
        size: item.file.size,
        mimeType: effectiveUploadMimeType(item.file),
      })),
    }),
  });
  uploadSareeState.submissionId = data.submissionId;
  uploadSareeState.submissionFingerprint = fingerprint;
  uploadSareeState.retryCheckRequired = false;
  return data;
}

function uploadFileToBaserowForm(file, endpoint, signal, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    xhr.open("POST", endpoint, true);
    xhr.responseType = "json";
    xhr.setRequestHeader("Accept", "application/json");
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener("load", () => {
      signal?.removeEventListener("abort", abort);
      const data = xhr.response && typeof xhr.response === "object"
        ? xhr.response
        : (() => { try { return JSON.parse(xhr.responseText || "{}"); } catch { return {}; } })();
      if (xhr.status < 200 || xhr.status >= 300) {
        const error = new Error(data?.detail || data?.error || `Baserow file upload failed with ${xhr.status}.`);
        error.definitive = true;
        error.status = xhr.status;
        reject(error);
        return;
      }
      const name = String(data?.name || "").trim();
      if (!/^[A-Za-z0-9._-]{1,255}$/.test(name)) {
        reject(Object.assign(new Error("Baserow returned an invalid file reference."), { definitive: true }));
        return;
      }
      resolve({ name });
    });
    xhr.addEventListener("error", () => reject(new TypeError("The Baserow file upload could not reach storage.")));
    xhr.addEventListener("abort", () => reject(new DOMException("Upload cancelled.", "AbortError")));
    signal?.addEventListener("abort", abort, { once: true });
    const body = new FormData();
    body.append("file", file, file.name);
    xhr.send(body);
  });
}

async function trackBaserowUploadedFile(submissionId, role, name) {
  await uploadApiCall(`${UPLOAD_API.submissions}/${encodeURIComponent(submissionId)}/files/${encodeURIComponent(role)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ name }),
  });
}

async function setTrackedBaserowSubmissionStatus(status) {
  if (!uploadSareeState.submissionId) return;
  await uploadApiCall(`${UPLOAD_API.submissions}/${encodeURIComponent(uploadSareeState.submissionId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ status }),
  });
}

function buildBaserowFormPayload(form) {
  const config = uploadSareeState.publicConfig?.form || {};
  const fields = config.fields || {};
  const payload = {
    [`field_${fields.generationStatus}`]: Number(config.startOptionId),
  };
  const append = (fieldId, value) => {
    const normalized = String(value || "").trim();
    if (fieldId && normalized) payload[`field_${fieldId}`] = normalized;
  };
  append(fields.productTitle, getUploadInputValue(form, "productTitle"));
  append(fields.productCode, getUploadInputValue(form, "productCode"));
  append(fields.category, getUploadInputValue(form, "category"));
  const rawPrice = String(getUploadInputValue(form, "price") || "").trim();
  if (fields.price && rawPrice) {
    const price = Number(rawPrice);
    if (!Number.isFinite(price)) throw Object.assign(new Error("Price must be a valid number."), { definitive: true });
    payload[`field_${fields.price}`] = price;
  }
  append(fields.descriptions, getUploadInputValue(form, "descriptions"));
  append(fields.commentNotes, getUploadInputValue(form, "commentNotes"));

  UPLOAD_REFERENCE_ROLES.forEach((role) => {
    const reference = uploadSareeState.uploadedBaserowFiles[role];
    if (fields[role] && reference?.name) payload[`field_${fields[role]}`] = [{ name: reference.name }];
  });
  return payload;
}

async function submitBaserowFormRow(form) {
  const endpoint = uploadSareeState.publicConfig?.form?.endpoints?.submit;
  if (!endpoint) throw Object.assign(new Error("Baserow Form submission is not configured."), { definitive: true });
  const timeoutId = setTimeout(() => {
    uploadSareeState.uploadTimedOut = true;
    uploadSareeState.uploadAbortController?.abort();
  }, uploadSareeState.clientTimeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(buildBaserowFormPayload(form)),
      signal: uploadSareeState.uploadAbortController.signal,
      credentials: "omit",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.detail || data?.error || `Baserow Form submission failed with ${response.status}.`);
      error.definitive = response.status >= 400 && response.status < 500;
      error.status = response.status;
      throw error;
    }
    if (!Number.isInteger(Number(data?.row_id))) {
      throw new TypeError("Baserow did not return a confirmed row ID.");
    }
    return { ...data, rowId: Number(data.row_id) };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function resolveTrackedBaserowSubmission() {
  const submissionId = uploadSareeState.submissionId;
  if (!submissionId) return { status: "inconclusive", reason: "SUBMISSION_NOT_TRACKED" };
  const data = await loadRecentUploadSarees({
    force: true,
    preserveDetail: true,
    silent: true,
    submissionId,
  });
  const result = data?.submissionCheck || { status: "inconclusive", reason: "SUBMISSION_CHECK_UNAVAILABLE" };
  uploadSareeState.retryCheckRequired = result.status === "inconclusive";
  return result;
}

async function removeTrackedBaserowSubmission() {
  const submissionId = uploadSareeState.submissionId;
  if (!submissionId) return;
  try {
    await uploadApiCall(`${UPLOAD_API.submissions}/${encodeURIComponent(submissionId)}`, { method: "DELETE" });
  } catch (error) {
    console.warn("Committed upload tracking cleanup failed", { message: error.message });
  }
}

async function submitUploadSaree(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (uploadSareeState.isUploading) return;
  if (uploadSareeState.isConverting) {
    showUploadToast("Please wait for HEIC conversion to finish.", true);
    return;
  }
  clearUploadError();

  const config = uploadSareeState.publicConfig || {};
  if (!config.providerReady) {
    showUploadToast("Large-image storage is not configured on the server. Upload is temporarily unavailable.", true);
    setUploadMessage("Large-image storage is not configured on the server. Upload is temporarily unavailable.", true);
    return;
  }

  if (config.storageProvider === "baserow_form") {
    return submitUploadSareeBaserowForm(form);
  }

  if (config.storageProvider === "vercel_blob" && config.directStorageEnabled) {
    return submitUploadSareeDirect(form);
  }

  showUploadToast("The selected upload provider is not available.", true);
}

async function completeUploadSuccess(form, selectedItems) {
  const uploadedCount = selectedItems.length;
  const title = "Upload completed successfully!";
  const message = `${uploadedCount} reference image${uploadedCount === 1 ? "" : "s"} saved to Baserow. Generation Status set to Start.`;

  showUploadProgress("Upload complete", 100);
  showUploadSuccess({ title, message });
  showUploadToast(`${title} ${message}`);
  try {
    await loadRecentUploadSarees({ force: true, preserveDetail: true, silent: true });
  } catch (error) {
    console.warn("Recent uploads refresh failed after successful upload", { message: error.message });
  }
  form.reset();
  clearUploadFilePreviews();
  uploadSareeState.uploadedBlobPaths = [];
  resetBaserowSubmissionClientState();
  updateUploadSyncTime();
}

async function submitUploadSareeLegacy(form) {
  const submitBtn = document.getElementById("uploadSubmitBtn");

  try {
    const selectedItems = validateSelectedUploadFiles();
    const sareeFile = uploadSareeState.sareeFile;
    if (isRunningOnVercelProduction() && sareeFile.size > 4 * 1024 * 1024) {
      throw new Error("Large-image storage is not configured on the server. Upload is temporarily unavailable.");
    }
    showUploadProgress("Validating images...", 0);
    uploadSareeState.isUploading = true;
    uploadSareeState.uploadCancelled = false;
    uploadSareeState.uploadTimedOut = false;
    uploadSareeState.uploadAbortController = new AbortController();
    uploadSareeState.uploadedBlobPaths = [];
    uploadSareeState.fileProgress = { saree: 0, blouse: 0, pallu: 0, border: 0 };
    uploadSareeState.submitting = true;
    setUploadControlsDisabled(true);
    setUploadMessage("Uploading...");
    const formData = new FormData(form);
    UPLOAD_REFERENCE_ROLES.forEach((role) => formData.delete(getUploadRoleConfig(role).inputName));
    selectedItems.forEach((item) => formData.append(getUploadRoleConfig(item.role).inputName, item.file, item.file.name));
    await uploadApiCall(UPLOAD_API.upload, {
      method: "POST",
      body: formData,
    });

    await completeUploadSuccess(form, selectedItems);
  } catch (error) {
    if (error?.name === "AbortError") {
      setUploadMessage("Upload cancelled.", true);
      showUploadToast("Upload cancelled.", true);
    } else {
      setUploadMessage(error.message || "Upload failed.", true);
      showUploadToast(error.message || "Upload failed.", true);
    }
    await cleanupUploadedBlobPaths(uploadSareeState.uploadedBlobPaths);
  } finally {
    uploadSareeState.isUploading = false;
    uploadSareeState.submitting = false;
    uploadSareeState.uploadAbortController = null;
    setUploadControlsDisabled(false);
    if (submitBtn) submitBtn.disabled = false;
    hideUploadProgressAfterDelay();
  }
}

async function submitUploadSareeBaserowForm(form) {
  const submitBtn = document.getElementById("uploadSubmitBtn");
  let selectedItems = [];
  let stage = "validating";
  let completed = false;

  try {
    selectedItems = validateSelectedUploadFiles();
    const fingerprint = uploadSubmissionFingerprint(form, selectedItems);
    if (uploadSareeState.submissionId && uploadSareeState.submissionFingerprint !== fingerprint) {
      resetBaserowSubmissionClientState();
    }

    uploadSareeState.isUploading = true;
    uploadSareeState.uploadCancelled = false;
    uploadSareeState.uploadTimedOut = false;
    uploadSareeState.uploadAbortController = new AbortController();
    uploadSareeState.fileProgress = { saree: 0, blouse: 0, pallu: 0, border: 0 };
    uploadSareeState.submitting = true;
    setUploadControlsDisabled(true);

    if (uploadSareeState.retryCheckRequired) {
      showUploadProgress("Checking whether the previous submission created a row...", 95);
      const previousResult = await resolveTrackedBaserowSubmission();
      if (previousResult.status === "found") {
        completed = true;
        await completeUploadSuccess(form, selectedItems);
        return;
      }
      if (previousResult.status !== "absent") {
        throw Object.assign(new Error("The previous result is still unknown. No retry was sent; verify the tracked upload before retrying."), { noRetry: true });
      }
      uploadSareeState.retryCheckRequired = false;
    }

    if (!uploadSareeState.submissionId) {
      showUploadProgress("Creating a tracked upload session...", 0);
      await createBaserowSubmissionSession(form, selectedItems, fingerprint);
    }

    stage = "uploading";
    const endpoint = uploadSareeState.publicConfig?.form?.endpoints?.uploadFile;
    if (!endpoint) throw Object.assign(new Error("Baserow Form file upload is not configured."), { definitive: true });
    const uploadFiles = Object.fromEntries(selectedItems.map((item) => [item.role, item.file]));
    for (const item of selectedItems) {
      if (uploadSareeState.uploadCancelled) throw new DOMException("Upload cancelled.", "AbortError");
      if (uploadSareeState.uploadedBaserowFiles[item.role]?.name) {
        uploadSareeState.fileProgress[item.role] = 100;
        continue;
      }
      const timeoutId = setTimeout(() => {
        uploadSareeState.uploadTimedOut = true;
        uploadSareeState.uploadAbortController?.abort();
      }, uploadSareeState.clientTimeoutMs);
      let reference;
      try {
        reference = await uploadFileToBaserowForm(
          item.file,
          endpoint,
          uploadSareeState.uploadAbortController.signal,
          (percentage) => {
            uploadSareeState.fileProgress[item.role] = percentage;
            const totalPercent = calculateTotalUploadProgress(uploadFiles, uploadSareeState.fileProgress);
            showUploadProgress(`Uploading ${item.label}: ${percentage}%`, totalPercent);
          },
        );
      } finally {
        clearTimeout(timeoutId);
      }
      await trackBaserowUploadedFile(uploadSareeState.submissionId, item.role, reference.name);
      uploadSareeState.uploadedBaserowFiles[item.role] = reference;
      uploadSareeState.fileProgress[item.role] = 100;
    }

    stage = "submitting";
    showUploadProgress("Creating the Baserow row...", 96);
    await setTrackedBaserowSubmissionStatus("submitting");
    await submitBaserowFormRow(form);
    await removeTrackedBaserowSubmission();
    completed = true;
    await completeUploadSuccess(form, selectedItems);
  } catch (error) {
    if (stage === "submitting" && !error?.definitive) {
      uploadSareeState.retryCheckRequired = true;
      try {
        await setTrackedBaserowSubmissionStatus("unknown");
      } catch (trackingError) {
        console.warn("Unable to mark ambiguous Baserow submission", { message: trackingError.message });
      }
      showUploadProgress("Confirming the submission result...", 97);
      try {
        const result = await resolveTrackedBaserowSubmission();
        if (result.status === "found") {
          completed = true;
          await completeUploadSuccess(form, selectedItems);
          return;
        }
        if (result.status === "absent") {
          try {
            await setTrackedBaserowSubmissionStatus("retry_permitted");
          } catch (trackingError) {
            console.warn("Unable to mark Baserow retry permission", { message: trackingError.message });
          }
          setUploadMessage("No matching row was found. The uploaded files were retained and a retry is now permitted.", true);
          showUploadToast("No matching row was found. Retry is permitted.", true);
          return;
        }
      } catch (verificationError) {
        console.warn("Ambiguous Baserow submission verification failed", { message: verificationError.message });
      }
      uploadSareeState.retryCheckRequired = true;
      setUploadMessage("The submission result is unknown. No automatic retry was sent. Use Upload again to re-check before any retry.", true);
      showUploadToast("Submission result unknown; no retry was sent.", true);
      return;
    }

    if (uploadSareeState.uploadTimedOut) {
      setUploadMessage("The file upload timed out. Uploaded file references were retained for a safe retry.", true);
      showUploadToast("The file upload timed out.", true);
    } else if (error?.name === "AbortError" || uploadSareeState.uploadCancelled) {
      setUploadMessage("Upload cancelled. Completed file uploads remain tracked for cleanup or retry.", true);
      showUploadToast("Upload cancelled.", true);
    } else {
      setUploadMessage(error.message || "Upload failed.", true);
      showUploadToast(error.message || "Upload failed.", true);
    }
  } finally {
    uploadSareeState.isUploading = false;
    uploadSareeState.submitting = false;
    uploadSareeState.uploadAbortController = null;
    setUploadControlsDisabled(false);
    if (submitBtn) submitBtn.disabled = false;
    if (!completed) hideUploadProgressAfterDelay();
  }
}

async function submitUploadSareeDirect(form) {
  const submitBtn = document.getElementById("uploadSubmitBtn");

  try {
    const selectedItems = validateSelectedUploadFiles();
    showUploadProgress("Validating images...", 0);

    uploadSareeState.isUploading = true;
    uploadSareeState.uploadCancelled = false;
    uploadSareeState.uploadTimedOut = false;
    uploadSareeState.uploadAbortController = new AbortController();
    uploadSareeState.uploadedBlobPaths = [];
    uploadSareeState.fileProgress = { saree: 0, blouse: 0, pallu: 0, border: 0 };
    uploadSareeState.submitting = true;
    setUploadControlsDisabled(true);

    showUploadProgress("Preparing secure upload...", 0);
    const uploaded = {};
    const uploadFiles = Object.fromEntries(selectedItems.map((item) => [item.role, item.file]));
    for (const item of selectedItems) {
      if (uploadSareeState.uploadCancelled) {
        throw new DOMException("Upload cancelled.", "AbortError");
      }
      if (typeof window.uploadSareeFileToBlob !== "function") {
        throw new Error("Direct large-image upload is not active.");
      }
      const timeoutId = setTimeout(() => {
        uploadSareeState.uploadTimedOut = true;
        uploadSareeState.uploadAbortController?.abort();
      }, uploadSareeState.clientTimeoutMs);
      let blob;
      try {
        blob = await window.uploadSareeFileToBlob({
          file: item.file,
          role: item.role,
          signal: uploadSareeState.uploadAbortController.signal,
          onProgress: (progress) => {
            uploadSareeState.fileProgress[item.role] = progress.percentage;
            const totalPercent = calculateTotalUploadProgress(uploadFiles, uploadSareeState.fileProgress);
            showUploadProgress(`Uploading ${item.label}: ${progress.percentage}%`, totalPercent);
          },
        });
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        throw new Error(directUploadErrorMessage(error, item.label));
      } finally {
        clearTimeout(timeoutId);
      }
      uploaded[item.role] = {
        url: blob.url,
        pathname: blob.pathname,
        contentType: blob.contentType,
        size: item.file.size,
      };
      uploadSareeState.uploadedBlobPaths.push(blob.pathname);
    }

    showUploadProgress("Saving to Baserow...", 96);
    try {
      await uploadApiCall(UPLOAD_API.finalize, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          productTitle: getUploadInputValue(form, "productTitle"),
          productCode: getUploadInputValue(form, "productCode"),
          category: getUploadInputValue(form, "category"),
          price: getUploadInputValue(form, "price"),
          descriptions: getUploadInputValue(form, "descriptions"),
          commentNotes: getUploadInputValue(form, "commentNotes"),
          files: uploaded,
        }),
      });
    } catch (error) {
      if (error.message?.startsWith("Maximum ") || error.message === "Please upload Saree Image.") throw error;
      throw new Error("The reference images uploaded, but Baserow could not create the row. Temporary files are being cleaned up.");
    }

    await completeUploadSuccess(form, selectedItems);
  } catch (error) {
    if (uploadSareeState.uploadTimedOut) {
      setUploadMessage("The upload timed out. Check your connection and try again.", true);
      showUploadToast("The upload timed out. Check your connection and try again.", true);
    } else if (error?.name === "AbortError" || uploadSareeState.uploadCancelled) {
      setUploadMessage("Upload cancelled.", true);
      showUploadToast("Upload cancelled.", true);
    } else {
      setUploadMessage(error.message || "Upload failed.", true);
      showUploadToast(error.message || "Upload failed.", true);
    }
    await cleanupUploadedBlobPaths(uploadSareeState.uploadedBlobPaths);
  } finally {
    uploadSareeState.isUploading = false;
    uploadSareeState.submitting = false;
    uploadSareeState.uploadAbortController = null;
    setUploadControlsDisabled(false);
    if (submitBtn) submitBtn.disabled = false;
    hideUploadProgressAfterDelay();
  }
}

function setUploadActionLoading(loading, row = null) {
  const approveAllowed = Boolean(row) && canApproveUploadReviewRow(row);
  const buttons = [
    ...["uploadRejectButton", "uploadRequestChangesButton", "uploadApproveButton"]
      .map((id) => document.getElementById(id)),
    ...document.querySelectorAll(".upload-detail-footer button"),
  ].filter(Boolean);
  buttons.forEach((button) => {
    const isApprove = button.id === "uploadApproveButton" || button.id === "uploadApproveBtn";
    button.disabled = Boolean(loading) || (isApprove && !approveAllowed);
    button.setAttribute("aria-busy", loading ? "true" : "false");
  });
}

async function updateUploadStatus(action, event) {
  event?.preventDefault();
  event?.stopPropagation();

  const row = currentUploadRow();
  if (!row) {
    showUploadToast("No upload row selected.", true);
    return;
  }

  if (action === "approve" && !canApproveUploadReviewRow(row)) {
    showUploadToast("Approve requires a Pending row with Front View, or a Completed row.", true);
    return;
  }

  const feedback = getUploadFeedbackValue();
  if (action === "request-changes" && !feedback.trim()) {
    showUploadToast("Please enter feedback for requested changes.", true);
    return;
  }

  setUploadActionLoading(true, row);
  try {
    const approvedRowId = row.rowId;
    if (!uploadSareeState.returnNavigation || Number(uploadSareeState.returnNavigation.rowId) !== Number(approvedRowId)) {
      captureUploadReturnNavigation(approvedRowId);
    }
    const result = await uploadApiCall(`/api/upload-saree/${row.rowId}/${action}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ feedback, comment: feedback, note: feedback }),
    });
    if (action === "approve" && result.generationStatus !== "Draft") {
      throw new Error("The server did not confirm the Draft approval status.");
    }
    closeUploadReviewActions();
    closeUploadImageFullscreen();
    closeUploadDetail({ refreshAfterClose: false, restoreScroll: false, preserveNavigation: true });
    uploadSareeState.rows = uploadSareeState.rows.filter((item) => Number(item.rowId) !== Number(approvedRowId));
    uploadSareeState.lastRowsSignature = "";
    renderUploadRows({ preserveViewport: false });
    restoreUploadNavigationAfterMutation();
    showUploadToast(action === "approve"
      ? "Saree approved successfully."
      : action === "reject"
        ? "Rejected successfully."
        : "Changes requested successfully.");
    await loadRecentUploadSarees({ force: true, preserveDetail: false, silent: true });
  } catch (error) {
    console.error(`Upload ${action} failed:`, error);
    const message = action === "approve" && error.message !== "The Draft status is not configured in the Upload Saree Baserow table."
      ? "Unable to approve the saree. Generation Status was not updated."
      : error.message || `${action} failed.`;
    setUploadMessage(message, true);
    showUploadToast(message, true);
  } finally {
    setUploadActionLoading(false, currentUploadRow());
  }
}

function approveUploadSaree(event) {
  return runUploadUiAction(() => updateUploadStatus("approve", event), "Unable to approve the saree.");
}

function approveUploadSareeFromCard(rowId, event) {
  event?.preventDefault();
  event?.stopPropagation();
  uploadSareeState.selectedRowId = rowId;
  return runUploadUiAction(() => updateUploadStatus("approve", event), "Unable to approve the saree.");
}

function rejectUploadSaree(event) {
  return runUploadUiAction(() => updateUploadStatus("reject", event), "Unable to reject the saree.");
}

function requestUploadChanges(event) {
  return runUploadUiAction(() => updateUploadStatus("request-changes", event), "Unable to request changes.");
}

function getUploadFeedbackValue() {
  const sheetFeedback = document.getElementById("uploadApprovalNote")?.value || "";
  const footerFeedback = document.getElementById("uploadFeedbackInput")?.value || "";
  return isMobileUploadView() ? sheetFeedback : footerFeedback;
}

function openUploadReviewActions(event) {
  event?.preventDefault();
  event?.stopPropagation();

  const backdrop = document.getElementById("uploadReviewActionsBackdrop");
  if (!backdrop) {
    console.error("Review Actions backdrop is missing.");
    showUploadToast("Unable to open review actions.", true);
    return;
  }
  const footerFeedback = document.getElementById("uploadFeedbackInput")?.value || "";
  const sheetFeedback = document.getElementById("uploadApprovalNote");
  if (sheetFeedback && !sheetFeedback.value) sheetFeedback.value = footerFeedback;
  backdrop.classList.add("open");
  backdrop.setAttribute("aria-hidden", "false");
}

function closeUploadReviewActions(event) {
  event?.preventDefault();
  event?.stopPropagation();

  const backdrop = document.getElementById("uploadReviewActionsBackdrop");
  backdrop?.classList.remove("open");
  backdrop?.setAttribute("aria-hidden", "true");
}

function handleUploadReviewActionsBackdrop(event) {
  if (event.target.id === "uploadReviewActionsBackdrop") {
    closeUploadReviewActions(event);
  }
}

function approveUploadCurrent(event) {
  return approveUploadSaree(event);
}

function rejectUploadCurrent(event) {
  return rejectUploadSaree(event);
}

function requestChangesUploadCurrent(event) {
  return requestUploadChanges(event);
}

function bindUploadDetailActions() {
  const bindings = [
    ["uploadFullscreenButton", openUploadImageFullscreen],
    ["uploadReviewActionsButton", openUploadReviewActions],
    ["uploadFullscreenClose", closeUploadImageFullscreen],
    ["uploadReviewActionsClose", closeUploadReviewActions],
    ["uploadRejectButton", rejectUploadCurrent],
    ["uploadRequestChangesButton", requestChangesUploadCurrent],
    ["uploadApproveButton", approveUploadCurrent],
  ];

  bindings.forEach(([id, handler]) => {
    const button = document.getElementById(id);
    if (!button) return;
    button.type = "button";
    button.onclick = handler;
  });
}

function setUploadSareeActive(active) {
  uploadSareeState.active = active;
  if (active) {
    if (!uploadSareeState.loaded) {
      uploadSareeState.loaded = true;
      loadUploadStatus().finally(() => loadRecentUploadSarees({ force: false, preserveDetail: true, silent: true }));
    } else {
      loadRecentUploadSarees({ force: false, preserveDetail: true, silent: true });
    }
    startUploadAutoSync();
  } else {
    stopUploadAutoSync();
  }
}

function startUploadAutoSync() {
  stopUploadAutoSync();
  uploadSareeState.syncTimer = setInterval(() => {
    if (!uploadSareeState.active) return;
    if (document.visibilityState !== "visible") return;
    if (uploadSareeState.submitting) return;
    if (uploadSareeState.detailOpen && isMobileUploadView()) {
      uploadSareeState.syncAfterDetailClose = true;
      return;
    }
    loadRecentUploadSarees({ force: false, preserveDetail: true, silent: true });
  }, 15000);
}

function handleUploadVisibilityChange() {
  clearTimeout(uploadSareeState.visibilityRefreshTimer);
  if (document.visibilityState !== "visible" || !uploadSareeState.active) return;
  uploadSareeState.visibilityRefreshTimer = setTimeout(() => {
    loadRecentUploadSarees({ force: false, preserveDetail: true, silent: true });
  }, 300);
}

function stopUploadAutoSync() {
  if (uploadSareeState.syncTimer) {
    clearInterval(uploadSareeState.syncTimer);
    uploadSareeState.syncTimer = null;
  }
}

function clearUploadRoleFile(role, { revokePreview = true, render = true, clearMessage = true } = {}) {
  if (!UPLOAD_REFERENCE_ROLES.includes(role)) return;
  resetBaserowSubmissionClientState();
  uploadSareeState.conversionIds[role] += 1;
  setUploadRoleConverting(role, false);
  const previewUrl = uploadSareeState.previewUrls?.[role];
  if (revokePreview && previewUrl) URL.revokeObjectURL(previewUrl);
  uploadSareeState.files[role] = null;
  uploadSareeState[`${role}File`] = null;
  uploadSareeState.previewUrls[role] = null;
  uploadSareeState.fileProgress[role] = 0;
  const input = getUploadRoleInput(role);
  if (input) input.value = "";
  syncUploadConversionControls();
  if (render) renderUploadRolePreview(role);
  if (clearMessage) clearUploadError();
}

function clearUploadFilePreviews() {
  UPLOAD_REFERENCE_ROLES.forEach((role) => clearUploadRoleFile(role, { render: false, clearMessage: false }));
  document.querySelectorAll(".upload-file-preview").forEach((preview) => {
    preview.innerHTML = "";
  });
}

function populateUploadCategorySelect(categoryGroups) {
  const select = document.getElementById("uploadCategory");
  if (!select || select.dataset.categoriesLoaded === "true" || !Array.isArray(categoryGroups)) return;

  const groups = categoryGroups.filter((group) =>
    group &&
    typeof group.label === "string" &&
    Array.isArray(group.options)
  );
  const categories = groups.flatMap((group) => group.options);
  const normalizedCategories = categories.map((value) => String(value || "").trim().toLowerCase());
  if (new Set(normalizedCategories).size !== normalizedCategories.length) {
    console.error("Duplicate upload categories detected.");
    return;
  }

  const selectedValue = select.value;
  select.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select category";
  select.appendChild(placeholder);

  groups.forEach((group) => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = group.label;
    group.options.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      optgroup.appendChild(option);
    });
    select.appendChild(optgroup);
  });

  if (categories.includes(selectedValue)) select.value = selectedValue;
  select.dataset.categoriesLoaded = "true";
}

function enhanceUploadFileInputs() {
  document.querySelectorAll(".upload-file input[type='file']").forEach((input) => {
    const label = input.closest(".upload-file");
    if (!label || label.dataset.enhanced === "true") return;
    label.dataset.enhanced = "true";

    const title = document.createElement("div");
    title.className = "upload-file-title";
    title.textContent = label.childNodes[0]?.textContent?.trim() || "Image";
    if (label.childNodes[0]?.nodeType === Node.TEXT_NODE) {
      label.childNodes[0].textContent = "";
    }

    const icon = document.createElement("div");
    icon.className = "upload-file-icon";
    icon.textContent = "+";

    const browse = document.createElement("button");
    browse.type = "button";
    browse.className = "upload-btn";
    browse.dataset.uploadBrowseRole = input.name;
    browse.textContent = "Browse";
    browse.addEventListener("click", (event) => {
      event.preventDefault();
      input.click();
    });

    const hint = document.createElement("div");
    hint.className = "upload-file-hint";
    hint.textContent = "Drag and drop or choose JPG, JPEG, PNG, WEBP, HEIC, HEIF";

    const preview = document.createElement("div");
    preview.className = "upload-file-preview";

    label.insertBefore(title, input);
    label.insertBefore(icon, input);
    label.insertBefore(browse, input);
    label.insertBefore(hint, input);
    label.appendChild(preview);

    ["dragenter", "dragover"].forEach((eventName) => {
      label.addEventListener(eventName, (event) => {
        event.preventDefault();
        label.classList.add("dragover");
      });
    });
    ["dragleave", "drop"].forEach((eventName) => {
      label.addEventListener(eventName, (event) => {
        event.preventDefault();
        label.classList.remove("dragover");
      });
    });
    label.addEventListener("drop", (event) => {
      if (event.dataTransfer?.files?.length) {
        const transfer = new DataTransfer();
        transfer.items.add(event.dataTransfer.files[0]);
        input.files = transfer.files;
        void renderUploadFilePreview(input);
      }
    });
    input.addEventListener("change", () => void renderUploadFilePreview(input));
  });
}

async function renderUploadFilePreview(input) {
  const file = input.files?.[0];
  const role = UPLOAD_REFERENCE_ROLES.find((candidate) => getUploadRoleConfig(candidate).inputName === input.name);
  if (!role) return;
  if (!file) {
    clearUploadRoleFile(role);
    return;
  }
  try {
    await setUploadRoleFile(role, file);
  } catch (error) {
    input.value = "";
    setUploadMessage(error.message || "Unable to select image.", true);
    showUploadToast(error.message || "Unable to select image.", true);
  }
}

function setPreparedUploadRoleFile(role, originalFile, uploadFile, convertedFromHeic, conversionId, diagnostics = {}) {
  if (uploadSareeState.conversionIds[role] !== conversionId) return false;
  validateStoredUploadImageFile(uploadFile);
  const previousPreviewUrl = uploadSareeState.previewUrls?.[role];
  if (previousPreviewUrl) URL.revokeObjectURL(previousPreviewUrl);
  uploadSareeState.files[role] = {
    originalFile,
    uploadFile,
    convertedFromHeic,
    status: "ready",
    sourceDimensions: diagnostics.sourceDimensions || null,
    dimensions: diagnostics.dimensions || null,
  };
  uploadSareeState[`${role}File`] = uploadFile;
  uploadSareeState.previewUrls[role] = URL.createObjectURL(uploadFile);
  uploadSareeState.fileProgress[role] = 0;
  syncUploadConversionControls();
  renderUploadRolePreview(role);
  return true;
}

async function setUploadRoleFile(role, file) {
  const config = getUploadRoleConfig(role);
  if (!config) throw new Error("Invalid reference image role.");
  validateUploadImageFile(file, config.label);
  resetBaserowSubmissionClientState();

  const conversionId = uploadSareeState.conversionIds[role] + 1;
  uploadSareeState.conversionIds[role] = conversionId;
  const previousPreviewUrl = uploadSareeState.previewUrls?.[role];
  if (previousPreviewUrl) URL.revokeObjectURL(previousPreviewUrl);
  uploadSareeState.previewUrls[role] = null;
  uploadSareeState[`${role}File`] = null;
  uploadSareeState.fileProgress[role] = 0;

  if (!isHeicUploadFile(file) || uploadSareeState.storageProvider === "baserow_form") {
    setUploadRoleConverting(role, false);
    setPreparedUploadRoleFile(role, file, file, false, conversionId);
    clearUploadError();
    return;
  }

  uploadSareeState.files[role] = {
    originalFile: file,
    uploadFile: null,
    convertedFromHeic: true,
    status: "preparing",
  };
  uploadSareeState.conversionWorkCount += 1;
  setUploadRoleConverting(role, true);
  setUploadMessage("Preparing HEIC image...");
  renderUploadRolePreview(role);

  const convertSelection = async () => {
    if (uploadSareeState.conversionIds[role] !== conversionId) return;
    const converter = window.uploadSareeHeic?.convertHeicToLosslessPng;
    if (typeof converter !== "function") {
      throw new Error("HEIC conversion is not available. Please refresh and try again.");
    }
    uploadSareeState.files[role].status = "converting";
    setUploadMessage("Converting HEIC to lossless PNG...");
    renderUploadRolePreview(role);

    const conversion = await converter(file, {
      maxPixels: uploadSareeState.maxHeicDecodePixels,
      maxBytes: getMaxUploadSizeBytes(),
      maxSizeMb: uploadSareeState.maxFileSizeMb,
    });
    if (uploadSareeState.conversionIds[role] !== conversionId) return;
    setPreparedUploadRoleFile(
      role,
      conversion.originalFile,
      conversion.uploadFile,
      conversion.convertedFromHeic,
      conversionId,
      conversion,
    );
    setUploadMessage("Ready to upload");
  };

  uploadSareeState.conversionQueue = uploadSareeState.conversionQueue
    .catch(() => undefined)
    .then(convertSelection)
    .catch((error) => {
      if (uploadSareeState.conversionIds[role] !== conversionId) return;
      const preserveSelection = error?.code === "PNG_TOO_LARGE";
      uploadSareeState.files[role] = preserveSelection ? {
        originalFile: file,
        uploadFile: null,
        convertedFromHeic: true,
        status: "error",
        errorMessage: error.message,
        sourceDimensions: error.sourceDimensions || null,
        dimensions: error.dimensions || null,
        convertedSizeBytes: error.convertedSizeBytes || null,
      } : null;
      uploadSareeState[`${role}File`] = null;
      uploadSareeState.previewUrls[role] = null;
      const input = getUploadRoleInput(role);
      if (input && !preserveSelection) input.value = "";
      renderUploadRolePreview(role);
      setUploadMessage(error.message || "HEIC conversion failed. The original file has not been modified.", true);
      showUploadToast(error.message || "HEIC conversion failed. The original file has not been modified.", true);
    })
    .finally(() => {
      finishUploadConversionWork();
      if (uploadSareeState.conversionIds[role] === conversionId) {
        setUploadRoleConverting(role, false);
        renderUploadRolePreview(role);
      }
    });

  await uploadSareeState.conversionQueue;
}

function renderUploadRolePreview(role) {
  const config = getUploadRoleConfig(role);
  const input = getUploadRoleInput(role);
  const preview = input?.closest(".upload-file")?.querySelector(".upload-file-preview");
  if (!config || !preview) return;
  const selection = uploadSareeState.files[role];
  const file = selection?.uploadFile;
  const originalFile = selection?.originalFile;
  const url = uploadSareeState.previewUrls?.[role];
  preview.innerHTML = "";

  if (selection?.status === "preparing" || selection?.status === "converting") {
    const statusText = selection.status === "preparing" ? "Preparing HEIC image..." : "Converting HEIC to lossless PNG...";
    const originalSizeMb = (originalFile.size / (1024 * 1024)).toFixed(2);
    preview.innerHTML = `
      <div class="upload-selected-file upload-selected-file-converting" role="status" aria-live="polite">
        <span class="upload-conversion-spinner" aria-hidden="true"></span>
        <div>
          <strong>${uploadEscapeHtml(originalFile.name)}</strong>
          <span>${originalSizeMb} MB</span>
          <span>${uploadEscapeHtml(statusText)}</span>
        </div>
      </div>
    `;
    return;
  }

  if (selection?.status === "error" && originalFile instanceof File) {
    preview.innerHTML = `
      <div class="upload-selected-file upload-selected-file-error" role="alert">
        <span class="upload-file-error-icon" aria-hidden="true">!</span>
        <div>
          <strong>${uploadEscapeHtml(originalFile.name)}</strong>
          <span>${uploadEscapeHtml(selection.errorMessage || "HEIC conversion failed. The original file has not been modified.")}</span>
        </div>
        <button class="upload-icon-btn" type="button">Remove</button>
      </div>
    `;
    preview.querySelector(".upload-icon-btn")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      clearUploadRoleFile(role);
    });
    return;
  }

  if (!(file instanceof File) || !(originalFile instanceof File) || !url) return;
  const uploadSizeMb = (file.size / (1024 * 1024)).toFixed(2);
  const preserveOriginalHeic = uploadSareeState.storageProvider === "baserow_form" && isHeicUploadFile(file);
  const dimensions = selection.dimensions;
  const dimensionText = dimensions?.width && dimensions?.height
    ? `<span>Full resolution: ${dimensions.width} x ${dimensions.height}px</span>`
    : "";
  const fileDetails = selection.convertedFromHeic
    ? `<span>Original: ${uploadEscapeHtml(originalFile.name)} - ${(originalFile.size / (1024 * 1024)).toFixed(2)} MB</span>
       <span>Upload: ${uploadEscapeHtml(file.name)} - ${uploadSizeMb} MB</span>
       ${dimensionText}
       <span>Full-resolution PNG created with no additional lossy compression.</span>`
    : `<span>${uploadSizeMb} MB</span>`;
  preview.innerHTML = `
    <div class="upload-selected-file">
      ${preserveOriginalHeic
        ? `<div class="upload-file-error-icon" aria-hidden="true">HEIC</div>`
        : renderUploadZoomableImage(url, url, file.name)}
      <div>
        <strong>${uploadEscapeHtml(originalFile.name)}</strong>
        ${fileDetails}
        ${preserveOriginalHeic ? "<span>Original HEIC/HEIF file will be uploaded without conversion.</span>" : ""}
      </div>
      <button class="upload-icon-btn" type="button">Remove</button>
    </div>
  `;
  preview.querySelector(".upload-icon-btn")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    clearUploadRoleFile(role);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("uploadSareeForm");
  if (form) {
    form.addEventListener("submit", (event) => {
      void runUploadUiAction(() => submitUploadSaree(event), "Upload failed. Please retry.");
    });
  }
  document.getElementById("uploadCancelButton")?.addEventListener("click", cancelUploadSaree);
  bindUploadDetailActions();
  enhanceUploadFileInputs();
  document.addEventListener("click", handleUploadZoomClick);
  document.addEventListener("keydown", handleUploadViewerKeydown);
  document.addEventListener("visibilitychange", handleUploadVisibilityChange);
  document.getElementById("uploadQuantityForm")?.addEventListener("submit", (event) => {
    void runUploadUiAction(() => saveUploadQuantity(event), "Unable to update quantity.");
  });
  document.getElementById("uploadZoomOut")?.addEventListener("click", () => setUploadViewerScale(uploadSareeState.viewerScale - 0.25));
  document.getElementById("uploadZoomIn")?.addEventListener("click", () => setUploadViewerScale(uploadSareeState.viewerScale + 0.25));
  document.getElementById("uploadZoomFit")?.addEventListener("click", fitUploadViewer);
  const viewerStage = document.getElementById("uploadFullscreenStage");
  viewerStage?.addEventListener("wheel", handleUploadViewerWheel, { passive: false });
  viewerStage?.addEventListener("pointerdown", handleUploadViewerPointerDown);
  viewerStage?.addEventListener("pointermove", handleUploadViewerPointerMove);
  viewerStage?.addEventListener("pointerup", handleUploadViewerPointerEnd);
  viewerStage?.addEventListener("pointercancel", handleUploadViewerPointerEnd);
});

window.openUploadImageFullscreen = openUploadImageFullscreen;
window.closeUploadImageFullscreen = closeUploadImageFullscreen;
window.openUploadReviewActions = openUploadReviewActions;
window.closeUploadReviewActions = closeUploadReviewActions;
window.handleUploadFullscreenBackdrop = handleUploadFullscreenBackdrop;
window.handleUploadReviewActionsBackdrop = handleUploadReviewActionsBackdrop;
window.approveUploadCurrent = approveUploadCurrent;
window.rejectUploadCurrent = rejectUploadCurrent;
window.requestChangesUploadCurrent = requestChangesUploadCurrent;
window.approveUploadSaree = approveUploadSaree;
window.rejectUploadSaree = rejectUploadSaree;
window.requestUploadChanges = requestUploadChanges;
window.approveUploadSareeFromCard = approveUploadSareeFromCard;
window.selectUploadReference = selectUploadReference;
window.openUploadQuantityEditor = openUploadQuantityEditor;
window.closeUploadQuantityEditor = closeUploadQuantityEditor;
window.handleUploadQuantityBackdrop = handleUploadQuantityBackdrop;
window.loadMoreUploadRows = loadMoreUploadRows;
window.submitUploadSareeDirect = submitUploadSareeDirect;
window.uploadState = uploadSareeState;
