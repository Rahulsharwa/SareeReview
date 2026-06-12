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

const SAREE_TABLES = [
  { name: "Kanjivaram Silks", tableId: 948083 },
  { name: "Pure Silk Sarees", tableId: 935204 },
  { name: "Tussar Silk Saree", tableId: 948245 },
  { name: "South Weaves", tableId: 935205 },
  { name: "Soft Silk Sarees", tableId: 935207 },
  { name: "Patola & Orissa", tableId: 935208 },
  { name: "Printed Pure Silk", tableId: 935203 },
  { name: "Cotton Silk Sarees", tableId: 935215 },
  { name: "Paithani Silk Sarees", tableId: 935206 },
  { name: "Banarasi Georgette", tableId: 935209 },
  { name: "Banarasi Silk", tableId: 935210 },
  { name: "Banarasi Kora", tableId: 935211 },
  { name: "Gadwal Handloom", tableId: 935213 },
  { name: "Jamawar Silk", tableId: 935214 },
  { name: "Cotton Saree", tableId: 935216 },
  { name: "Linen & Kota", tableId: 935217 },
  { name: "Art Silk", tableId: 935218 },
  { name: "Bandhani Silk", tableId: 935212 },
];

const FIELD_IDS = {
  shopify: "field_8616094",
  comment: "field_8253053",
  approvel: "field_8253065",
};

const OPTION_IDS = {
  shopifyApproved: 6484359,
  shopifyReject: 6484360,
  approvelReject: 5987935,
};

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

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
  if (typeof value === "object") return value.value || value.name || "";
  return String(value);
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

function isApprovedGeneration(row) {
  const value = row["Generation Status"];
  return value?.value === "Approved" || value?.id === 5987929 || value === "Approved";
}

function normalizeProduct(row, tableConfig) {
  return {
    id: `${tableConfig.tableId}-${row.id}`,
    rowId: row.id,
    tableId: tableConfig.tableId,
    collectionName: tableConfig.name,
    code: row["Product Code"] || row["SKU"] || row["Product SKU"] || `ROW-${row.id}`,
    title: row["Product Title"] || row["Title"] || "Untitled Saree",
    category: getSelectValue(row["Category"]) || tableConfig.name,
    price: parsePrice(row["Price (INR)"] || row["Price"] || row["Pri..."]),
    generationStatus: getSelectValue(row["Generation Status"]),
    approvalStatus: getSelectValue(row["Approvel"]) || getSelectValue(row["Approval"]) || "Pending Review",
    shopify: getSelectValue(row["SHOPIFY"]) || "Pending",
    comment: row["Comment"] || "",
    modified: row["Last Modified"] || row["updated_on"] || row["created_on"] || "",
    specifications: row["Specifications"] || "",
    raw: {
      generationStatus: row["Generation Status"],
      shopify: row["SHOPIFY"],
      approvel: row["Approvel"],
    },
    images: {
      full: getFileUrl(row["Full Saree Image"]),
      blouse: getFileUrl(row["Blouse Image"]),
      pallu: getFileUrl(row["Pallu Image"]),
      border: getFileUrl(row["Border Image"]),
      front: getFileUrl(row["Generated Front View"]),
      side: getFileUrl(row["Side View"]),
      back: getFileUrl(row["Back View"]),
      close: getFileUrl(row["Close Up View"]),
      grid: getFileUrl(row["Grid View"]),
      video: getFileUrl(row["Video"]),
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
      user_field_names: "true",
      size: "100",
      page: String(page),
    });

    const url = `${BASEROW_API_URL}/api/database/rows/table/${tableId}/?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Token ${BASEROW_TOKEN}`,
        Accept: "application/json",
      },
    });

    const data = await response.json();

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
  const rows = await fetchBaserowRows(tableConfig.tableId);
  const approvedRows = rows.filter(isApprovedGeneration);
  return {
    tableConfig,
    rows,
    approvedRows,
    products: approvedRows.map((row) => normalizeProduct(row, tableConfig)),
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

async function patchBaserowRow(tableId, rowId, payload, userFieldNames = true) {
  assertConfig();

  const url = `${BASEROW_API_URL}/api/database/rows/table/${tableId}/${rowId}/?user_field_names=${userFieldNames ? "true" : "false"}`;
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

async function updateBaserowRow(tableId, rowId, userFieldPayload, fieldIdPayload) {
  try {
    return await patchBaserowRow(tableId, rowId, userFieldPayload, true);
  } catch (firstError) {
    if (!fieldIdPayload) throw firstError;
    console.warn(`Baserow string select update failed for table ${tableId}, row ${rowId}; retrying with field IDs.`);
    try {
      return await patchBaserowRow(tableId, rowId, fieldIdPayload, false);
    } catch (secondError) {
      secondError.message = `${secondError.message}. Original string-field update error: ${firstError.message}`;
      throw secondError;
    }
  }
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
      "Grant update access to SHOPIFY.",
      "Grant update access to Approvel.",
      "Grant update access to Comment.",
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

    const updatedRow = await updateBaserowRow(
      tableId,
      rowId,
      { SHOPIFY: "Approved" },
      { [FIELD_IDS.shopify]: OPTION_IDS.shopifyApproved }
    );

    res.json({
      success: true,
      message: "Product approved for Shopify.",
      row: normalizeProduct(updatedRow, tableConfig),
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

    const { changeType = "Other", comment = "" } = req.body || {};
    const finalComment = `Change Type: ${changeType}\n\n${comment || "Changes requested from review portal."}`;
    const updatedRow = await updateBaserowRow(
      tableId,
      rowId,
      { SHOPIFY: "Reject", Approvel: "Reject", Comment: finalComment },
      {
        [FIELD_IDS.shopify]: OPTION_IDS.shopifyReject,
        [FIELD_IDS.approvel]: OPTION_IDS.approvelReject,
        [FIELD_IDS.comment]: finalComment,
      }
    );

    res.json({
      success: true,
      message: "Request changes saved.",
      row: normalizeProduct(updatedRow, tableConfig),
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

    const { comment = "Rejected from review portal" } = req.body || {};
    const updatedRow = await updateBaserowRow(
      tableId,
      rowId,
      { SHOPIFY: "Reject", Approvel: "Reject", Comment: comment },
      {
        [FIELD_IDS.shopify]: OPTION_IDS.shopifyReject,
        [FIELD_IDS.approvel]: OPTION_IDS.approvelReject,
        [FIELD_IDS.comment]: comment,
      }
    );

    res.json({
      success: true,
      message: "Product rejected.",
      row: normalizeProduct(updatedRow, tableConfig),
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
        const { approvedRows } = await fetchApprovedForTable(tableConfig);
        tables.push({
          name: tableConfig.name,
          tableId: tableConfig.tableId,
          readAccess: true,
          approvedRows: approvedRows.length,
          error: null,
        });
      } catch (error) {
        tables.push({
          name: tableConfig.name,
          tableId: tableConfig.tableId,
          readAccess: false,
          approvedRows: 0,
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

    res.json({
      success: failedTables === 0,
      databaseId: BASEROW_DATABASE_ID,
      tables,
      summary: {
        totalTables: SAREE_TABLES.length,
        accessibleTables,
        failedTables,
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
