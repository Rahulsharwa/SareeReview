const UPLOAD_API = {
  status: "/api/upload-saree/status",
  recent: "/api/upload-saree/recent",
  upload: "/api/upload-saree",
  finalize: "/api/upload-saree/finalize",
  cleanupUpload: "/api/upload-saree/cleanup-upload",
  reviewAuth: "/api/review-auth",
};

window.JSH_UPLOAD_BUILD = "blob-client-upload-v3";

const uploadSareeState = {
  active: false,
  loaded: false,
  rows: [],
  selectedRowId: null,
  selectedGeneratedKey: "front",
  syncTimer: null,
  maxFileSizeMb: 10,
  detailOpen: false,
  currentRowId: null,
  loadingRecent: false,
  isSyncing: false,
  submitting: false,
  lastRowsSignature: "",
  currentDetailSignature: "",
  detailLastScrollTop: 0,
  detailHeaderHidden: false,
  directStorageEnabled: false,
  publicConfig: {},
  clientTimeoutMs: 900000,
  allowedMimeTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
  isUploading: false,
  uploadCancelled: false,
  uploadTimedOut: false,
  uploadAbortController: null,
  uploadedBlobPaths: [],
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

const ALLOWED_UPLOAD_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const ALLOWED_UPLOAD_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
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
];

const UPLOAD_SAREE_CATEGORIES = [
  "Kanjivaram Silks",
  "Pure Silk Sarees",
  "Tussar Silk Saree",
  "South Weaves \u2013 South Silk Sarees",
  "Soft Silk Sarees",
  "Patola & Orissa Silk Sarees",
  "Printed Pure Silk Sarees",
  "Cotton Silk Sarees",
  "Paithani Silk Sarees",
  "Banarasi Silk Sarees",
  "Banarasi Georgette Silk Sarees",
  "Banarasi Kora Silk Saree",
  "Gadwal Handloom",
  "Jamawar Silk Sarees",
  "Cotton Saree",
  "Linen & Kota Silk Sarees",
  "Art Silk Sarees",
  "Bandhani Silk Saree",
];

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

