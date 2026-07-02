
const SOCIAL_API = {
  reviewAuth: "/api/review-auth",
  reviewData: "/api/review-data",
  updatePlatformPost: "/api/update-platform-post",
  approveContent: "/api/approve-content",
  rejectContent: "/api/reject-content"
};

const SOCIAL_TABLES = {
  Dashboard: 924895,
  Instagram: 928142,
  Facebook: 948370,
  Linkedin: 948372,
  Pinterest: 948373,
  GBP: 928145,
  Reddit: 928146,
  X: 929579,
  Product: 928930
};

const SOCIAL_DASHBOARD_FIELD_IDS = {
  Status: 8026947,
  Instagram: 8026946,
  "Instagram Post": 8085571,
  Facebook: 8255728,
  "Facebook Post": 8255730,
  Linkedin: 8255731,
  "Linkedin Post": 8255733,
  Pinterest: 8255734,
  "Pinterest Post": 8255737,
  "Google Business Profile": 8085396,
  "Google Business Post": 8085573,
  Reddit: 8085395,
  "Reddit Post": 8085575,
  X: 8085481,
  "X Post": 8085577
};

const SOCIAL_PLATFORM_FIELD_IDS = {
  Instagram: {
    "Caption": 8056768,
    "CTA style": 8056769,
    "Ratio": 8659656
  }
};

const SOCIAL_PLATFORM_MAP = [
  {key:"Instagram", icon:"◎", iconClass:"Instagram", tableId:928142, linkField:"Instagram", linkFieldId:8026946, dashboardImageField:"Instagram Post", dashboardImageFieldId:8085571, ratioDefault:"4:5"},
  {key:"Facebook", icon:"f", iconClass:"Facebook", tableId:948370, linkField:"Facebook", linkFieldId:8255728, dashboardImageField:"Facebook Post", dashboardImageFieldId:8255730, ratioDefault:"1:1"},
  {key:"Linkedin", icon:"in", iconClass:"Linkedin", tableId:948372, linkField:"Linkedin", linkFieldId:8255731, dashboardImageField:"Linkedin Post", dashboardImageFieldId:8255733, ratioDefault:"4:5"},
  {key:"Pinterest", icon:"P", iconClass:"Pinterest", tableId:948373, linkField:"Pinterest", linkFieldId:8255734, dashboardImageField:"Pinterest Post", dashboardImageFieldId:8255737, ratioDefault:"2:3"},
  {key:"Google Business Profile", icon:"G", iconClass:"GBP", tableId:928145, linkField:"Google Business Profile", linkFieldId:8085396, dashboardImageField:"Google Business Post", dashboardImageFieldId:8085573, ratioDefault:"1:1"},
  {key:"Reddit", icon:"r", iconClass:"Reddit", tableId:928146, linkField:"Reddit", linkFieldId:8085395, dashboardImageField:"Reddit Post", dashboardImageFieldId:8085575, ratioDefault:"1:1"},
  {key:"X", icon:"𝕏", iconClass:"X", tableId:929579, linkField:"X", linkFieldId:8085481, dashboardImageField:"X Post", dashboardImageFieldId:8085577, ratioDefault:"1:1"}
];

const socialState = {
  contentSets: [],
  currentPage: "All",
  currentSetId: null,
  currentPlatform: null
};

async function socialAuthenticate() {
  const password = window.prompt("Enter Social Media Review password");
  if (!password) throw new Error("Review password required");

  const response = await fetch(SOCIAL_API.reviewAuth, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Review authentication failed");
  }

  return data;
}

async function socialApiCall(url, options = {}, retryAuth = true) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

  if (response.status === 401 && retryAuth && data.error === "Review password required.") {
    await socialAuthenticate();
    return socialApiCall(url, options, false);
  }

  if (!response.ok) {
    throw new Error(data.error || data.message || `API failed: ${response.status}`);
  }

  return data;
}

async function loadSocialReviewData({ refresh = false } = {}) {
  const root = document.getElementById("socialDateGroups");
  root.innerHTML = `<div class="social-loader">Loading Dashboard containers from backend...</div>`;

  try {
    const url = refresh ? `${SOCIAL_API.reviewData}?refresh=1` : SOCIAL_API.reviewData;
    const data = await socialApiCall(url);
    socialState.contentSets = Array.isArray(data.contentSets) ? data.contentSets : [];
    document.getElementById("socialLastSyncText").textContent = `Last sync: ${new Date().toLocaleTimeString()}`;
    renderSocialTabs();
    renderSocialReview();
    showSocialToast(`${socialState.contentSets.length} content containers loaded`);
  } catch (error) {
    root.innerHTML = `<div class="social-empty">Backend API failed: ${socialEscapeHtml(error.message)}</div>`;
  }
}

