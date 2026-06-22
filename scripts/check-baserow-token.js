import dotenv from "dotenv";

dotenv.config();

const BASEROW_API_URL = process.env.BASEROW_API_URL || "https://api.baserow.io";
const BASEROW_DATABASE_ID = process.env.BASEROW_DATABASE_ID || "419522";
const BASEROW_TOKEN = process.env.BASEROW_TOKEN;

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
  { name: "Linen & Kota Silk Sarees", tableId: 935217, fields: { generationStatus: "field_8123254", shopify: "field_8123257", comment: "field_8123255" } },
  { name: "Art Silk Sarees", tableId: 935218, fields: { generationStatus: "field_8123271", shopify: "field_8123274", comment: "field_8123272" } },
  { name: "Bandhani Silk Saree", tableId: 935212, fields: { generationStatus: "field_8123169", shopify: "field_8123172", comment: "field_8123170" } },
];

function maskToken(token) {
  if (!token) return "missing";
  if (token.length <= 8) return "configured-but-too-short";
  return `${token.slice(0, 4)}...${token.slice(-6)}`;
}

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
    const response = await fetch(`${BASEROW_API_URL}/api/database/rows/table/${tableConfig.tableId}/?size=100&page=${page}`, {
      headers: {
        Authorization: `Token ${BASEROW_TOKEN}`,
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

if (!BASEROW_TOKEN) {
  console.log("[FAIL] BASEROW_TOKEN is missing in .env.");
  process.exitCode = 1;
} else {
  console.log("Baserow REST token field-ID multi-table check");
  console.log(`API URL: ${BASEROW_API_URL}`);
  console.log(`Database ID: ${BASEROW_DATABASE_ID}`);
  console.log(`Token: ${maskToken(BASEROW_TOKEN)}`);
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
