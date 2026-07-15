const UPLOAD_API = {
  status: "/api/upload-saree/status",
  recent: "/api/upload-saree/recent",
  upload: "/api/upload-saree",
  reviewAuth: "/api/review-auth",
};

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

function uploadStatusText(row) {
  return uploadDisplay(row?.generationStatus, "Start");
}

function uploadIsPending(row) {
  return uploadStatusText(row).toLowerCase() === "pending";
}

function hasUploadImage(url) {
  return typeof url === "string" && url.trim().length > 0;
}

function getUploadMainImage(row) {
  const status = String(row?.generationStatus || row?.status || "").trim().toLowerCase();
  const images = row?.images || {};
  if ((status === "pending" || status === "approved") && hasUploadImage(images.front)) {
    return { url: images.front, type: "generated", label: "Front View" };
  }
  if (hasUploadImage(images.front)) return { url: images.front, type: "generated", label: "Front View" };
  if (hasUploadImage(images.saree)) return { url: images.saree, type: "reference", label: "Saree Image" };
  if (hasUploadImage(images.blouse)) return { url: images.blouse, type: "reference", label: "Blouse Image" };
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
  return JSON.stringify((rows || []).map((row) => ({
    rowId: row.rowId,
    status: row.generationStatus || row.status || "",
    saree: row.images?.saree || "",
    blouse: row.images?.blouse || "",
    front: row.images?.front || "",
    side: row.images?.side || "",
    back: row.images?.back || "",
    closeUp: row.images?.closeUp || "",
    title: row.productTitle || "",
    code: row.productCode || "",
    category: row.category || "",
    price: row.price || "",
  })));
}

function getUploadDetailSignature(row) {
  return JSON.stringify({
    rowId: row.rowId,
    status: row.generationStatus || row.status || "",
    saree: row.images?.saree || "",
    blouse: row.images?.blouse || "",
    front: row.images?.front || "",
    side: row.images?.side || "",
    back: row.images?.back || "",
    closeUp: row.images?.closeUp || "",
  });
}

function isMobileUploadView() {
  return window.matchMedia("(max-width: 760px)").matches;
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

  if (!response.ok) throw new Error(data.error || data.message || `API failed: ${response.status}`);
  return data;
}

function uploadStatusClass(status) {
  const value = String(status || "").toLowerCase();
  if (value.includes("approved")) return "approved";
  if (value.includes("failed") || value.includes("reject")) return "failed";
  if (value.includes("pending")) return "pending";
  return "start";
}

function currentUploadRow() {
  return uploadSareeState.rows.find((row) => Number(row.rowId) === Number(uploadSareeState.selectedRowId)) || null;
}

function setUploadMessage(message, isError = false) {
  const el = document.getElementById("uploadFormMessage");
  if (!el) return;
  el.textContent = message || "";
  el.style.color = isError ? "#b42318" : "#047857";
}

