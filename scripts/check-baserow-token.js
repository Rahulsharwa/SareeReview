import dotenv from "dotenv";

dotenv.config();

const BASEROW_API_URL = process.env.BASEROW_API_URL || "https://api.baserow.io";
const BASEROW_DATABASE_ID = process.env.BASEROW_DATABASE_ID || "419522";
const BASEROW_TABLE_ID = process.env.BASEROW_TABLE_ID || "948083";
const BASEROW_VIEW_ID = process.env.BASEROW_VIEW_ID || "1859321";
const BASEROW_TOKEN = process.env.BASEROW_TOKEN;

function maskToken(token) {
  if (!token) return "missing";
  if (token.length <= 8) return "configured-but-too-short";
  return `${token.slice(0, 4)}...${token.slice(-6)}`;
}

async function check(name, url) {
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Token ${BASEROW_TOKEN}`,
        Accept: "application/json",
      },
    });

    const data = await response.json().catch(() => null);
    const error = data?.error || null;

    console.log(`${response.ok ? "[OK]" : "[FAIL]"} ${name}: HTTP ${response.status}${error ? ` ${error}` : ""}`);

    return {
      name,
      ok: response.ok,
      status: response.status,
      error,
      data,
    };
  } catch (error) {
    console.log(`[FAIL] ${name}: ${error.message}`);
    return {
      name,
      ok: false,
      status: 0,
      error: error.message,
      data: null,
    };
  }
}

function printNoPermissionFix() {
  console.log("");
  console.log("[FAIL] This REST token still does not have access to table 948083.");
  console.log("Fix in Baserow:");
  console.log("1. Open database 419522.");
  console.log("2. Open Database Tokens / API Token settings.");
  console.log("3. Create a new token inside database 419522, or edit the exact token used in .env.");
  console.log("4. Grant Read access to table 948083.");
  console.log("5. Grant Update access to table 948083.");
  console.log("6. Grant update access to SHOPIFY, Approvel, Comment.");
  console.log("7. Paste the new REST database token into .env.");
  console.log("8. Restart Node server.");
}

if (!BASEROW_TOKEN) {
  console.log("[FAIL] BASEROW_TOKEN is missing in .env.");
  process.exitCode = 1;
} else {
  console.log("Baserow REST token check");
  console.log(`API URL: ${BASEROW_API_URL}`);
  console.log(`Database ID: ${BASEROW_DATABASE_ID}`);
  console.log(`Table ID: ${BASEROW_TABLE_ID}`);
  console.log(`View ID: ${BASEROW_VIEW_ID || "not configured"}`);
  console.log(`Token: ${maskToken(BASEROW_TOKEN)}`);
  console.log("");

  const withoutViewUrl = `${BASEROW_API_URL}/api/database/rows/table/${BASEROW_TABLE_ID}/?user_field_names=true&size=1`;
  const withViewUrl = `${BASEROW_API_URL}/api/database/rows/table/${BASEROW_TABLE_ID}/?user_field_names=true&view_id=${BASEROW_VIEW_ID}&size=1`;
  const fieldsUrl = `${BASEROW_API_URL}/api/database/fields/table/${BASEROW_TABLE_ID}/`;

  const withoutView = await check("Rows endpoint without view_id", withoutViewUrl);
  const withView = await check("Rows endpoint with view_id", withViewUrl);
  const fields = await check("Fields endpoint", fieldsUrl);

  const hasNoPermission = [withoutView, withView, fields].some((result) => result.error === "ERROR_NO_PERMISSION_TO_TABLE");

  console.log("");
  if (hasNoPermission) {
    printNoPermissionFix();
    process.exitCode = 1;
  } else if (withoutView.ok && !withView.ok) {
    console.log("[OK] Table access works.");
    console.log("[FAIL] View 1859321 is invalid or inaccessible.");
    console.log("Fix: clear BASEROW_VIEW_ID or replace it with the correct view ID.");
    process.exitCode = 1;
  } else if (withoutView.ok && withView.ok && fields.ok) {
    console.log("[OK] REST Baserow token is valid for database 419522 / table 948083.");
    console.log("Now run npm run dev and open /api/products.");
  } else {
    console.log("[FAIL] Baserow token validation did not fully pass.");
    console.log("Review the failed endpoint above, then verify the token was created in database 419522.");
    process.exitCode = 1;
  }
}
