import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
dotenv.config();


const app = express();
const PORT = process.env.PORT || 3002;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASEROW_API_URL = process.env.BASEROW_API_URL || "https://api.baserow.io";
const BASEROW_DATABASE_ID = process.env.BASEROW_DATABASE_ID || "419522";
const BASEROW_TABLE_ID = process.env.BASEROW_TABLE_ID || "948083";
const BASEROW_VIEW_ID = process.env.BASEROW_VIEW_ID || "1859321";
const BASEROW_TOKEN = process.env.BASEROW_TOKEN;

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

function getSelectValue(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") return value.value || value.name || "";
  return String(value);
}

function getFileUrl(field) {
  if (!Array.isArray(field) || field.length === 0) return null;

  const file = field[0];

  return (
    file?.url ||
    file?.thumbnails?.card_cover?.url ||
    file?.thumbnails?.small?.url ||
    null
  );
}

function getAllFileUrls(field) {
  if (!Array.isArray(field)) return [];
  return field
    .map((file) => file?.url || file?.thumbnails?.card_cover?.url || file?.thumbnails?.small?.url || null)
    .filter(Boolean);
}

function parsePrice(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  const cleaned = String(value).replace(/[^\d.]/g, "");
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeProduct(row) {
  return {
    id: row.id,
    code: row["Product Code"] || row["SKU"] || row["Product SKU"] || `ROW-${row.id}`,
    title: row["Product Title"] || row["Title"] || "Untitled Saree",
    category: getSelectValue(row["Category"]) || "Uncategorized",
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
      allVideos: getAllFileUrls(row["Video"]),
    },
  };
}

function matchesCategory(product, category) {
  if (!category || category === "All Collections") return true;

  const categoryValue = String(product.category || "").toLowerCase();
  const specs = String(product.specifications || "").toLowerCase();
  const target = String(category || "").toLowerCase();

  const aliases = {
    "kanjivaram silks": ["kanjivaram", "kanjeevaram", "kanchipuram", "kanjivaram sarees collection"],
    "pure silk sarees": ["pure silk"],
    "tussar silk saree": ["tussar", "tussar silk"],
    "south weaves – south silk sarees": ["south silk", "south weaves"],
    "soft silk sarees": ["soft silk"],
    "patola & orissa silk sarees": ["patola", "orissa"],
    "printed pure silk sarees": ["printed pure silk"],
    "cotton silk sarees": ["cotton silk"],
    "paithani silk sarees": ["paithani"],
    "banarasi georgette silk sarees": ["banarasi georgette"],
    "banarasi silk sarees": ["banarasi silk"],
    "banarasi kora silk saree": ["banarasi kora"],
    "gadwal handloom": ["gadwal"],
    "jamawar silk sarees": ["jamawar"],
    "cotton saree": ["cotton saree", "cotton sarees"],
    "linen & kota silk sarees": ["linen", "kota"],
    "art silk sarees": ["art silk"],
    "bandhani silk saree": ["bandhani"],
  };

  const words = aliases[target] || [target];

  return words.some((word) => categoryValue.includes(word) || specs.includes(word));
}

