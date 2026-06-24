import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASEROW_API_URL = process.env.BASEROW_API_URL || "https://api.baserow.io";
const BASEROW_DATABASE_ID = process.env.BASEROW_DATABASE_ID || "419522";
const BASEROW_TOKEN = process.env.BASEROW_TOKEN;

const SHOPIFY_NOTES_APPROVED_VALUE = "Approved";
const SHOPIFY_NOTES_REJECT_VALUE = "Reject";
const GENERATION_STATUS_FAILED_VALUE = "Failed";

const SAREE_TABLES = [
  {
    name: "Kanjivaram Silks",
    tableId: 948083,
    fields: {
      generationStatus: "field_8253052",
      shopify: "field_8253055",
      comment: "field_8253053",
    },
  },
  {
    name: "Pure Silk Sarees",
    tableId: 935204,
    fields: {
      generationStatus: "field_8123033",
      shopify: "field_8123036",
      comment: "field_8123034",
    },
  },
  {
    name: "Tussar Silk Saree",
    tableId: 948245,
    fields: {
      generationStatus: "field_8254631",
      shopify: "field_8254634",
      comment: "field_8254632",
    },
  },
  {
    name: "South Weaves - South Silk Sarees",
    tableId: 935205,
    fields: {
      generationStatus: "field_8123050",
      shopify: "field_8123053",
      comment: "field_8123051",
    },
  },
  {
    name: "Soft Silk Sarees",
    tableId: 935207,
    fields: {
      generationStatus: "field_8123084",
      shopify: "field_8123087",
      comment: "field_8123085",
    },
  },
  {
    name: "Patola & Orissa Silk Sarees",
    tableId: 935208,
    fields: {
      generationStatus: "field_8123101",
      shopify: "field_8123104",
      comment: "field_8123102",
    },
  },
  {
    name: "Printed Pure Silk Sarees",
    tableId: 935203,
    fields: {
      generationStatus: "field_8123016",
      shopify: "field_8123019",
      comment: "field_8123017",
    },
  },
  {
    name: "Cotton Silk Sarees",
    tableId: 935215,
    fields: {
      generationStatus: "field_8123220",
      shopify: "field_8123223",
      comment: "field_8123221",
    },
  },
  {
    name: "Paithani Silk Sarees",
    tableId: 935206,
    fields: {
      generationStatus: "field_8123067",
      shopify: "field_8123070",
      comment: "field_8123068",
    },
  },
  {
    name: "Banarasi Georgette Silk Sarees",
    tableId: 935209,
    fields: {
      generationStatus: "field_8123118",
      shopify: "field_8123121",
      comment: "field_8123119",
    },
  },
  {
    name: "Banarasi Silk Sarees",
    tableId: 935210,
    fields: {
      generationStatus: "field_8123135",
      shopify: "field_8123138",
      comment: "field_8123136",
    },
  },
  {
    name: "Banarasi Kora Silk Saree",
    tableId: 935211,
    fields: {
      generationStatus: "field_8123152",
      shopify: "field_8123155",
      comment: "field_8123153",
    },
  },
  {
    name: "Gadwal Handloom",
    tableId: 935213,
    fields: {
      generationStatus: "field_8123186",
      shopify: "field_8123189",
      comment: "field_8123187",
    },
  },
  {
    name: "Jamawar Silk Sarees",
    tableId: 935214,
    fields: {
      generationStatus: "field_8123203",
      shopify: "field_8123206",
      comment: null,
    },
  },
  {
    name: "Cotton Saree",
    tableId: 935216,
    fields: {
      generationStatus: "field_8123237",
      shopify: "field_8123240",
      comment: "field_8123238",
    },
  },
  {
    name: "Cotton Suits",
    tableId: 936059,
    fields: {
      generationStatus: "field_8132747",
      shopify: "field_8132750",
      comment: "field_8132748",
    },
  },
  {
    name: "Silk Suits",
    tableId: 936060,
    fields: {
      generationStatus: "field_8132764",
      shopify: "field_8132767",
      comment: "field_8132765",
    },
  },
  {
    name: "Linen & Kota Silk Sarees",
    tableId: 935217,
    fields: {
      generationStatus: "field_8123254",
      shopify: "field_8123257",
      comment: "field_8123255",
    },
  },
  {
    name: "Art Silk Sarees",
    tableId: 935218,
    fields: {
      generationStatus: "field_8123271",
      shopify: "field_8123274",
      comment: "field_8123272",
    },
  },
  {
    name: "Bandhani Silk Saree",
    tableId: 935212,
    fields: {
      generationStatus: "field_8123169",
      shopify: "field_8123172",
      comment: "field_8123170",
    },
  },
];

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const fieldMapCache = new Map();

