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
};

const UPLOAD_GENERATED_TABS = [
  { key: "front", label: "Front View" },
  { key: "side", label: "Side View" },
  { key: "back", label: "Back View" },
  { key: "closeUp", label: "Close-Up" },
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
    document.getElementById("uploadMaxSizeText").textContent = `JPG, PNG, WEBP · Max ${uploadSareeState.maxFileSizeMb}MB`;
    panel.className = `upload-status ${data.ok ? "ok" : "error"}`;
    panel.textContent = data.ok
      ? `Upload backend connected · Table ${data.tableId}`
      : `Upload backend not configured: ${(data.missing || []).join(", ")}`;
    return data;
  } catch (error) {
    panel.className = "upload-status error";
    panel.textContent = error.message;
    return null;
  }
}

async function loadUploadSarees({ refresh = false } = {}) {
  const root = document.getElementById("uploadRecentRows");
  root.innerHTML = `<div class="upload-empty">Loading uploaded sarees...</div>`;
  try {
    const url = refresh ? `${UPLOAD_API.recent}?refresh=1` : UPLOAD_API.recent;
    const data = await uploadApiCall(url);
    uploadSareeState.rows = Array.isArray(data.rows) ? data.rows : [];
    renderUploadRows();
    document.getElementById("uploadUpdatedAt").textContent = `Updated: ${new Date().toLocaleTimeString()}`;
  } catch (error) {
    root.innerHTML = `<div class="upload-empty">Upload API failed: ${uploadEscapeHtml(error.message)}</div>`;
  }
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
    const statusClass = uploadStatusClass(row.generationStatus);
    const image = row.images?.saree
      ? `<img src="${uploadEscapeHtml(row.images.saree)}" alt="${uploadEscapeHtml(row.productTitle)}" loading="lazy" />`
      : `<div class="upload-placeholder">No saree image</div>`;
    return `
      <article class="upload-card">
        <div class="upload-card-media">${image}</div>
        <div class="upload-card-body">
          <div class="upload-card-title">${uploadEscapeHtml(row.productTitle)}</div>
          <div class="upload-card-meta">${uploadEscapeHtml(row.productCode)} · ${uploadEscapeHtml(row.category)}</div>
          <div class="upload-card-meta">${uploadEscapeHtml(row.price)}</div>
          <div class="upload-badges"><span class="upload-badge ${statusClass}">${uploadEscapeHtml(row.generationStatus || "Start")}</span></div>
          <button class="upload-btn" type="button" onclick="openUploadDetail(${Number(row.rowId)})">View Detail</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderUploadDetail() {
  const row = currentUploadRow();
  if (!row) return;

  document.getElementById("uploadDetailTitle").textContent = row.productTitle;
  document.getElementById("uploadDetailMeta").textContent = `${row.productCode} · ${row.category} · ${row.generationStatus || "Start"}`;
  document.getElementById("uploadFeedbackInput").value = row.commentNotes || "";

  const referenceBlocks = [
    { label: "Saree Image", url: row.images?.saree, empty: "Saree image not available" },
    { label: "Blouse Image", url: row.images?.blouse, empty: "Blouse image not uploaded" },
  ];
  document.getElementById("uploadReferenceImages").innerHTML = referenceBlocks.map((item) => `
    <div class="upload-media-box">
      <div class="upload-media-label">${uploadEscapeHtml(item.label)}</div>
      <div class="upload-media-img">${item.url ? `<img src="${uploadEscapeHtml(item.url)}" alt="${uploadEscapeHtml(item.label)}" />` : `<div class="upload-placeholder">${uploadEscapeHtml(item.empty)}</div>`}</div>
    </div>
  `).join("");

  const selected = UPLOAD_GENERATED_TABS.find((tab) => tab.key === uploadSareeState.selectedGeneratedKey) || UPLOAD_GENERATED_TABS[0];
  uploadSareeState.selectedGeneratedKey = selected.key;
  document.getElementById("uploadGeneratedTabs").innerHTML = UPLOAD_GENERATED_TABS.map((tab) => `
    <button class="upload-btn ${tab.key === selected.key ? "active" : ""}" type="button" onclick="selectUploadGenerated('${tab.key}')">${uploadEscapeHtml(tab.label)}</button>
  `).join("");

  const selectedUrl = row.images?.[selected.key];
  const status = String(row.generationStatus || "Start");
  const placeholder = status.toLowerCase() === "start" ? "Generation not started yet" : "Not generated yet";
  document.getElementById("uploadGeneratedPreview").innerHTML = selectedUrl
    ? `<img src="${uploadEscapeHtml(selectedUrl)}" alt="${uploadEscapeHtml(selected.label)}" />`
    : `<div class="upload-placeholder">${uploadEscapeHtml(placeholder)}</div>`;

  const approveBtn = document.getElementById("uploadApproveBtn");
  const approveEnabled = status.toLowerCase() === "pending";
  approveBtn.disabled = !approveEnabled;
  approveBtn.title = approveEnabled ? "Approve generated output" : "Approve is enabled only when Generation Status is Pending";
}

function openUploadDetail(rowId) {
  uploadSareeState.selectedRowId = rowId;
  uploadSareeState.selectedGeneratedKey = "front";
  renderUploadDetail();
  document.getElementById("uploadDetailBackdrop").classList.add("open");
}

function closeUploadDetail() {
  document.getElementById("uploadDetailBackdrop").classList.remove("open");
}

function selectUploadGenerated(key) {
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
  setUploadMessage("Uploading...");

  try {
    const data = await uploadApiCall(UPLOAD_API.upload, {
      method: "POST",
      body: new FormData(form),
    });
    form.reset();
    setUploadMessage(`Uploaded row #${data.row?.rowId || ""}`);
    await loadUploadSarees({ refresh: true });
  } catch (error) {
    setUploadMessage(error.message, true);
  } finally {
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
    await loadUploadSarees({ refresh: true });
    const updatedRow = uploadSareeState.rows.find((item) => Number(item.rowId) === Number(row.rowId));
    if (updatedRow) {
      uploadSareeState.selectedRowId = updatedRow.rowId;
      renderUploadDetail();
    }
    setUploadMessage(action === "approve" ? "Upload approved." : "Upload moved to Failed.");
  } catch (error) {
    setUploadMessage(error.message, true);
  }
}

function approveUploadSaree() {
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
      loadUploadStatus().finally(() => loadUploadSarees());
    } else {
      loadUploadSarees();
    }
    if (!uploadSareeState.syncTimer) {
      uploadSareeState.syncTimer = setInterval(() => {
        if (uploadSareeState.active) loadUploadSarees();
      }, 15000);
    }
  } else if (uploadSareeState.syncTimer) {
    clearInterval(uploadSareeState.syncTimer);
    uploadSareeState.syncTimer = null;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("uploadSareeForm");
  if (form) form.addEventListener("submit", submitUploadSaree);
});
