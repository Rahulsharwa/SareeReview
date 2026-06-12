import dotenv from "dotenv";

dotenv.config();

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

function maskToken(token) {
  if (!token) return "missing";
  if (token.length <= 8) return "configured-but-too-short";
  return `${token.slice(0, 4)}...${token.slice(-6)}`;
}

function isApprovedGeneration(row) {
  const value = row["Generation Status"];
  return value?.value === "Approved" || value?.id === 5987929 || value === "Approved";
}

async function fetchRows(tableId) {
  const response = await fetch(`${BASEROW_API_URL}/api/database/rows/table/${tableId}/?user_field_names=true&size=100`, {
    headers: {
      Authorization: `Token ${BASEROW_TOKEN}`,
      Accept: "application/json",
    },
  });
  const data = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, data, error: data?.error || null };
}

if (!BASEROW_TOKEN) {
  console.log("[FAIL] BASEROW_TOKEN is missing in .env.");
  process.exitCode = 1;
} else {
  console.log("Baserow REST token multi-table check");
  console.log(`API URL: ${BASEROW_API_URL}`);
  console.log(`Database ID: ${BASEROW_DATABASE_ID}`);
  console.log(`Token: ${maskToken(BASEROW_TOKEN)}`);
  console.log("");

  let accessible = 0;
  let failed = 0;
  let totalApproved = 0;

  for (const table of SAREE_TABLES) {
    const result = await fetchRows(table.tableId);
    if (result.ok) {
      const approved = (result.data?.results || []).filter(isApprovedGeneration).length;
      accessible += 1;
      totalApproved += approved;
      console.log(`[OK] ${table.name} (${table.tableId}): HTTP ${result.status}, approved on first page ${approved}`);
    } else {
      failed += 1;
      console.log(`[FAIL] ${table.name} (${table.tableId}): HTTP ${result.status} ${result.error || ""}`);
    }
  }

  console.log("");
  console.log(`Accessible tables: ${accessible}/${SAREE_TABLES.length}`);
  console.log(`Failed tables: ${failed}`);
  console.log(`Approved rows on checked pages: ${totalApproved}`);

  if (failed > 0) {
    console.log("");
    console.log("Fix in Baserow: grant this REST database token read/update access to every listed saree table.");
    process.exitCode = 1;
  }
}