function assertConfig() {
  if (!BASEROW_TOKEN) {
    const error = new Error("Missing BASEROW_TOKEN in .env");
    error.status = 500;
    throw error;
  }
}

function getTableConfig(tableId) {
  return SAREE_TABLES.find((table) => String(table.tableId) === String(tableId));
}

function getTableConfigByName(name) {
  return SAREE_TABLES.find((table) => table.name.toLowerCase() === String(name || "").toLowerCase());
}

function getSelectValue(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "object") return value.value || value.name || String(value.id || "");
  return String(value);
}

function readField(row, fieldId, fallbackName, fieldMap = null) {
  if (fieldId && Object.prototype.hasOwnProperty.call(row, fieldId)) {
    return row[fieldId];
  }

  if (fallbackName && fieldMap?.byName?.has(fallbackName)) {
    const mappedFieldId = fieldMap.byName.get(fallbackName);
    if (Object.prototype.hasOwnProperty.call(row, mappedFieldId)) {
      return row[mappedFieldId];
    }
  }

  if (fallbackName && Object.prototype.hasOwnProperty.call(row, fallbackName)) {
    return row[fallbackName];
  }

  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isBaserowThrottle(response, data) {
  return response.status === 429 || data?.detail === "Request was throttled.";
}

async function fetchBaserowJsonWithRetry(url, options, maxAttempts = 4) {
  let lastResponse = null;
  let lastData = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(url, options);
    const data = await response.json();

    if (response.ok || !isBaserowThrottle(response, data) || attempt === maxAttempts) {
      return { response, data };
    }

    lastResponse = response;
    lastData = data;
    await sleep(500 * attempt);
  }

  return { response: lastResponse, data: lastData };
}