function renderSocialTabs() {
  const pages = ["All", ...SOCIAL_PLATFORM_MAP.map(p => p.key)];
  document.getElementById("socialTabs").innerHTML = pages.map(page => {
    const count = page === "All"
      ? socialState.contentSets.length
      : socialState.contentSets.reduce((n,set)=> n + (set.platforms || []).filter(p=>p.platform === page).length, 0);

    return `<button class="social-tab ${socialState.currentPage===page ? "active":""}" type="button" onclick="setSocialPage('${socialEscapeAttr(page)}')">${socialEscapeHtml(page)} (${count})</button>`;
  }).join("");
}

function setSocialPage(page) {
  socialState.currentPage = page;
  document.getElementById("socialPlatformFilter").value = page === "All" ? "All" : page;
  renderSocialTabs();
  renderSocialReview();
}

function getFilteredSocialSets() {
  const status = document.getElementById("socialStatusFilter").value.toLowerCase();
  const platform = document.getElementById("socialPlatformFilter").value;
  const query = document.getElementById("socialSearchInput").value.trim().toLowerCase();
  const sort = document.getElementById("socialSortFilter").value;

  let list = socialState.contentSets.map(set => ({
    ...set,
    platforms: (set.platforms || []).filter(p => platform === "All" || p.platform === platform)
  })).filter(set => set.platforms.length);

  if (status !== "all") {
    list = list.filter(set => `${set.status || ""} ${set.approvalStatus || ""}`.toLowerCase().includes(status));
  }

  if (query) {
    list = list.filter(set => [
      set.dashboardId,
      set.dashboardNumber,
      set.contentType,
      set.contentGoal,
      set.whyToday,
      set.status,
      ...set.platforms.flatMap(p => [p.platform, p.rowId, p.postId, p.caption, p.cta, p.ratio, p.prompt])
    ].join(" ").toLowerCase().includes(query));
  }

  list.sort((a,b) => {
    if (sort === "dateAsc") return String(a.date || "").localeCompare(String(b.date || ""));
    if (sort === "pendingFirst") return socialStatusRank(a.status) - socialStatusRank(b.status);
    return String(b.date || "").localeCompare(String(a.date || ""));
  });

  return list;
}

function socialStatusRank(status) {
  const value = String(status || "").toLowerCase();
  if (value.includes("approval") || value.includes("pending")) return 0;
  if (value.includes("approved")) return 1;
  if (value.includes("rejected")) return 2;
  return 3;
}

function groupSocialSetsByDate(list) {
  return list.reduce((acc,set) => {
    const key = socialNiceDate(set.date);
    acc[key] = acc[key] || [];
    acc[key].push(set);
    return acc;
  }, {});
}

function renderSocialReview() {
  const list = getFilteredSocialSets();
  const root = document.getElementById("socialDateGroups");

  if (!list.length) {
    root.innerHTML = `<div class="social-empty">No Dashboard content containers found.</div>`;
    return;
  }

  const groups = groupSocialSetsByDate(list);

  root.innerHTML = Object.entries(groups).map(([date, sets]) => `
    <section class="social-date-group">
      <div class="social-date-header">
        <div class="social-date-title">
          <h2>${socialEscapeHtml(date)}</h2>
          <span>${sets.length} Dashboard containers · ${sets.reduce((n,s)=>n+(s.platforms || []).length,0)} platform posts</span>
        </div>
        <div><button class="social-btn green" type="button" onclick="approveSocialDate('${socialEscapeAttr(date)}')">Approve this date</button></div>
      </div>
      ${sets.map(renderSocialContentSet).join("")}
    </section>
  `).join("");
}

function renderSocialContentSet(set) {
  const status = String(set.status || "").toLowerCase();
  const pillClass = status.includes("approved") ? "approved" : status.includes("rejected") ? "rejected" : "";
  const firstPlatform = (set.platforms && set.platforms[0] && set.platforms[0].platform) || "Instagram";

  return `
    <article class="social-content-set">
      <header class="social-content-head">
        <div>
          <div class="social-content-kicker">
            <span class="social-pill id">Dashboard #${socialEscapeHtml(set.dashboardNumber || set.dashboardId)}</span>
            <span class="social-pill status ${pillClass}">${socialEscapeHtml(set.status || "No status")}</span>
            <span class="social-pill id">${socialEscapeHtml(set.contentType || "No content type")}</span>
          </div>
          <h3 class="social-content-title">${socialEscapeHtml(set.contentGoal || "Content set ready for review")}</h3>
          <div class="social-content-meta"><strong>Why Today:</strong> ${socialEscapeHtml(set.whyToday || "Not provided")}</div>
        </div>
        <div class="social-top-actions">
          <button class="social-btn" type="button" onclick="openSocialEditor(${Number(set.dashboardId)}, '${socialEscapeAttr(firstPlatform)}')">Review all</button>
          <button class="social-btn green" type="button" onclick="approveSocialSet(${Number(set.dashboardId)})">Approve content</button>
        </div>
      </header>

      <div class="social-platform-grid">
        ${(set.platforms || []).map(p => renderSocialPlatformCard(set, p)).join("")}
      </div>
    </article>
  `;
}

