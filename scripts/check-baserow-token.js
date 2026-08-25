import dotenv from "dotenv";
import { SAREE_TABLES } from "../saree-review-config.js";

dotenv.config();

const BASEROW_BASE_URL = process.env.BASEROW_BASE_URL || process.env.BASEROW_API_URL || "https://api.baserow.io";
const SAREE_BASEROW_DATABASE_ID = process.env.SAREE_BASEROW_DATABASE_ID || process.env.BASEROW_DATABASE_ID || "419522";
const SAREE_BASEROW_TOKEN = process.env.SAREE_BASEROW_TOKEN || process.env.BASEROW_TOKEN;


function getSelectValue(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "object") return value.value || value.name || String(value.id || "");
  return String(value);
}

function isApprovedGeneration(row, tableConfig) {
  const status = row[tableConfig.fields.generationStatus];
  return getSelectValue(status) === "Approved" || status?.id === 5987929;
}

function normalizeFieldName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function findFieldByName(fields, name) {
  const wanted = normalizeFieldName(name);
  return (Array.isArray(fields) ? fields : []).find(
    (field) => normalizeFieldName(field?.name) === wanted
  ) || null;
}

async function fetchFields(tableConfig) {
  const response = await fetch(`${BASEROW_BASE_URL}/api/database/fields/table/${tableConfig.tableId}/`, {
    headers: {
      Authorization: `Token ${SAREE_BASEROW_TOKEN}`,
      Accept: "application/json",
    },
  });
  const data = await response.json().catch(() => null);
  return {
    ok: response.ok,
    status: response.status,
    error: data?.error || null,
    fields: Array.isArray(data) ? data : [],
  };
}

async function fetchRows(tableConfig) {
  let page = 1;
  let allRows = [];
  let hasNext = true;

  while (hasNext) {
    const response = await fetch(`${BASEROW_BASE_URL}/api/database/rows/table/${tableConfig.tableId}/?size=100&page=${page}`, {
      headers: {
        Authorization: `Token ${SAREE_BASEROW_TOKEN}`,
        Accept: "application/json",
      },
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return { ok: false, status: response.status, data, error: data?.error || null, rows: [] };
    }

    allRows = allRows.concat(data.results || []);
    hasNext = Boolean(data.next);
    page += 1;
  }

  return { ok: true, status: 200, data: null, error: null, rows: allRows };
}

if (!SAREE_BASEROW_TOKEN) {
  console.log("[FAIL] SAREE_BASEROW_TOKEN is missing in .env.");
  process.exitCode = 1;
} else {
  console.log("Baserow REST token field-ID multi-table check");
  console.log(`API URL: ${BASEROW_BASE_URL}`);
  console.log(`Saree database ID: ${SAREE_BASEROW_DATABASE_ID}`);
  console.log("Saree token: configured");
  console.log("");

  let accessible = 0;
  let failed = 0;
  let totalApproved = 0;
  let generationStatusResolved = 0;
  let qualityScoreResolved = 0;
  let notInStockConfigured = 0;
  const missingQualityScore = [];
  const missingNotInStock = [];

  for (const table of SAREE_TABLES) {
    const [result, fieldResult] = await Promise.all([fetchRows(table), fetchFields(table)]);
    if (result.ok && fieldResult.ok) {
      const approved = result.rows.filter((row) => isApprovedGeneration(row, table)).length;
      const generationStatus = findFieldByName(fieldResult.fields, "Generation Status");
      const qualityScore = findFieldByName(fieldResult.fields, "Quality Score");
      const generationOptions = (generationStatus?.select_options || []).map((option) => String(option.value || option.name || ""));
      const hasNotInStock = generationOptions.includes("NOT IN STOCK");
      accessible += 1;
      totalApproved += approved;
      if (generationStatus) generationStatusResolved += 1;
      if (qualityScore) qualityScoreResolved += 1;
      if (hasNotInStock) notInStockConfigured += 1;
      if (!qualityScore) missingQualityScore.push(table.displayName || table.name);
      if (!hasNotInStock) missingNotInStock.push(table.displayName || table.name);
      console.log(`[OK] ${table.displayName || table.name} (${table.tableId}): approved=${approved}, Generation Status=${generationStatus ? `field_${generationStatus.id}` : "missing"}, Quality Score=${qualityScore ? `field_${qualityScore.id} (${qualityScore.type})` : "missing"}, NOT IN STOCK=${hasNotInStock ? "configured" : "missing"}`);
    } else {
      failed += 1;
      const failedResult = result.ok ? fieldResult : result;
      console.log(`[FAIL] ${table.displayName || table.name} (${table.tableId}): HTTP ${failedResult.status} ${failedResult.error || ""}`);
    }
  }

  console.log("");
  console.log(`Accessible tables: ${accessible}/${SAREE_TABLES.length}`);
  console.log(`Failed tables: ${failed}`);
  console.log(`Approved rows: ${totalApproved}`);
  console.log(`Generation Status resolved: ${generationStatusResolved}/${SAREE_TABLES.length}`);
  console.log(`Quality Score resolved: ${qualityScoreResolved}/${SAREE_TABLES.length}`);
  console.log(`NOT IN STOCK configured: ${notInStockConfigured}/${SAREE_TABLES.length}`);
  console.log(`Quantity unavailable: ${missingQualityScore.length ? missingQualityScore.join(", ") : "none"}`);
  console.log(`NOT IN STOCK unavailable: ${missingNotInStock.length ? missingNotInStock.join(", ") : "none"}`);

  if (failed > 0) {
    console.log("");
    console.log("Fix in Baserow: grant this REST database token read/update access to every listed saree table.");
    process.exitCode = 1;
  }
}