async function fetchFieldMap(tableId) {
  assertConfig();

  if (fieldMapCache.has(String(tableId))) {
    return fieldMapCache.get(String(tableId));
  }

  const { response, data } = await fetchBaserowJsonWithRetry(`${BASEROW_API_URL}/api/database/fields/table/${tableId}/`, {
    headers: {
      Authorization: `Token ${BASEROW_TOKEN}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const details = typeof data === "object" ? JSON.stringify(data) : String(data);
    const error = new Error(`Baserow fields fetch failed for table ${tableId}: ${details}`);
    error.status = response.status;
    error.baserow = data;
    error.errorType = data?.error || null;
    error.tableId = tableId;
    throw error;
  }

  const fields = Array.isArray(data) ? data : data.results || [];
  const fieldMap = {
    byName: new Map(fields.map((field) => [field.name, `field_${field.id}`])),
    fields,
  };
  fieldMapCache.set(String(tableId), fieldMap);
  return fieldMap;
}

function numericFieldId(fieldKey) {
  const match = String(fieldKey || "").match(/^field_(\d+)$/);
  return match ? Number(match[1]) : null;
}

function findConfiguredField(fieldMap, fieldKey) {
  const fieldId = numericFieldId(fieldKey);
  return fieldId ? fieldMap.fields.find((field) => Number(field.id) === fieldId) || null : null;
}

function getSelectOptionValues(field) {
  if (!field || !Array.isArray(field.select_options)) return [];
  return field.select_options.map((option) => String(option.value || option.name || ""));
}

function validateTableFields(tableConfig, fieldMap) {
  const warnings = [];
  const generationField = findConfiguredField(fieldMap, tableConfig.fields.generationStatus);
  const shopifyField = findConfiguredField(fieldMap, tableConfig.fields.shopify);
  const commentField = tableConfig.fields.comment
    ? findConfiguredField(fieldMap, tableConfig.fields.comment)
    : null;

  if (!generationField) {
    warnings.push(`Configured Generation Status field ${tableConfig.fields.generationStatus} was not found.`);
  } else if (!getSelectOptionValues(generationField).includes(GENERATION_STATUS_FAILED_VALUE)) {
    warnings.push(`Generation Status field ${tableConfig.fields.generationStatus} does not include option Failed.`);
  }

  if (!shopifyField) {
    warnings.push(`Configured Shopify Notes field ${tableConfig.fields.shopify} was not found.`);
  } else {
    const shopifyOptions = getSelectOptionValues(shopifyField);
    const isSelectField = /select/.test(String(shopifyField.type || ""));
    if (isSelectField && !shopifyOptions.includes(SHOPIFY_NOTES_APPROVED_VALUE)) {
      warnings.push(`Shopify Notes select field ${tableConfig.fields.shopify} does not include option Approved.`);
    }
    if (isSelectField && !shopifyOptions.includes(SHOPIFY_NOTES_REJECT_VALUE)) {
      warnings.push(`Shopify Notes select field ${tableConfig.fields.shopify} does not include option Reject.`);
    }
  }

  if (tableConfig.fields.comment && !commentField) {
    warnings.push(`Configured Comment field ${tableConfig.fields.comment} was not found.`);
  }

  if (
    tableConfig.tableId === 948083 &&
    shopifyField &&
    !/shopify/i.test(String(shopifyField.name || ""))
  ) {
    warnings.push("Configured Shopify Notes field for Kanjivaram may not match live field name.");
  } else if (shopifyField && !/shopify/i.test(String(shopifyField.name || ""))) {
    warnings.push(`Configured Shopify Notes field name is "${shopifyField.name}".`);
  }

  return {
    warnings,
    fields: {
      generationStatus: generationField ? { id: generationField.id, name: generationField.name, type: generationField.type, options: getSelectOptionValues(generationField) } : null,
      shopifyNotes: shopifyField ? { id: shopifyField.id, name: shopifyField.name, type: shopifyField.type, acceptsFreeText: !/select/.test(String(shopifyField.type || "")), options: getSelectOptionValues(shopifyField) } : null,
      comment: commentField ? { id: commentField.id, name: commentField.name, type: commentField.type } : null,
    },
  };
}

function getFileUrl(field) {
  if (!Array.isArray(field) || field.length === 0) return null;
  const file = field[0];
  return file?.url || file?.thumbnails?.card_cover?.url || file?.thumbnails?.small?.url || null;
}

function parsePrice(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  const parsed = Number(String(value).replace(/[^\d.]/g, ""));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isApprovedGeneration(row, tableConfig, fieldMap = null) {
  const status = readField(row, tableConfig.fields.generationStatus, "Generation Status", fieldMap);
  const value = getSelectValue(status);
  return value === "Approved" || status?.id === 5987929;
}

function normalizeProduct(row, tableConfig, fieldMap = null) {
  const generationStatus = readField(row, tableConfig.fields.generationStatus, "Generation Status", fieldMap);
  const shopify = readField(row, tableConfig.fields.shopify, "SHOPIFY", fieldMap);
  const comment = readField(row, tableConfig.fields.comment, "Comment", fieldMap);

  return {
    id: `${tableConfig.tableId}-${row.id}`,
    rowId: row.id,
    tableId: tableConfig.tableId,
    collectionName: tableConfig.name,
    code: readField(row, null, "Product Code", fieldMap) || readField(row, null, "SKU", fieldMap) || readField(row, null, "Product SKU", fieldMap) || `ROW-${row.id}`,
    title: readField(row, null, "Product Title", fieldMap) || readField(row, null, "Title", fieldMap) || "Untitled Saree",
    category: getSelectValue(readField(row, null, "Category", fieldMap)) || tableConfig.name,
    price: parsePrice(readField(row, null, "Price (INR)", fieldMap) || readField(row, null, "Price", fieldMap) || readField(row, null, "Pri...", fieldMap)),
    generationStatus: getSelectValue(generationStatus),
    approvalStatus: getSelectValue(readField(row, null, "Approvel", fieldMap)) || getSelectValue(readField(row, null, "Approval", fieldMap)) || "Pending Review",
    shopify: getSelectValue(shopify) || "Pending",
    comment: comment || "",
    modified: readField(row, null, "Last Modified", fieldMap) || row.updated_on || row.created_on || "",
    specifications: readField(row, null, "Specifications", fieldMap) || "",
    raw: {
      generationStatus,
      shopify,
      approvel: readField(row, null, "Approvel", fieldMap),
    },
    images: {
      full: getFileUrl(readField(row, null, "Full Saree Image", fieldMap)),
      blouse: getFileUrl(readField(row, null, "Blouse Image", fieldMap)),
      pallu: getFileUrl(readField(row, null, "Pallu Image", fieldMap)),
      border: getFileUrl(readField(row, null, "Border Image", fieldMap)),
      front: getFileUrl(readField(row, null, "Generated Front View", fieldMap)),
      side: getFileUrl(readField(row, null, "Side View", fieldMap)),
      back: getFileUrl(readField(row, null, "Back View", fieldMap)),
      close: getFileUrl(readField(row, null, "Close Up View", fieldMap)),
      grid: getFileUrl(readField(row, null, "Grid View", fieldMap)),
      video: getFileUrl(readField(row, null, "Video", fieldMap)),
    },
  };
}

function sortProducts(products, sort) {
  if (sort === "Price High to Low") {
    products.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
  } else if (sort === "Price Low to High") {
    products.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  } else if (sort === "Title A-Z") {
    products.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
  }
}

function applyProductFilters(products, { search, status, sort }) {
  let filtered = [...products];

  if (search) {
    const q = String(search).toLowerCase();
    filtered = filtered.filter((product) =>
      String(product.code || "").toLowerCase().includes(q) ||
      String(product.title || "").toLowerCase().includes(q)
    );
  }

  if (status && status !== "All Statuses") {
    filtered = filtered.filter((product) =>
      product.generationStatus === status ||
      product.approvalStatus === status ||
      product.shopify === status
    );
  }

  sortProducts(filtered, sort);
  return filtered;
}

async function fetchBaserowRows(tableId) {
  assertConfig();

  let page = 1;
  let allRows = [];
  let hasNext = true;

  while (hasNext) {
    const params = new URLSearchParams({
      size: "100",
      page: String(page),
    });

    const url = `${BASEROW_API_URL}/api/database/rows/table/${tableId}/?${params.toString()}`;
    const { response, data } = await fetchBaserowJsonWithRetry(url, {
      headers: {
        Authorization: `Token ${BASEROW_TOKEN}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const details = typeof data === "object" ? JSON.stringify(data) : String(data);
      const error = new Error(`Baserow fetch failed for table ${tableId}: ${details}`);
      error.status = response.status;
      error.baserow = data;
      error.errorType = data?.error || null;
      error.tableId = tableId;
      throw error;
    }

    allRows = allRows.concat(data.results || []);
    hasNext = Boolean(data.next);
    page += 1;
  }

  return allRows;
}

async function fetchApprovedForTable(tableConfig) {
  const [rows, fieldMap] = await Promise.all([
    fetchBaserowRows(tableConfig.tableId),
    fetchFieldMap(tableConfig.tableId),
  ]);
  const approvedRows = rows.filter((row) => isApprovedGeneration(row, tableConfig, fieldMap));
  return {
    tableConfig,
    rows,
    fieldMap,
    approvedRows,
    products: approvedRows.map((row) => normalizeProduct(row, tableConfig, fieldMap)),
  };
}

async function mapWithConcurrency(items, limit, worker) {
  const results = [];
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, runWorker);
  await Promise.all(workers);
  return results;
}