async function loadUploadStatus() {
  const panel = document.getElementById("uploadStatusPanel");
  try {
    const data = await uploadApiCall(UPLOAD_API.status);
    uploadSareeState.maxFileSizeMb = Number(data.maxFileSizeMb || 10);
    document.getElementById("uploadMaxSizeText").textContent = `JPG, PNG, WEBP - Max ${uploadSareeState.maxFileSizeMb}MB`;
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

    const nextRows = Array.isArray(data.rows)
      ? data.rows
      : Array.isArray(data.uploads)
        ? data.uploads
        : [];

    const nextSignature = stableUploadRowsSignature(nextRows);
    if (uploadSareeState.lastRowsSignature !== nextSignature) {
      uploadSareeState.lastRowsSignature = nextSignature;
      uploadSareeState.rows = nextRows;
      renderUploadRows();
    }
    updateUploadSyncTime();

    if (preserveDetail && uploadSareeState.detailOpen && uploadSareeState.currentRowId) {
      const updatedRow = uploadSareeState.rows.find((row) => Number(row.rowId) === Number(uploadSareeState.currentRowId));
      if (updatedRow) {
        uploadSareeState.selectedRowId = updatedRow.rowId;
        const nextDetailSignature = getUploadDetailSignature(updatedRow);
        if (uploadSareeState.currentDetailSignature !== nextDetailSignature) {
          uploadSareeState.currentDetailSignature = nextDetailSignature;
          renderUploadDetail(updatedRow, { keepOpen: true, preserveGeneratedKey: true });
        }
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
  count.textContent = `${uploadSareeState.rows.length} rows`;

  if (!uploadSareeState.rows.length) {
    root.innerHTML = `<div class="upload-empty">No uploaded sarees found.</div>`;
    return;
  }

  root.innerHTML = uploadSareeState.rows.map((row) => {
    const status = uploadStatusText(row);
    const statusClass = uploadStatusClass(status);
    const approveDisabled = uploadIsPending(row) ? "" : "disabled";
    const mainImage = getUploadMainImage(row);
    const referenceThumbs = [
      { key: "saree", label: "Saree", url: row.images?.saree },
      ...(hasUploadImage(row.images?.blouse) ? [{ key: "blouse", label: "Blouse", url: row.images.blouse }] : []),
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
  document.getElementById("uploadFeedbackInput").value = row.commentNotes || "";

  const referenceBlocks = [
    { label: "Origin Saree", url: row.images?.saree, empty: "Saree image not available" },
    ...(hasUploadImage(row.images?.blouse)
      ? [{ label: "Blouse Image", url: row.images.blouse, empty: "Blouse image not uploaded" }]
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
  const approveEnabled = uploadIsPending(row);
  approveBtn.disabled = !approveEnabled;
  approveBtn.title = approveEnabled ? "Approve generated output" : "Approve is enabled only when Generation Status is Pending";
}

function openUploadDetail(rowId) {
  const row = uploadSareeState.rows.find((item) => Number(item.rowId) === Number(rowId));
  if (!row) return;
  uploadSareeState.detailOpen = true;
  uploadSareeState.currentRowId = rowId;
  uploadSareeState.selectedRowId = rowId;
  uploadSareeState.selectedGeneratedKey = "front";
  uploadSareeState.currentDetailSignature = getUploadDetailSignature(row);
  document.documentElement.classList.add("upload-detail-open");
  document.body.classList.add("upload-detail-open");
  renderUploadDetail(row, { keepOpen: false, preserveGeneratedKey: true });
  document.getElementById("uploadDetailBackdrop").classList.add("open");
}

function closeUploadDetail() {
  uploadSareeState.detailOpen = false;
  uploadSareeState.currentRowId = null;
  uploadSareeState.currentDetailSignature = "";
  document.documentElement.classList.remove("upload-detail-open");
  document.body.classList.remove("upload-detail-open");
  document.getElementById("uploadDetailBackdrop").classList.remove("open");
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

async function submitUploadSaree(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const sareeFile = form.elements.sareeImage.files[0];
  if (!sareeFile) {
    setUploadMessage("Please upload Saree Image.", true);
    return;
  }

  const submitBtn = document.getElementById("uploadSubmitBtn");
  submitBtn.disabled = true;
  uploadSareeState.submitting = true;
  setUploadMessage("Uploading...");

  try {
    await uploadApiCall(UPLOAD_API.upload, {
      method: "POST",
      body: new FormData(form),
    });
    form.reset();
    clearUploadFilePreviews();
    setUploadMessage("Uploaded successfully. Generation Status set to Start.");
    showUploadToast("Uploaded successfully. Generation Status set to Start.");
    await loadRecentUploadSarees({ force: true, preserveDetail: true, silent: true });
    updateUploadSyncTime();
  } catch (error) {
    setUploadMessage(error.message, true);
    showUploadToast(error.message, true);
  } finally {
    uploadSareeState.submitting = false;
    submitBtn.disabled = false;
  }
}

async function updateUploadStatus(action) {
  const row = currentUploadRow();
  if (!row) return;
  const feedback = document.getElementById("uploadFeedbackInput").value || "";
  try {
    await uploadApiCall(`/api/upload-saree/${row.rowId}/${action}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ feedback }),
    });
    await loadRecentUploadSarees({ force: true, preserveDetail: true, silent: true });
    const updatedRow = uploadSareeState.rows.find((item) => Number(item.rowId) === Number(row.rowId));
    if (updatedRow) {
      uploadSareeState.selectedRowId = updatedRow.rowId;
      uploadSareeState.currentDetailSignature = getUploadDetailSignature(updatedRow);
      renderUploadDetail(updatedRow, { keepOpen: true, preserveGeneratedKey: true });
    }
    showUploadToast(action === "approve" ? "Upload approved." : "Upload moved to Failed.");
  } catch (error) {
    setUploadMessage(error.message, true);
    showUploadToast(error.message, true);
  }
}

function approveUploadSaree() {
  updateUploadStatus("approve");
}

function approveUploadSareeFromCard(rowId) {
  uploadSareeState.selectedRowId = rowId;
  updateUploadStatus("approve");
}

function rejectUploadSaree() {
  updateUploadStatus("reject");
}

function requestUploadChanges() {
  updateUploadStatus("request-changes");
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

function clearUploadFilePreviews() {
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
        input.files = event.dataTransfer.files;
        renderUploadFilePreview(input);
      }
    });
    input.addEventListener("change", () => renderUploadFilePreview(input));
  });
}

function renderUploadFilePreview(input) {
  const label = input.closest(".upload-file");
  const preview = label?.querySelector(".upload-file-preview");
  const file = input.files?.[0];
  if (!preview) return;
  preview.innerHTML = "";
  if (!file) return;

  const url = URL.createObjectURL(file);
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
    input.value = "";
    preview.innerHTML = "";
    URL.revokeObjectURL(url);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  populateUploadCategories();
  const form = document.getElementById("uploadSareeForm");
  if (form) form.addEventListener("submit", submitUploadSaree);
  enhanceUploadFileInputs();
});