function uploadGenerationStatusValue(row = {}) {
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

function shouldShowUploadRow(row) {
  const status = normalizeUploadGenerationStatus(uploadGenerationStatusValue(row));
  return status === "start" || status === "pending";
}

function canApproveUploadRow(row) {
  return normalizeUploadGenerationStatus(uploadGenerationStatusValue(row)) === "pending";
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
  const status = normalizeUploadGenerationStatus(uploadGenerationStatusValue(row));
  const images = row?.images || {};
  if (status === "pending" && hasUploadImage(images.front)) {
    return { url: images.front, type: "generated", label: "Front View" };
  }
  if (hasUploadImage(images.front)) return { url: images.front, type: "generated", label: "Front View" };
  if (hasUploadImage(images.saree)) return { url: images.saree, type: "reference", label: "Saree Image" };
  if (hasUploadImage(images.blouse)) return { url: images.blouse, type: "reference", label: "Blouse Image" };
  if (hasUploadImage(images.pallu)) return { url: images.pallu, type: "reference", label: "Pallu Image" };
  if (hasUploadImage(images.border)) return { url: images.border, type: "reference", label: "Border Image" };
  return { url: "", type: "empty", label: "No reference image" };
}

function getUploadGeneratedImage(row, key = "front") {
  return row?.images?.[key] || row?.generated?.[key] || "";
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

function renderUploadImage(src, label, className = "") {
  if (!hasUploadImage(src)) {
    return `<div class="upload-empty-media">${uploadEscapeHtml(label)}<br>-</div>`;
  }
  return `<img class="${uploadEscapeAttr(className)}" src="${uploadEscapeAttr(src)}" alt="${uploadEscapeAttr(label)}" loading="lazy" decoding="async" onerror="handleUploadImageError(this, '${uploadEscapeAttr(label)}')" />`;
}

function handleUploadImageError(image, label) {
  const parent = image.parentElement;
  image.remove();
  if (!parent) return;
  parent.classList.add("image-failed");
  parent.innerHTML = `<div class="upload-empty-media">${uploadEscapeHtml(label)}<br>Image unavailable</div>`;
}

function preloadUploadImage(url) {
  return new Promise((resolve) => {
    if (!hasUploadImage(url)) {
      resolve(false);
      return;
    }
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = url;
  });
}

function stableUploadRowsSignature(rows) {
  return JSON.stringify((rows || []).filter(shouldShowUploadRow).map((row) => ({
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
    title: row.productTitle || "",
    code: row.productCode || "",
    category: row.category || "",
    price: row.price || "",
    descriptions: row.descriptions || "",
    commentNotes: row.commentNotes || "",
  })));
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
    descriptions: row.descriptions || "",
    commentNotes: row.commentNotes || "",
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
  return uploadSareeState.rows.filter(shouldShowUploadRow).find((row) => Number(row.rowId) === Number(uploadSareeState.selectedRowId)) || null;
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

function validateUploadImageFile(file, label) {
  if (!file) return;
  const mimeType = String(file.type || "").toLowerCase();
  if (!ALLOWED_UPLOAD_MIME_TYPES.has(mimeType)) {
    throw new Error(`${label} must be a JPG, PNG, or WEBP image.`);
  }
  if (!ALLOWED_UPLOAD_EXTENSIONS.has(getFileExtension(file.name))) {
    throw new Error(`${label} must use a .jpg, .jpeg, .png, or .webp extension.`);
  }
  if (file.size > getMaxUploadSizeBytes()) {
    throw new Error(`The selected ${label} exceeds the maximum allowed size of ${uploadSareeState.maxFileSizeMb} MB.`);
  }
  if (file.size <= 0) {
    throw new Error(`${label} is empty.`);
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
    return {
      role,
      label: config.label,
      file: uploadSareeState[`${role}File`] || null,
      required: config.required,
    };
  }).filter((item) => item.file instanceof File);
}

function validateSelectedUploadFiles() {
  const selectedItems = getSelectedUploadFiles();
  const configuredMaximum = Number(uploadSareeState.publicConfig?.maxUploadFiles || UPLOAD_REFERENCE_ROLES.length);
  const maxUploadFiles = configuredMaximum === UPLOAD_REFERENCE_ROLES.length
    ? configuredMaximum
    : UPLOAD_REFERENCE_ROLES.length;

  if (!(uploadSareeState.sareeFile instanceof File)) {
    throw new Error("Please upload Saree Image.");
  }
  if (selectedItems.length > maxUploadFiles) {
    throw new Error(`Maximum ${maxUploadFiles} images are allowed per upload.`);
  }
  selectedItems.forEach((item) => validateUploadImageFile(item.file, item.label));
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
    uploadSareeState.maxFileSizeMb = Number(data.maxUploadSizeMb || data.maxFileSizeMb || 50);
    uploadSareeState.directStorageEnabled = Boolean(data.directStorageEnabled);
    uploadSareeState.clientTimeoutMs = Number(data.clientTimeoutMs || 900000);
    if (Array.isArray(data.allowedMimeTypes)) uploadSareeState.allowedMimeTypes = data.allowedMimeTypes;
    document.getElementById("uploadMaxSizeText").textContent = `JPG, PNG, WEBP - Max ${uploadSareeState.maxFileSizeMb} MB per image`;
    panel.className = `upload-status ${data.ok ? "ok" : "error"}`;
    panel.textContent = data.ok
      ? `Upload backend connected - Table ${data.tableId}`
      : `Upload backend not configured: ${(data.missing || []).join(", ")}`;
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
  } = options;
  const root = document.getElementById("uploadRecentRows");
  if (uploadSareeState.isSyncing) return;
  if (!silent && !uploadSareeState.rows.length) {
    root.innerHTML = `<div class="upload-empty">Loading uploaded sarees...</div>`;
  }

  try {
    uploadSareeState.isSyncing = true;
    uploadSareeState.loadingRecent = true;
    const response = await fetch(`${UPLOAD_API.recent}${force ? "?refresh=1" : ""}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && data.error === "Review password required.") {
      await uploadAuthenticate();
      uploadSareeState.isSyncing = false;
      return loadRecentUploadSarees({ force, preserveDetail, silent });
    }
    if (!response.ok) throw new Error(data.error || data.message || "Unable to load uploaded sarees.");

    const rawRows = Array.isArray(data.rows)
      ? data.rows
      : Array.isArray(data.uploads)
        ? data.uploads
        : [];
    const nextRows = rawRows.filter(shouldShowUploadRow);

    const nextSignature = stableUploadRowsSignature(nextRows);
    if (uploadSareeState.lastRowsSignature !== nextSignature) {
      uploadSareeState.lastRowsSignature = nextSignature;
      uploadSareeState.rows = nextRows;
      renderUploadRows();
    }
    updateUploadSyncTime();

    if (preserveDetail && uploadSareeState.detailOpen && uploadSareeState.currentRowId) {
      const updatedRow = uploadSareeState.rows.filter(shouldShowUploadRow).find((row) => Number(row.rowId) === Number(uploadSareeState.currentRowId));
      if (updatedRow) {
        uploadSareeState.selectedRowId = updatedRow.rowId;
        const nextDetailSignature = getUploadDetailSignature(updatedRow);
        if (uploadSareeState.currentDetailSignature !== nextDetailSignature) {
          uploadSareeState.currentDetailSignature = nextDetailSignature;
          renderUploadDetail(updatedRow, { keepOpen: true, preserveGeneratedKey: true });
        }
      } else {
        closeUploadImageFullscreen();
        closeUploadDetail();
      }
    }

    if (!silent) showUploadToast("Upload saree data synced.");
  } catch (error) {
    console.error("Upload recent sync failed:", error);
    root.innerHTML = `<div class="upload-empty">Upload API failed: ${uploadEscapeHtml(error.message)}</div>`;
  } finally {
    uploadSareeState.loadingRecent = false;
    uploadSareeState.isSyncing = false;
  }
}

function updateUploadSyncTime() {
  document.getElementById("uploadUpdatedAt").textContent = `Updated: ${new Date().toLocaleTimeString()}`;
}

async function syncUploadSareesNow() {
  await loadRecentUploadSarees({ force: true, preserveDetail: true, silent: false });
}

function renderUploadRows() {
  const root = document.getElementById("uploadRecentRows");
  const count = document.getElementById("uploadRecentCount");
  const visibleRows = uploadSareeState.rows.filter(shouldShowUploadRow);
  count.textContent = `${visibleRows.length} rows`;

  if (!visibleRows.length) {
    root.innerHTML = `<div class="upload-empty">No uploaded sarees found.</div>`;
    return;
  }

  root.innerHTML = visibleRows.map((row) => {
    const status = uploadStatusText(row);
    const statusClass = uploadStatusClass(status);
    const approveDisabled = canApproveUploadRow(row) ? "" : "disabled";
    const mainImage = getUploadMainImage(row);
    const referenceThumbs = [
      { key: "saree", label: "Saree", url: row.images?.saree },
      ...(hasUploadImage(row.images?.blouse) ? [{ key: "blouse", label: "Blouse", url: row.images.blouse }] : []),
      ...(hasUploadImage(row.images?.pallu) ? [{ key: "pallu", label: "Pallu", url: row.images.pallu }] : []),
      ...(hasUploadImage(row.images?.border) ? [{ key: "border", label: "Border", url: row.images.border }] : []),
      { key: "front", label: "Front View", url: row.images?.front },
      { key: "side", label: "Side View", url: row.images?.side },
      { key: "back", label: "Back View", url: row.images?.back },
      { key: "closeUp", label: "Close-Up", url: row.images?.closeUp },
    ];
    const thumbs = referenceThumbs.map((item) => `
      <div class="upload-thumb" title="${uploadEscapeAttr(item.label)}">
        <div class="upload-thumb-media">${renderUploadImage(item.url, item.label)}</div>
        <span>${uploadEscapeHtml(item.label)}</span>
      </div>
    `).join("");

    return `
      <article class="upload-card">
        <div class="upload-card-media upload-main-image ${uploadEscapeAttr(mainImage.type)}">${renderUploadImage(mainImage.url, mainImage.label, "upload-card-main-img")}</div>
        <div class="upload-card-body">
          <div class="upload-card-kicker">${uploadEscapeHtml(uploadDisplay(row.productCode, "No product code"))}</div>
          <div class="upload-card-title">${uploadEscapeHtml(uploadDisplay(row.productTitle, "Untitled Upload"))}</div>
          <div class="upload-card-meta">${uploadEscapeHtml(uploadDisplay(row.category, "No category"))}</div>
          <div class="upload-card-price">${uploadEscapeHtml(uploadDisplay(row.price, "Price not added"))}</div>
          <div class="upload-badges">
            <span class="upload-badge ${statusClass}">${uploadEscapeHtml(status)}</span>
            <span class="upload-badge">Upload Saree</span>
          </div>
          <div class="upload-thumb-row">${thumbs}</div>
          <div class="upload-card-actions">
            <button class="upload-btn" type="button" onclick="openUploadDetail(${Number(row.rowId)})">View Detail</button>
            <button class="upload-btn primary" type="button" ${approveDisabled} onclick="approveUploadSareeFromCard(${Number(row.rowId)})">Approve</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
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

  const referenceBlocks = [
    { label: "Saree Image", url: row.images?.saree, empty: "Saree image not available" },
    ...(hasUploadImage(row.images?.blouse)
      ? [{ label: "Blouse Image", url: row.images.blouse, empty: "Blouse image not uploaded" }]
      : []),
    ...(hasUploadImage(row.images?.pallu)
      ? [{ label: "Pallu Image", url: row.images.pallu, empty: "Pallu image not uploaded" }]
      : []),
    ...(hasUploadImage(row.images?.border)
      ? [{ label: "Border Image", url: row.images.border, empty: "Border image not uploaded" }]
      : []),
  ];
  document.getElementById("uploadReferenceImages").innerHTML = referenceBlocks.map((item) => `
    <div class="upload-media-box">
      <div class="upload-media-label">${uploadEscapeHtml(item.label)}</div>
      <div class="upload-media-img upload-compare-image upload-reference-stage">${hasUploadImage(item.url) ? renderUploadImage(item.url, item.label) : `<div class="upload-empty-media">${uploadEscapeHtml(item.empty)}</div>`}</div>
    </div>
  `).join("");

  const selected = UPLOAD_GENERATED_TABS.find((tab) => tab.key === uploadSareeState.selectedGeneratedKey) || UPLOAD_GENERATED_TABS[0];
  uploadSareeState.selectedGeneratedKey = selected.key;
  document.getElementById("uploadGeneratedTabs").innerHTML = UPLOAD_GENERATED_TABS.map((tab) => `
    <button class="upload-btn ${tab.key === selected.key ? "active" : ""}" type="button" data-key="${uploadEscapeAttr(tab.key)}" onclick="selectUploadGenerated('${tab.key}')">${uploadEscapeHtml(tab.label)}</button>
  `).join("");

  renderUploadGeneratedStage(row, selected.key, getUploadGeneratedImage(row, selected.key));

  const approveBtn = document.getElementById("uploadApproveBtn");
  const approveEnabled = canApproveUploadRow(row);
  approveBtn.disabled = !approveEnabled;
  approveBtn.title = approveEnabled ? "Approve generated output" : "Approve is enabled only when Generation Status is Pending";
  const sheetApproveBtn = document.getElementById("uploadApproveButton");
  if (sheetApproveBtn) {
    sheetApproveBtn.disabled = !approveEnabled;
    sheetApproveBtn.title = approveBtn.title;
  }
  requestAnimationFrame(() => {
    bindUploadDetailActions();
  });
}

function openUploadDetail(rowId) {
  const row = uploadSareeState.rows.filter(shouldShowUploadRow).find((item) => Number(item.rowId) === Number(rowId));
  if (!row) return;
  uploadSareeState.detailOpen = true;
  uploadSareeState.currentRowId = rowId;
  uploadSareeState.selectedRowId = rowId;
  uploadSareeState.selectedGeneratedKey = "front";
  uploadSareeState.currentDetailSignature = getUploadDetailSignature(row);
  uploadSareeState.detailLastScrollTop = 0;
  uploadSareeState.detailHeaderHidden = false;
  document.documentElement.classList.add("upload-detail-open");
  document.body.classList.add("upload-detail-open");
  getUploadDetailHeader()?.classList.remove("header-hidden");
  renderUploadDetail(row, { keepOpen: false, preserveGeneratedKey: true });
  document.getElementById("uploadDetailBackdrop").classList.add("open");
  requestAnimationFrame(() => {
    const detailBody = getUploadDetailBody();
    if (detailBody) detailBody.scrollTop = 0;
    setupUploadDetailHeaderAutoHide();
  });
}

function closeUploadDetail() {
  uploadSareeState.detailOpen = false;
  uploadSareeState.currentRowId = null;
  uploadSareeState.currentDetailSignature = "";
  uploadSareeState.detailLastScrollTop = 0;
  uploadSareeState.detailHeaderHidden = false;
  document.documentElement.classList.remove("upload-detail-open");
  document.body.classList.remove("upload-detail-open");
  getUploadDetailHeader()?.classList.remove("header-hidden");
  closeUploadReviewActions();
  closeUploadImageFullscreen();
  document.getElementById("uploadDetailBackdrop").classList.remove("open");
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
    ? renderUploadImage(url, tab.label)
    : `<div class="upload-empty-media">${uploadGeneratedPlaceholder(row, key)}</div>`;
}

function getCurrentUploadGeneratedUrl() {
  const row = uploadSareeState.rows.filter(shouldShowUploadRow).find((item) => Number(item.rowId) === Number(uploadSareeState.currentRowId));
  if (!row) return "";
  const key = uploadSareeState.selectedGeneratedKey || "front";
  return getUploadGeneratedImage(row, key);
}

function getCurrentUploadRow() {
  return uploadSareeState.rows.filter(shouldShowUploadRow).find((row) => Number(row.rowId) === Number(uploadSareeState.currentRowId)) || null;
}

function openUploadImageFullscreen(event) {
  event?.preventDefault();
  event?.stopPropagation();

  const url = getCurrentUploadGeneratedUrl();
  if (!hasUploadImage(url)) {
    showUploadToast("Generated image is not available.", true);
    return;
  }

  const viewer = document.getElementById("uploadImageFullscreen");
  const image = document.getElementById("uploadFullscreenImage");
  if (!viewer || !image) {
    console.error("Fullscreen viewer elements are missing.");
    showUploadToast("Unable to open full-screen image.", true);
    return;
  }

  image.src = url;
  image.alt = "Generated saree full screen";
  viewer.classList.add("open");
  viewer.setAttribute("aria-hidden", "false");
  document.documentElement.classList.add("upload-fullscreen-open");
  document.body.classList.add("upload-fullscreen-open");
}

function closeUploadImageFullscreen(event) {
  event?.preventDefault();
  event?.stopPropagation();

  const viewer = document.getElementById("uploadImageFullscreen");
  const image = document.getElementById("uploadFullscreenImage");
  viewer?.classList.remove("open");
  viewer?.setAttribute("aria-hidden", "true");
  if (image) image.removeAttribute("src");
  document.documentElement.classList.remove("upload-fullscreen-open");
  document.body.classList.remove("upload-fullscreen-open");
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
  const url = getUploadGeneratedImage(row, key);
  if (!hasUploadImage(url)) {
    uploadSareeState.selectedGeneratedKey = key;
    renderMissingUploadGeneratedView(row, key);
    return;
  }
  const loaded = await preloadUploadImage(url);
  uploadSareeState.selectedGeneratedKey = key;
  if (!loaded) {
    renderMissingUploadGeneratedView(row, key);
    return;
  }
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

async function submitUploadSaree(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (uploadSareeState.isUploading) return;
  clearUploadError();

  const config = uploadSareeState.publicConfig || {};
  if (isRunningOnVercelProduction() && (!config.directStorageEnabled || !config.blobConfigured)) {
    showUploadToast("Large-image storage is not configured on the server. Upload is temporarily unavailable.", true);
    setUploadMessage("Large-image storage is not configured on the server. Upload is temporarily unavailable.", true);
    return;
  }

  if (config.directStorageEnabled) {
    return submitUploadSareeDirect(form);
  }

  return submitUploadSareeLegacy(form);
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
        throw new Error(`${item.label} could not be uploaded. No Baserow row was created.`);
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

function setUploadActionLoading(loading) {
  const row = currentUploadRow();
  const approveAllowed = canApproveUploadRow(row);
  [
    "uploadRejectButton",
    "uploadRequestChangesButton",
    "uploadApproveButton",
  ].forEach((id) => {
    const button = document.getElementById(id);
    if (!button) return;
    button.disabled = Boolean(loading) || (id === "uploadApproveButton" && !approveAllowed);
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

  if (action === "approve" && !canApproveUploadRow(row)) {
    showUploadToast("Only Pending rows can be approved.", true);
    return;
  }

  const feedback = getUploadFeedbackValue();
  if (action === "request-changes" && !feedback.trim()) {
    showUploadToast("Please enter feedback for requested changes.", true);
    return;
  }

  setUploadActionLoading(true);
  try {
    const completedRowId = row.rowId;
    await uploadApiCall(`/api/upload-saree/${row.rowId}/${action}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ feedback, comment: feedback, note: feedback }),
    });
    closeUploadReviewActions();
    closeUploadImageFullscreen();
    closeUploadDetail();
    uploadSareeState.rows = uploadSareeState.rows.filter((item) => Number(item.rowId) !== Number(completedRowId));
    uploadSareeState.lastRowsSignature = "";
    renderUploadRows();
    showUploadToast(action === "approve"
      ? "Saree approved successfully. Status changed to Completed."
      : action === "reject"
        ? "Rejected successfully."
        : "Changes requested successfully.");
    await loadRecentUploadSarees({ force: true, preserveDetail: false, silent: true });
  } catch (error) {
    console.error(`Upload ${action} failed:`, error);
    const message = action === "approve" && error.message !== "The Completed status is not configured in the Upload Saree Baserow table."
      ? "Unable to approve the saree. Generation Status was not updated."
      : error.message || `${action} failed.`;
    setUploadMessage(message, true);
    showUploadToast(message, true);
  } finally {
    setUploadActionLoading(false);
  }
}

function approveUploadSaree(event) {
  updateUploadStatus("approve", event);
}

function approveUploadSareeFromCard(rowId, event) {
  event?.preventDefault();
  event?.stopPropagation();
  uploadSareeState.selectedRowId = rowId;
  updateUploadStatus("approve", event);
}

function rejectUploadSaree(event) {
  updateUploadStatus("reject", event);
}

function requestUploadChanges(event) {
  updateUploadStatus("request-changes", event);
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
  updateUploadStatus("approve", event);
}

function rejectUploadCurrent(event) {
  updateUploadStatus("reject", event);
}

function requestChangesUploadCurrent(event) {
  updateUploadStatus("request-changes", event);
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
      loadUploadStatus().finally(() => loadRecentUploadSarees({ force: true, preserveDetail: true, silent: true }));
    } else {
      loadRecentUploadSarees({ force: true, preserveDetail: true, silent: true });
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
    if (uploadSareeState.submitting) return;
    if (uploadSareeState.detailOpen && isMobileUploadView()) return;
    loadRecentUploadSarees({ force: true, preserveDetail: true, silent: true });
  }, 15000);
}

function stopUploadAutoSync() {
  if (uploadSareeState.syncTimer) {
    clearInterval(uploadSareeState.syncTimer);
    uploadSareeState.syncTimer = null;
  }
}

function clearUploadRoleFile(role, { revokePreview = true, render = true, clearMessage = true } = {}) {
  if (!UPLOAD_REFERENCE_ROLES.includes(role)) return;
  const previewUrl = uploadSareeState.previewUrls?.[role];
  if (revokePreview && previewUrl) URL.revokeObjectURL(previewUrl);
  uploadSareeState[`${role}File`] = null;
  uploadSareeState.previewUrls[role] = null;
  uploadSareeState.fileProgress[role] = 0;
  const input = getUploadRoleInput(role);
  if (input) input.value = "";
  if (render) renderUploadRolePreview(role);
  if (clearMessage) clearUploadError();
}

function clearUploadFilePreviews() {
  UPLOAD_REFERENCE_ROLES.forEach((role) => clearUploadRoleFile(role, { render: false, clearMessage: false }));
  document.querySelectorAll(".upload-file-preview").forEach((preview) => {
    preview.innerHTML = "";
  });
}

function populateUploadCategories() {
  const select = document.getElementById("uploadCategory");
  if (!select || select.options.length > 1) return;
  UPLOAD_SAREE_CATEGORIES.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  });
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
    browse.textContent = "Browse";
    browse.addEventListener("click", (event) => {
      event.preventDefault();
      input.click();
    });

    const hint = document.createElement("div");
    hint.className = "upload-file-hint";
    hint.textContent = "Drag and drop or choose JPG, PNG, WEBP";

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
        renderUploadFilePreview(input);
      }
    });
    input.addEventListener("change", () => renderUploadFilePreview(input));
  });
}

function renderUploadFilePreview(input) {
  const file = input.files?.[0];
  const role = UPLOAD_REFERENCE_ROLES.find((candidate) => getUploadRoleConfig(candidate).inputName === input.name);
  if (!role) return;
  if (!file) {
    clearUploadRoleFile(role);
    return;
  }
  try {
    setUploadRoleFile(role, file);
  } catch (error) {
    input.value = "";
    setUploadMessage(error.message || "Unable to select image.", true);
    showUploadToast(error.message || "Unable to select image.", true);
  }
}

function setUploadRoleFile(role, file) {
  const config = getUploadRoleConfig(role);
  if (!config) throw new Error("Invalid reference image role.");
  validateUploadImageFile(file, config.label);
  const previousPreviewUrl = uploadSareeState.previewUrls?.[role];
  if (previousPreviewUrl) URL.revokeObjectURL(previousPreviewUrl);
  uploadSareeState[`${role}File`] = file;
  uploadSareeState.previewUrls[role] = URL.createObjectURL(file);
  uploadSareeState.fileProgress[role] = 0;
  clearUploadError();
  renderUploadRolePreview(role);
}

function renderUploadRolePreview(role) {
  const config = getUploadRoleConfig(role);
  const input = getUploadRoleInput(role);
  const preview = input?.closest(".upload-file")?.querySelector(".upload-file-preview");
  if (!config || !preview) return;
  const file = uploadSareeState[`${role}File`];
  const url = uploadSareeState.previewUrls?.[role];
  preview.innerHTML = "";
  if (!(file instanceof File) || !url) return;
  const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
  preview.innerHTML = `
    <div class="upload-selected-file">
      <img src="${uploadEscapeAttr(url)}" alt="${uploadEscapeAttr(file.name)}" />
      <div>
        <strong>${uploadEscapeHtml(file.name)}</strong>
        <span>${sizeMb} MB</span>
      </div>
      <button class="upload-icon-btn" type="button">Remove</button>
    </div>
  `;
  preview.querySelector("button")?.addEventListener("click", (event) => {
    event.preventDefault();
    clearUploadRoleFile(role);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  populateUploadCategories();
  const form = document.getElementById("uploadSareeForm");
  if (form) form.addEventListener("submit", submitUploadSaree);
  document.getElementById("uploadCancelButton")?.addEventListener("click", cancelUploadSaree);
  bindUploadDetailActions();
  enhanceUploadFileInputs();
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
window.submitUploadSareeDirect = submitUploadSareeDirect;
window.uploadState = uploadSareeState;