async function patchBaserowRow(tableId, rowId, payload) {
  assertConfig();

  const url = `${BASEROW_API_URL}/api/database/rows/table/${tableId}/${rowId}/`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Token ${BASEROW_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    const details = typeof data === "object" ? JSON.stringify(data) : String(data);
    const error = new Error(`Baserow update failed for table ${tableId}, row ${rowId}: ${details}`);
    error.status = response.status;
    error.errorType = data?.error || null;
    error.tableId = tableId;
    error.rowId = rowId;
    if (response.status === 401 || response.status === 403 || data?.error === "ERROR_NO_PERMISSION_TO_TABLE") {
      error.isPermissionError = true;
    }
    throw error;
  }

  return data;
}

function buildApprovePayload(tableConfig) {
  return {
    [tableConfig.fields.shopify]: SHOPIFY_NOTES_APPROVED_VALUE,
  };
}

function buildRejectPayload(tableConfig, commentText) {
  const payload = {
    [tableConfig.fields.shopify]: SHOPIFY_NOTES_REJECT_VALUE,
    [tableConfig.fields.generationStatus]: GENERATION_STATUS_FAILED_VALUE,
  };

  if (tableConfig.fields.comment) {
    payload[tableConfig.fields.comment] = commentText;
  }

  return payload;
}

