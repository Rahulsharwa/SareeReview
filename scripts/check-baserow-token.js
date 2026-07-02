import dotenv from "dotenv";

dotenv.config();

const BASEROW_BASE_URL = process.env.BASEROW_BASE_URL || process.env.BASEROW_API_URL || "https://api.baserow.io";
const SAREE_BASEROW_DATABASE_ID = process.env.SAREE_BASEROW_DATABASE_ID || process.env.BASEROW_DATABASE_ID || "419522";
const SAREE_BASEROW_TOKEN = process.env.SAREE_BASEROW_TOKEN || process.env.BASEROW_TOKEN;

const SAREE_TABLES = [
  { name: "Kanjivaram Silks", tableId: 948083, fields: { generationStatus: "field_8253052", shopify: "field_8253055", comment: "field_8253053" } },
  { name: "Pure Silk Sarees", tableId: 935204, fields: { generationStatus: "field_8123033", shopify: "field_8123036", comment: "field_8123034" } },
  { name: "Tussar Silk Saree", tableId: 948245, fields: { generationStatus: "field_8254631", shopify: "field_8254634", comment: "field_8254632" } },
  { name: "South Weaves - South Silk Sarees", tableId: 935205, fields: { generationStatus: "field_8123050", shopify: "field_8123053", comment: "field_8123051" } },
  { name: "Soft Silk Sarees", tableId: 935207, fields: { generationStatus: "field_8123084", shopify: "field_8123087", comment: "field_8123085" } },
  { name: "Patola & Orissa Silk Sarees", tableId: 935208, fields: { generationStatus: "field_8123101", shopify: "field_8123104", comment: "field_8123102" } },
  { name: "Printed Pure Silk Sarees", tableId: 935203, fields: { generationStatus: "field_8123016", shopify: "field_8123019", comment: "field_8123017" } },
  { name: "Cotton Silk Sarees", tableId: 935215, fields: { generationStatus: "field_8123220", shopify: "field_8123223", comment: "field_8123221" } },
  { name: "Paithani Silk Sarees", tableId: 935206, fields: { generationStatus: "field_8123067", shopify: "field_8123070", comment: "field_8123068" } },
  { name: "Banarasi Georgette Silk Sarees", tableId: 935209, fields: { generationStatus: "field_8123118", shopify: "field_8123121", comment: "field_8123119" } },
  { name: "Banarasi Silk Sarees", tableId: 935210, fields: { generationStatus: "field_8123135", shopify: "field_8123138", comment: "field_8123136" } },
  { name: "Banarasi Kora Silk Saree", tableId: 935211, fields: { generationStatus: "field_8123152", shopify: "field_8123155", comment: "field_8123153" } },
  { name: "Gadwal Handloom", tableId: 935213, fields: { generationStatus: "field_8123186", shopify: "field_8123189", comment: "field_8123187" } },
  { name: "Jamawar Silk Sarees", tableId: 935214, fields: { generationStatus: "field_8123203", shopify: "field_8123206", comment: null } },
  { name: "Cotton Saree", tableId: 935216, fields: { generationStatus: "field_8123237", shopify: "field_8123240", comment: "field_8123238" } },
  { name: "Cotton Suits", tableId: 936059, fields: { generationStatus: "field_8132747", shopify: "field_8132750", comment: "field_8132748" } },
  { name: "Silk Suits", tableId: 936060, fields: { generationStatus: "field_8132764", shopify: "field_8132767", comment: "field_8132765" } },
  { name: "Linen & Kota Silk Sarees", tableId: 935217, fields: { generationStatus: "field_8123254", shopify: "field_8123257", comment: "field_8123255" } },
  { name: "Art Silk Sarees", tableId: 935218, fields: { generationStatus: "field_8123271", shopify: "field_8123274", comment: "field_8123272" } },
  { name: "Bandhani Silk Saree", tableId: 935212, fields: { generationStatus: "field_8123169", shopify: "field_8123172", comment: "field_8123170" } },
  { name: "Men Accessories / Men Tie", tableId: 936098, fields: { generationStatus: "field_8133054", shopify: "field_8133057", comment: "field_8133056" } },
  { name: "Dupattas", tableId: 936099, fields: { generationStatus: "field_8133069", shopify: "field_8133072", comment: "field_8133070" } },
  { name: "Designer Blouses", tableId: 936100, fields: { generationStatus: "field_8133084", shopify: "field_8133087", comment: "field_8133086" } },
  { name: "Shawls", tableId: 936101, fields: { generationStatus: "field_8133109", shopify: "field_8133115", comment: "field_8133113" } },
  { name: "Silk Scarves", tableId: 936102, fields: { generationStatus: "field_8133130", shopify: "field_8133133", comment: "field_8133132" } },
  { name: "Silk Stoles", tableId: 936103, fields: { generationStatus: "field_8133145", shopify: "field_8133148", comment: "field_8133147" } },
  { name: "Fabrics / Silk Fabric", tableId: 948124, fields: { generationStatus: "field_8253764", shopify: "field_8253767", comment: "field_8253765" } },
];

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

  for (const table of SAREE_TABLES) {
    const result = await fetchRows(table);
    if (result.ok) {
      const approved = result.rows.filter((row) => isApprovedGeneration(row, table)).length;
      accessible += 1;
      totalApproved += approved;
      console.log(`[OK] ${table.name} (${table.tableId}): approved ${approved}, status=${table.fields.generationStatus}, shopify=${table.fields.shopify}, comment=${table.fields.comment || "none"}`);
    } else {
      failed += 1;
      console.log(`[FAIL] ${table.name} (${table.tableId}): HTTP ${result.status} ${result.error || ""}`);
    }
  }

  console.log("");
  console.log(`Accessible tables: ${accessible}/${SAREE_TABLES.length}`);
  console.log(`Failed tables: ${failed}`);
  console.log(`Approved rows: ${totalApproved}`);

  if (failed > 0) {
    console.log("");
    console.log("Fix in Baserow: grant this REST database token read/update access to every listed saree table.");
    process.exitCode = 1;
  }
}