async function fetchBaserowRowsInternal(useView = true) {
  assertConfig();

  let page = 1;
  let allRows = [];
  let hasNext = true;
  let firstUrl = "";

  while (hasNext) {
    const params = new URLSearchParams({
      user_field_names: "true",
      size: "100",
      page: String(page),
    });

    if (useView && BASEROW_VIEW_ID && String(BASEROW_VIEW_ID).trim() !== "") {
      params.set("view_id", String(BASEROW_VIEW_ID));
    }

    const url = `${BASEROW_API_URL}/api/database/rows/table/${BASEROW_TABLE_ID}/?${params.toString()}`;
    if (!firstUrl) firstUrl = url;

    const response = await fetch(url, {
      headers: {
        Authorization: `Token ${BASEROW_TOKEN}`,
        Accept: "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.error || `Baserow fetch failed`);
      error.status = response.status;
      error.errorType = data.error;
      error.detail = data.detail;
      throw error;
    }

    allRows = allRows.concat(data.results || []);
    hasNext = Boolean(data.next);
    page += 1;
  }

  return { rows: allRows, finalUrl: firstUrl };
}

async function fetchBaserowRows() {
  try {
    if (BASEROW_VIEW_ID && String(BASEROW_VIEW_ID).trim() !== "") {
      return await fetchBaserowRowsInternal(true);
    } else {
      return await fetchBaserowRowsInternal(false);
    }
  } catch (error) {
    if (BASEROW_VIEW_ID && String(BASEROW_VIEW_ID).trim() !== "" && error.errorType !== "ERROR_NO_PERMISSION_TO_TABLE") {
      console.warn("View-based fetch failed, retrying without view_id...", error.message);
      return await fetchBaserowRowsInternal(false);
    }
    throw error;
  }
}

async function patchBaserowRow(rowId, payload, userFieldNames = true) {
  assertConfig();

  const url = `${BASEROW_API_URL}/api/database/rows/table/${BASEROW_TABLE_ID}/${rowId}/?user_field_names=${userFieldNames ? "true" : "false"}`;

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
    const error = new Error(`Baserow update failed: ${details}`);
    error.status = response.status;
    error.errorType = data?.error || null;

    // Detect permission-specific failures
    if (response.status === 401 || response.status === 403 || data?.error === "ERROR_NO_PERMISSION_TO_TABLE") {
      error.isPermissionError = true;
    }
    throw error;
  }

  return data;
}

async function updateBaserowRow(rowId, userFieldPayload, fieldIdPayload) {
  try {
    return await patchBaserowRow(rowId, userFieldPayload, true);
  } catch (firstError) {
    if (!fieldIdPayload) throw firstError;

    console.log(`Retrying with field IDs for row ${rowId}...`);
    console.warn(`Baserow string select update failed for row ${rowId}; retrying with field IDs.`);
    try {
      return await patchBaserowRow(rowId, fieldIdPayload, false);
    } catch (secondError) {
      secondError.message = `${secondError.message}. Original string-field update error: ${firstError.message}`;
      throw secondError;
    }
  }
}

app.get("/api/health", async (req, res) => {
  try {
    assertConfig();
    res.json({
      success: true,
      message: "Backend is running. Baserow token is configured.",
      tableId: BASEROW_TABLE_ID,
      viewId: BASEROW_VIEW_ID,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/api/products", async (req, res) => {
  try {
    const { category, search, status, sort } = req.query;

    const { rows, finalUrl } = await fetchBaserowRows();

    const approvedRows = rows.filter((row) => {
      const generationStatus = row["Generation Status"];
      return generationStatus?.value === "Approved" || generationStatus?.id === 5987929 || generationStatus === "Approved";
    });

    let products = approvedRows.map(normalizeProduct);

    if (category) {
      products = products.filter((product) => matchesCategory(product, category));
    }

    if (search) {
      const q = String(search).toLowerCase();
      products = products.filter((product) =>
        String(product.code || "").toLowerCase().includes(q) ||
        String(product.title || "").toLowerCase().includes(q)
      );
    }

    if (status && status !== "All Statuses") {
      products = products.filter((product) =>
        product.generationStatus === status ||
        product.approvalStatus === status ||
        product.shopify === status
      );
    }

    if (sort === "Price High to Low") {
      products.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    } else if (sort === "Price Low to High") {
      products.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    } else if (sort === "Title A-Z") {
      products.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
    }

    console.log("Final Baserow URL", finalUrl);
    console.log("Total rows fetched", rows.length);
    console.log("Rows after Generation Status Approved filter", approvedRows.length);
    console.log("Rows after category/search/status filters", products.length);
    console.log("First product code", products[0]?.code || "");
    console.log("First product Grid View URL", products[0]?.images?.grid || "");

    res.json({
      success: true,
      count: products.length,
      products,
      debug: {
        tableId: BASEROW_TABLE_ID,
        viewId: BASEROW_VIEW_ID,
        totalRows: rows.length,
        approvedRows: approvedRows.length,
        filteredRows: products.length,
        filter: "Generation Status = Approved",
      },
    });
  } catch (error) {
    console.error(error);
    if (error.errorType === "ERROR_NO_PERMISSION_TO_TABLE") {
      return res.status(403).json({
        success: false,
        error: "Unable to connect with Baserow due to missing permissions.",
        errorType: "ERROR_NO_PERMISSION_TO_TABLE",
        fix: [
          "Open your Baserow database settings",
          "Go to Database Tokens",
          "Ensure the token has Read/Write access to table 948083"
        ]
      });
    }
    res.status(error.status || 500).json({
      success: false,
      error: error.message,
    });
  }
});

app.patch("/api/products/:rowId/approve", async (req, res) => {
  try {
    const { rowId } = req.params;
    console.log(`PATCH approve rowId=${rowId}`);

    if (!rowId || isNaN(Number(rowId))) {
      return res.status(400).json({ success: false, error: "Invalid or missing rowId." });
    }

    const updatedRow = await updateBaserowRow(
      rowId,
      { SHOPIFY: "Approved" },
      { [FIELD_IDS.shopify]: OPTION_IDS.shopifyApproved },
    );

    res.json({
      success: true,
      message: "Product approved for Shopify.",
      row: normalizeProduct(updatedRow),
    });
  } catch (error) {
    console.error(error);
    if (error.isPermissionError || error.status === 401 || error.status === 403) {
      return res.status(403).json({
        success: false,
        error: "Baserow token can read this table but cannot update one or more required fields.",
        fix: [
          "Open Baserow database token settings",
          "Grant update access to SHOPIFY",
          "Grant update access to Approvel",
          "Grant update access to Comment",
          "Restart Node server"
        ]
      });
    }
    res.status(error.status || 500).json({
      success: false,
      error: error.message,
    });
  }
});

app.patch("/api/products/:rowId/request-changes", async (req, res) => {
  try {
    const { rowId } = req.params;
    console.log(`PATCH request-changes rowId=${rowId}`);

    if (!rowId || isNaN(Number(rowId))) {
      return res.status(400).json({ success: false, error: "Invalid or missing rowId." });
    }

    const { changeType = "Other", comment = "" } = req.body || {};

    const finalComment = `Change Type: ${changeType}\n\n${comment || "Changes requested from review portal."}`;

    const updatedRow = await updateBaserowRow(
      rowId,
      {
        SHOPIFY: "Reject",
        Approvel: "Reject",
        Comment: finalComment,
      },
      {
        [FIELD_IDS.shopify]: OPTION_IDS.shopifyReject,
        [FIELD_IDS.approvel]: OPTION_IDS.approvelReject,
        [FIELD_IDS.comment]: finalComment,
      },
    );

    res.json({
      success: true,
      message: "Request changes saved.",
      row: normalizeProduct(updatedRow),
    });
  } catch (error) {
    console.error(error);
    if (error.isPermissionError || error.status === 401 || error.status === 403) {
      return res.status(403).json({
        success: false,
        error: "Baserow token can read this table but cannot update one or more required fields.",
        fix: [
          "Open Baserow database token settings",
          "Grant update access to SHOPIFY",
          "Grant update access to Approvel",
          "Grant update access to Comment",
          "Restart Node server"
        ]
      });
    }
    res.status(error.status || 500).json({
      success: false,
      error: error.message,
    });
  }
});

app.patch("/api/products/:rowId/reject", async (req, res) => {
  try {
    const { rowId } = req.params;
    console.log(`PATCH reject rowId=${rowId}`);

    if (!rowId || isNaN(Number(rowId))) {
      return res.status(400).json({ success: false, error: "Invalid or missing rowId." });
    }

    const { comment = "Rejected from review portal" } = req.body || {};

    const updatedRow = await updateBaserowRow(
      rowId,
      {
        SHOPIFY: "Reject",
        Approvel: "Reject",
        Comment: comment,
      },
      {
        [FIELD_IDS.shopify]: OPTION_IDS.shopifyReject,
        [FIELD_IDS.approvel]: OPTION_IDS.approvelReject,
        [FIELD_IDS.comment]: comment,
      },
    );

    res.json({
      success: true,
      message: "Product rejected.",
      row: normalizeProduct(updatedRow),
    });
  } catch (error) {
    console.error(error);
    if (error.isPermissionError || error.status === 401 || error.status === 403) {
      return res.status(403).json({
        success: false,
        error: "Baserow token can read this table but cannot update one or more required fields.",
        fix: [
          "Open Baserow database token settings",
          "Grant update access to SHOPIFY",
          "Grant update access to Approvel",
          "Grant update access to Comment",
          "Restart Node server"
        ]
      });
    }
    res.status(error.status || 500).json({
      success: false,
      error: error.message,
    });
  }
});

function maskToken(token) {
  if (!token) return "missing";
  if (token.length <= 8) return "configured-but-too-short";
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

app.get("/api/baserow/diagnose", async (req, res) => {
  const tokenConfigured = !!BASEROW_TOKEN;
  const tokenMasked = maskToken(BASEROW_TOKEN);

  const diagnostic = {
    success: false,
    config: {
      apiUrl: BASEROW_API_URL,
      databaseId: BASEROW_DATABASE_ID || null,
      tableId: BASEROW_TABLE_ID,
      viewId: BASEROW_VIEW_ID,
      tokenConfigured,
      tokenMasked,
    },
    tests: {
      tokenAccessibleTables: null,
      targetTableWithoutView: null,
      targetTableWithView: null,
      fieldsEndpoint: null,
    },
    finalDiagnosis: "",
    fix: [],
    nextSteps: [],
  };

  if (!tokenConfigured) {
    diagnostic.finalDiagnosis = "REST token is missing in .env";
    diagnostic.fix = [
      "Open your .env file",
      "Add BASEROW_TOKEN=your_token_value",
      "Restart the backend server"
    ];
    diagnostic.nextSteps = diagnostic.fix;
    return res.json(diagnostic);
  }

  const checkEndpoint = async (url) => {
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Token ${BASEROW_TOKEN}`,
          Accept: "application/json",
        },
      });
      const data = await response.json();
      return {
        status: response.status,
        ok: response.ok,
        data,
      };
    } catch (error) {
      return {
        status: 500,
        ok: false,
        error: error.message,
      };
    }
  };

  // Test 1: Accessible tables
  const tablesResult = await checkEndpoint(`${BASEROW_API_URL}/api/database/tables/all-tables/`);
  diagnostic.tests.tokenAccessibleTables = {
    status: tablesResult.status,
    ok: tablesResult.ok,
    tables: tablesResult.ok && Array.isArray(tablesResult.data)
      ? tablesResult.data.map(t => ({ id: t.id, name: t.name, databaseId: t.database_id }))
      : null,
    error: !tablesResult.ok ? (tablesResult.data || tablesResult.error) : null,
  };

  // Test 2: Target table without view
  const noViewResult = await checkEndpoint(`${BASEROW_API_URL}/api/database/rows/table/${BASEROW_TABLE_ID}/?user_field_names=true&size=1`);
  diagnostic.tests.targetTableWithoutView = {
    status: noViewResult.status,
    ok: noViewResult.ok,
    error: !noViewResult.ok ? (noViewResult.data || noViewResult.error) : null,
  };

  // Test 3: Target table with view
  let viewUrl = `${BASEROW_API_URL}/api/database/rows/table/${BASEROW_TABLE_ID}/?user_field_names=true&size=1`;
  if (BASEROW_VIEW_ID) {
    viewUrl += `&view_id=${BASEROW_VIEW_ID}`;
  }
  const withViewResult = await checkEndpoint(viewUrl);
  diagnostic.tests.targetTableWithView = {
    status: withViewResult.status,
    ok: withViewResult.ok,
    error: !withViewResult.ok ? (withViewResult.data || withViewResult.error) : null,
  };

  // Test 4: Fields endpoint
  const fieldsResult = await checkEndpoint(`${BASEROW_API_URL}/api/database/fields/table/${BASEROW_TABLE_ID}/`);
  diagnostic.tests.fieldsEndpoint = {
    status: fieldsResult.status,
    ok: fieldsResult.ok,
    error: !fieldsResult.ok ? (fieldsResult.data || fieldsResult.error) : null,
  };

  // Final diagnosis logic
  const allTablesOk = tablesResult.ok && Array.isArray(tablesResult.data);
  const targetTableInAll = allTablesOk && tablesResult.data.some(t => String(t.id) === String(BASEROW_TABLE_ID));
  const hasOtherDatabaseAccess = allTablesOk && tablesResult.data.some(t => String(t.database_id) !== String(BASEROW_DATABASE_ID));
  const noViewOk = noViewResult.ok;
  const withViewOk = withViewResult.ok;
  const fieldsOk = fieldsResult.ok;

  const noViewErrorType = noViewResult.data?.error;
  const withViewErrorType = withViewResult.data?.error;

  const targetPermissionFix = [
    "Open Baserow database 419522.",
    "Go to Database Tokens / API Token settings.",
    "Create a new REST database token inside database 419522.",
    "Grant Read access to table 948083.",
    "Grant Update access to table 948083.",
    "Grant update access to fields SHOPIFY, Approvel, Comment.",
    "Paste the new REST database token into .env as BASEROW_TOKEN.",
    "Restart Node server."
  ];

  if ((allTablesOk && !targetTableInAll) || (hasOtherDatabaseAccess && noViewErrorType === "ERROR_NO_PERMISSION_TO_TABLE")) {
    diagnostic.finalDiagnosis = "The REST token is valid, but it belongs to a different database or does not have permission to table 948083 in database 419522.";
    diagnostic.fix = targetPermissionFix;
    diagnostic.nextSteps = targetPermissionFix;
  } else if (noViewOk && !withViewOk) {
    diagnostic.finalDiagnosis = "Table access works, but BASEROW_VIEW_ID is invalid or inaccessible.";
    diagnostic.fix = [
      "Clear BASEROW_VIEW_ID or replace it with the correct view ID.",
      `Check if view ID ${BASEROW_VIEW_ID} exists in table ${BASEROW_TABLE_ID}.`,
      "Restart Node server."
    ];
    diagnostic.nextSteps = diagnostic.fix;
  } else if (noViewErrorType === "ERROR_NO_PERMISSION_TO_TABLE" && withViewErrorType === "ERROR_NO_PERMISSION_TO_TABLE") {
    diagnostic.finalDiagnosis = "The REST token is valid, but it belongs to a different database or does not have permission to table 948083 in database 419522.";
    diagnostic.fix = targetPermissionFix;
    diagnostic.nextSteps = targetPermissionFix;
  } else if (!fieldsOk && noViewOk) {
    diagnostic.finalDiagnosis = "Token can read rows but may not inspect fields.";
    diagnostic.fix = [
      "Grant field/schema access for table 948083 if field inspection is required.",
      "Rows may still work, but validation cannot confirm field names."
    ];
    diagnostic.nextSteps = diagnostic.fix;
  } else if (noViewOk && withViewOk) {
    diagnostic.success = true;
    diagnostic.finalDiagnosis = "REST API connection is working.";
    diagnostic.fix = [];
    diagnostic.nextSteps = ["No action needed."];
  } else {
    diagnostic.finalDiagnosis = "REST token lacks table permission or token is completely invalid.";
    diagnostic.fix = [
      "Verify the BASEROW_TOKEN matches the REST database token created in Baserow settings",
      "Verify that the token is not expired or deleted"
    ];
    diagnostic.nextSteps = diagnostic.fix;
  }

  res.json(diagnostic);
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Janardhana Saree Review Portal running at http://localhost:${PORT}`);
});