function updatePermissionResponse(res, error) {
  return res.status(error.status || 403).json({
    success: false,
    tableId: error.tableId,
    rowId: error.rowId,
    error: "Baserow token can read this table but cannot update one or more required fields.",
    detail: error.message,
    fix: [
      "Open Baserow database token settings.",
      `Grant update access to table ${error.tableId}.`,
      "Grant update access to the table-specific SHOPIFY field.",
      "Grant update access to the table-specific Comment field when present.",
      "Restart Node server.",
    ],
  });
}

app.get("/api/health", (req, res) => {
  try {
    assertConfig();
    res.json({
      success: true,
      message: "Backend is running. Baserow token is configured.",
      databaseId: BASEROW_DATABASE_ID,
      tableMode: "multi-table",
      totalTables: SAREE_TABLES.length,
    });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, error: error.message });
  }
});

app.get("/api/collections", async (req, res) => {
  const collections = [];
  const errors = [];

  await mapWithConcurrency(SAREE_TABLES, 4, async (tableConfig) => {
    try {
      const { approvedRows } = await fetchApprovedForTable(tableConfig);
      collections.push({
        name: tableConfig.name,
        tableId: tableConfig.tableId,
        count: approvedRows.length,
        error: null,
      });
    } catch (error) {
      const item = {
        name: tableConfig.name,
        tableId: tableConfig.tableId,
        count: 0,
        error: error.baserow || error.message,
      };
      collections.push(item);
      errors.push(item);
    }
  });

  collections.sort((a, b) =>
    SAREE_TABLES.findIndex((table) => table.tableId === a.tableId) -
    SAREE_TABLES.findIndex((table) => table.tableId === b.tableId)
  );

  res.json({
    success: true,
    total: collections.reduce((sum, item) => sum + item.count, 0),
    collections,
    errors,
  });
});