function renderSocialPlatformCard(set, post) {
  const config = SOCIAL_PLATFORM_MAP.find(item => item.key === post.platform) || {};
  const missingClass = post.missing ? "missing" : "";
  return `
    <section class="social-platform-card ${missingClass}" onclick="openSocialEditor(${Number(set.dashboardId)}, '${socialEscapeAttr(post.platform)}')">
      <div class="social-media">
        ${post.image ? `<img src="${socialEscapeAttr(post.image)}" alt="${socialEscapeAttr(post.platform)}">` : `<div class="social-media-empty">No image</div>`}
        <span class="social-ratio">${socialEscapeHtml(post.ratio || config.ratioDefault || "")}</span>
      </div>
      <div class="social-pc-body">
        <div class="social-platform-line"><span class="social-icon ${config.iconClass || ""}">${config.icon || "?"}</span>${socialEscapeHtml(post.platform)}</div>
        <div class="social-caption-snippet">${socialEscapeHtml(post.caption || "No caption found in linked platform row.")}</div>
        <div class="social-field-row">CTA: ${socialEscapeHtml(post.cta || "-")}<br>Row: ${socialEscapeHtml(String(post.rowId || "-"))}</div>
      </div>
    </section>
  `;
}

function openSocialEditor(setId, platformKey) {
  const set = socialState.contentSets.find(item => Number(item.dashboardId) === Number(setId));
  if (!set) return;

  const post = (set.platforms || []).find(item => item.platform === platformKey) || (set.platforms || [])[0];
  if (!post) return;

  socialState.currentSetId = setId;
  socialState.currentPlatform = post.platform;

  document.getElementById("socialEditorTitle").textContent = `Edit ${post.platform} Post`;
  document.getElementById("socialEditorSub").textContent = `Dashboard #${set.dashboardNumber || set.dashboardId} · ${socialNiceDate(set.date)}`;

  document.getElementById("socialCaptionInput").value = post.caption || "";
  document.getElementById("socialCharCount").textContent = (post.caption || "").length;
  document.getElementById("socialEditorImage").src = post.image || "";

  document.getElementById("socialDashboardIdInput").value = set.dashboardId || "";
  document.getElementById("socialDashboardStatusInput").value = set.status || "";
  document.getElementById("socialContentTypeInput").value = set.contentType || "";
  document.getElementById("socialContentGoalInput").value = set.contentGoal || "";
  document.getElementById("socialWhyTodayInput").value = set.whyToday || "";

  document.getElementById("socialRowIdInput").value = post.rowId || "";
  document.getElementById("socialPostIdInput").value = post.postId || "";
  document.getElementById("socialCtaInput").value = post.cta || "";
  document.getElementById("socialRatioInput").value = post.ratio || "";
  document.getElementById("socialHookInput").value = post.hookDirection || "";
  document.getElementById("socialPromptInput").value = post.prompt || "";
  document.getElementById("socialImageUrlInput").value = post.image || "";
  document.getElementById("socialReviewNoteInput").value = post.reviewNote || "";

  document.getElementById("socialEditorPlatformPills").innerHTML = (set.platforms || []).map(platformPost => {
    const config = SOCIAL_PLATFORM_MAP.find(item => item.key === platformPost.platform) || {};
    return `<div class="social-platform-pill ${platformPost.platform === post.platform ? "active" : ""}" onclick="openSocialEditor(${Number(set.dashboardId)}, '${socialEscapeAttr(platformPost.platform)}')">
      <span class="social-icon ${config.iconClass || ""}">${config.icon || "?"}</span>
      <div style="font-size:13px;font-weight:800">${socialEscapeHtml(platformPost.platform)}</div>
      ${platformPost.platform === post.platform ? '<span class="social-check">✓</span>' : ''}
    </div>`;
  }).join("");

  renderSocialQuality(post);
  document.getElementById("socialEditorBackdrop").classList.add("open");
}