app.get("/api/products", async (req, res) => {
  try {
    const { tableId, collection, search, status, sort } = req.query;
    let tablesToFetch = SAREE_TABLES;
    let mode = "all-tables";

    if (tableId) {
      const tableConfig = getTableConfig(tableId);
      if (!tableConfig) {
        return res.status(400).json({ success: false, error: `Unknown tableId ${tableId}` });
      }
      tablesToFetch = [tableConfig];
      mode = "table";
    } else if (collection) {
      const tableConfig = getTableConfigByName(collection);
      if (!tableConfig) {
        return res.status(400).json({ success: false, error: `Unknown collection ${collection}` });
      }
      tablesToFetch = [tableConfig];
      mode = "collection";
    }

    const products = [];
    const collections = [];
    const errors = [];

    await mapWithConcurrency(tablesToFetch, 4, async (tableConfig) => {
      try {
        const result = await fetchApprovedForTable(tableConfig);
        products.push(...result.products);
        collections.push({
          name: tableConfig.name,
          tableId: tableConfig.tableId,
          count: result.products.length,
          error: null,
        });
      } catch (error) {
        const item = {
          name: tableConfig.name,
          tableId: tableConfig.tableId,
          count: 0,
          error: error.baserow || error.message,
        };
        collections.push(item);
        errors.push(item);
      }
    });

    collections.sort((a, b) =>
      SAREE_TABLES.findIndex((table) => table.tableId === a.tableId) -
      SAREE_TABLES.findIndex((table) => table.tableId === b.tableId)
    );

    const filteredProducts = applyProductFilters(products, { search, status, sort });

    res.json({
      success: true,
      count: filteredProducts.length,
      products: filteredProducts,
      collections,
      errors,
      debug: {
        mode,
        totalTables: tablesToFetch.length,
        successfulTables: collections.filter((item) => !item.error).length,
        failedTables: errors.length,
        filter: "Generation Status = Approved",
      },
    });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ success: false, error: error.message });
  }
});

app.patch("/api/products/:tableId/:rowId/approve", async (req, res) => {
  try {
    const { tableId, rowId } = req.params;
    const tableConfig = getTableConfig(tableId);
    if (!tableConfig) return res.status(400).json({ success: false, tableId, rowId, error: `Unknown tableId ${tableId}` });

    const updatedRow = await patchBaserowRow(tableId, rowId, buildApprovePayload(tableConfig));
    const fieldMap = await fetchFieldMap(tableId);

    res.json({
      success: true,
      tableId: Number(tableId),
      rowId: Number(rowId),
      action: "approve",
      message: "Product approved for Shopify.",
      row: normalizeProduct(updatedRow, tableConfig, fieldMap),
    });
  } catch (error) {
    console.error(error);
    if (error.isPermissionError || error.status === 401 || error.status === 403) return updatePermissionResponse(res, error);
    res.status(error.status || 500).json({ success: false, tableId: error.tableId, rowId: error.rowId, error: error.message });
  }
});

app.patch("/api/products/:tableId/:rowId/request-changes", async (req, res) => {
  try {
    const { tableId, rowId } = req.params;
    const tableConfig = getTableConfig(tableId);
    if (!tableConfig) return res.status(400).json({ success: false, tableId, rowId, error: `Unknown tableId ${tableId}` });

    const { changeType = "Other", feedback = "", comment = "" } = req.body || {};
    const feedbackText = feedback || comment || "Changes requested from review portal.";
    const finalComment = `Change Type: ${changeType}\n\n${feedbackText}`;
    const updatedRow = await patchBaserowRow(tableId, rowId, buildRejectPayload(tableConfig, finalComment));
    const fieldMap = await fetchFieldMap(tableId);

    res.json({
      success: true,
      tableId: Number(tableId),
      rowId: Number(rowId),
      action: "request-changes",
      message: "Request changes saved.",
      row: normalizeProduct(updatedRow, tableConfig, fieldMap),
    });
  } catch (error) {
    console.error(error);
    if (error.isPermissionError || error.status === 401 || error.status === 403) return updatePermissionResponse(res, error);
    res.status(error.status || 500).json({ success: false, tableId: error.tableId, rowId: error.rowId, error: error.message });
  }
});

app.patch("/api/products/:tableId/:rowId/reject", async (req, res) => {
  try {
    const { tableId, rowId } = req.params;
    const tableConfig = getTableConfig(tableId);
    if (!tableConfig) return res.status(400).json({ success: false, tableId, rowId, error: `Unknown tableId ${tableId}` });

    const { feedback = "", comment = "" } = req.body || {};
    const feedbackText = feedback || comment || "Rejected from review portal";
    const updatedRow = await patchBaserowRow(tableId, rowId, buildRejectPayload(tableConfig, feedbackText));
    const fieldMap = await fetchFieldMap(tableId);

    res.json({
      success: true,
      tableId: Number(tableId),
      rowId: Number(rowId),
      action: "reject",
      message: "Product rejected.",
      row: normalizeProduct(updatedRow, tableConfig, fieldMap),
    });
  } catch (error) {
    console.error(error);
    if (error.isPermissionError || error.status === 401 || error.status === 403) return updatePermissionResponse(res, error);
    res.status(error.status || 500).json({ success: false, tableId: error.tableId, rowId: error.rowId, error: error.message });
  }
});

app.patch("/api/products/:rowId/approve", (req, res) => {
  res.status(400).json({
    success: false,
    error: "Legacy route cannot update multi-table rows. Use /api/products/:tableId/:rowId/approve.",
  });
});

app.patch("/api/products/:rowId/request-changes", (req, res) => {
  res.status(400).json({
    success: false,
    error: "Legacy route cannot update multi-table rows. Use /api/products/:tableId/:rowId/request-changes.",
  });
});

app.patch("/api/products/:rowId/reject", (req, res) => {
  res.status(400).json({
    success: false,
    error: "Legacy route cannot update multi-table rows. Use /api/products/:tableId/:rowId/reject.",
  });
});

app.get("/api/baserow/diagnose", async (req, res) => {
  try {
    assertConfig();
    const tables = [];

    await mapWithConcurrency(SAREE_TABLES, 4, async (tableConfig) => {
      try {
        const { approvedRows, fieldMap } = await fetchApprovedForTable(tableConfig);
        const validation = validateTableFields(tableConfig, fieldMap);
        tables.push({
          name: tableConfig.name,
          tableId: tableConfig.tableId,
          readAccess: true,
          approvedRows: approvedRows.length,
          shopifyField: tableConfig.fields.shopify,
          commentField: tableConfig.fields.comment,
          generationStatusField: tableConfig.fields.generationStatus,
          liveFields: validation.fields,
          warnings: validation.warnings,
          error: null,
        });
      } catch (error) {
        tables.push({
          name: tableConfig.name,
          tableId: tableConfig.tableId,
          readAccess: false,
          approvedRows: 0,
          shopifyField: tableConfig.fields.shopify,
          commentField: tableConfig.fields.comment,
          generationStatusField: tableConfig.fields.generationStatus,
          liveFields: null,
          warnings: [],
          error: error.baserow || error.message,
        });
      }
    });

    tables.sort((a, b) =>
      SAREE_TABLES.findIndex((table) => table.tableId === a.tableId) -
      SAREE_TABLES.findIndex((table) => table.tableId === b.tableId)
    );

    const accessibleTables = tables.filter((table) => table.readAccess).length;
    const failedTables = tables.length - accessibleTables;
    const warningCount = tables.reduce((sum, table) => sum + table.warnings.length, 0);

    res.json({
      success: failedTables === 0,
      databaseId: BASEROW_DATABASE_ID,
      tables,
      summary: {
        totalTables: SAREE_TABLES.length,
        accessibleTables,
        failedTables,
        warningCount,
        totalApprovedRows: tables.reduce((sum, table) => sum + table.approvedRows, 0),
      },
    });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, error: error.message });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Janardhana Saree Review Portal running at http://localhost:${PORT}`);
});