function renderSocialQuality(post) {
  const items = [
    ["Caption exists", !!post.caption],
    ["Image attached", !!post.image],
    ["CTA added", !!post.cta],
    ["Ratio added", !!post.ratio],
    ["Prompt exists", !!post.prompt],
    ["Linked row found", !post.missing]
  ];

  document.getElementById("socialQualityGrid").innerHTML = items.map(([label, ok]) =>
    `<div class="social-quality ${ok ? "pass" : "fail"}">${ok ? "✓" : "!"} ${socialEscapeHtml(label)}</div>`
  ).join("");
}

document.getElementById("socialCaptionInput").addEventListener("input", event => {
  document.getElementById("socialCharCount").textContent = event.target.value.length;
});

function closeSocialEditor() {
  document.getElementById("socialEditorBackdrop").classList.remove("open");
  socialState.currentSetId = null;
  socialState.currentPlatform = null;
}

function getCurrentSocialSetAndPost() {
  const set = socialState.contentSets.find(item => Number(item.dashboardId) === Number(socialState.currentSetId));
  const post = set && (set.platforms || []).find(item => item.platform === socialState.currentPlatform);
  return { set, post };
}

async function updateCurrentSocialPlatform() {
  const { set, post } = getCurrentSocialSetAndPost();
  if (!set || !post) return;

  const payload = {
    dashboardId: set.dashboardId,
    platform: post.platform,
    tableId: post.tableId,
    rowId: post.rowId,
    values: {
      "Caption": document.getElementById("socialCaptionInput").value,
      "CTA style": document.getElementById("socialCtaInput").value,
      "Prompt": document.getElementById("socialPromptInput").value,
      "Ratio": document.getElementById("socialRatioInput").value,
      "Hook Direction": document.getElementById("socialHookInput").value,
      "Post ID": document.getElementById("socialPostIdInput").value
    }
  };

  try {
    await socialApiCall(SOCIAL_API.updatePlatformPost, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    Object.assign(post, {
      caption: payload.values["Caption"],
      cta: payload.values["CTA style"],
      prompt: payload.values["Prompt"],
      ratio: payload.values["Ratio"],
      hookDirection: payload.values["Hook Direction"],
      postId: payload.values["Post ID"]
    });

    renderSocialReview();
    closeSocialEditor();
    showSocialToast(`${post.platform} updated`);
  } catch (error) {
    showSocialToast(`Update failed: ${error.message}`);
  }
}

async function approveCurrentSocialSet() {
  const { set } = getCurrentSocialSetAndPost();
  if (!set) return;
  await approveSocialSet(set.dashboardId);
  closeSocialEditor();
}

async function rejectCurrentSocialSet() {
  const { set, post } = getCurrentSocialSetAndPost();
  if (!set) return;

  const note = document.getElementById("socialReviewNoteInput").value || "";

  try {
    await socialApiCall(SOCIAL_API.rejectContent, {
      method: "POST",
      body: JSON.stringify({
        dashboardId: set.dashboardId,
        platform: post ? post.platform : null,
        reviewNote: note
      })
    });
  } catch (error) {
    showSocialToast(`Reject API failed: ${error.message}`);
    return;
  }

  set.status = "Rejected";
  set.approvalStatus = "Rejected";
  renderSocialReview();
  closeSocialEditor();
  showSocialToast(`Dashboard #${set.dashboardNumber || set.dashboardId} rejected`);
}

async function approveSocialSet(dashboardId) {
  const set = socialState.contentSets.find(item => Number(item.dashboardId) === Number(dashboardId));
  if (!set) return;

  try {
    await socialApiCall(SOCIAL_API.approveContent, {
      method: "POST",
      body: JSON.stringify({ dashboardId: set.dashboardId })
    });
  } catch (error) {
    showSocialToast(`Approve API failed: ${error.message}`);
    return;
  }

  set.status = "Approved";
  set.approvalStatus = "Approved";
  renderSocialReview();
  showSocialToast(`Dashboard #${set.dashboardNumber || set.dashboardId} approved`);
}

function approveSocialVisible() {
  getFilteredSocialSets().forEach(set => approveSocialSet(set.dashboardId));
}

function approveSocialDate(dateLabel) {
  getFilteredSocialSets()
    .filter(set => socialNiceDate(set.date) === dateLabel)
    .forEach(set => approveSocialSet(set.dashboardId));
}

function socialNiceDate(dateStr) {
  if (!dateStr) return "No Date";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return String(dateStr);
  return date.toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
}

function showSocialToast(text) {
  const t = document.getElementById("socialToast");
  t.textContent = text;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
}

function socialEscapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[char]));
}

function socialEscapeAttr(value) {
  return socialEscapeHtml(value).replace(/`/g, "&#096;");
}

document.getElementById("socialEditorBackdrop").addEventListener("click", event => {
  if (event.target.id === "socialEditorBackdrop") closeSocialEditor();
});

(function initSocialReview(){
  renderSocialTabs();
})();
