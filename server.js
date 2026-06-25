import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { Redis } from "@upstash/redis";
import { createClient } from "redis";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASEROW_API_URL = process.env.BASEROW_API_URL || "https://api.baserow.io";
const BASEROW_DATABASE_ID = process.env.BASEROW_DATABASE_ID || "419522";
const BASEROW_TOKEN = process.env.BASEROW_TOKEN;
const CACHE_ENABLED = String(process.env.CACHE_ENABLED || "true").toLowerCase() !== "false";
const CACHE_PROVIDER = String(process.env.CACHE_PROVIDER || "").toLowerCase();
const CACHE_PREFIX = process.env.CACHE_PREFIX || `jsh:saree-review:${BASEROW_DATABASE_ID}:`;
const CACHE_PRODUCTS_TTL = Number(process.env.CACHE_TTL_PRODUCTS_SECONDS || process.env.CACHE_PRODUCTS_TTL || 60);
const CACHE_COLLECTIONS_TTL = Number(process.env.CACHE_TTL_COLLECTIONS_SECONDS || process.env.CACHE_COLLECTIONS_TTL || 180);
const CACHE_FIELDS_TTL = Number(process.env.CACHE_TTL_FIELDS_SECONDS || process.env.CACHE_FIELDS_TTL || 86400);
const CACHE_DIAGNOSE_TTL = Number(process.env.CACHE_TTL_DIAGNOSE_SECONDS || 60);
const CACHE_STALE_IF_ERROR = String(process.env.CACHE_STALE_IF_ERROR || "true").toLowerCase() !== "false";

const SHOPIFY_NOTES_APPROVED_VALUE = "Approved";
const SHOPIFY_NOTES_REJECT_VALUE = "Reject";
const GENERATION_STATUS_FAILED_VALUE = "Failed";

const REFERENCE_MEDIA_ALIASES = {
  full: ["Full Saree Image", "Saree Image", "Full Image"],
  blouse: ["Blouse Image", "Blouse"],
  pallu: ["Pallu Image", "Pallu"],
  border: ["Border Image", "Border"],
  fullSuit: ["Full Suit Image", "Front Suit Image", "Suit Full Image", "Full Salwar Suit Image", "Full Image"],
  suitBack: ["Back Image", "Suit Back Image", "Back Suit Image"],
};

const GENERATED_MEDIA_ALIASES = {
  front: ["Generated Front View", "Front View", "Front", "Generated Front"],
  side: ["Side View", "Generated Side View", "Side", "Generated Side"],
  back: ["Back View", "Generated Back View", "Back", "Generated Back"],
  close: [
    "Closeup View",
    "Close Up View",
    "Close-Up View",
    "Close-up View",
    "Closeup",
    "Close Up",
    "Close-Up",
    "Close-up",
    "Generated Closeup View",
    "Generated Close Up View",
    "Generated Close-Up View",
    "Generated Close-up View",
  ],
  grid: ["Grid View", "Generated Grid View", "Grid", "Generated Grid"],
  video: ["Video", "Generated Video", "Video Output", "Generated Video Output"],
};

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
const memoryCache = new Map();
let redisCloudClient = null;
let upstashClient = null;
let activeCacheProvider = CACHE_ENABLED ? "memory" : "disabled";
let cacheConnected = false;
let cacheFallback = CACHE_ENABLED ? "memory" : null;
const cacheStats = {
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0,
  errors: 0,
};

async function initializeCache() {
  if (!CACHE_ENABLED) return;

  if ((CACHE_PROVIDER === "redis" || (!CACHE_PROVIDER && process.env.REDIS_URL)) && process.env.REDIS_URL) {
    try {
      redisCloudClient = createClient({ url: process.env.REDIS_URL });
      redisCloudClient.on("error", (error) => {
        cacheStats.errors += 1;
        cacheConnected = false;
        activeCacheProvider = "memory";
        cacheFallback = "memory";
        console.warn("Redis cache connection warning:", error.message);
      });
      await redisCloudClient.connect();
      activeCacheProvider = "redis";
      cacheConnected = true;
      cacheFallback = null;
      return;
    } catch (error) {
      redisCloudClient = null;
      activeCacheProvider = "memory";
      cacheConnected = false;
      cacheFallback = "memory";
      cacheStats.errors += 1;
      console.warn("Redis cache unavailable; using memory cache:", error.message);
      return;
    }
  }

  if ((CACHE_PROVIDER === "upstash" || (!CACHE_PROVIDER && process.env.UPSTASH_REDIS_REST_URL)) && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    upstashClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    activeCacheProvider = "upstash";
    cacheConnected = true;
    cacheFallback = null;
    return;
  }

  activeCacheProvider = "memory";
  cacheConnected = false;
  cacheFallback = "memory";
}

function cacheProvider() {
  if (!CACHE_ENABLED) return "disabled";
  return activeCacheProvider;
}

function cacheKey(...parts) {
  return `${CACHE_PREFIX}${parts.map((part) => String(part)).join(":")}`;
}

function stableQueryKey(query) {
  return Object.entries(query || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("&") || "all";
}

function getMemoryCache(key) {
  const item = memoryCache.get(key);
  if (!item) return null;
  if (item.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return item.value;
}

function setMemoryCache(key, value, ttlSeconds) {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

async function cacheGet(key) {
  if (!CACHE_ENABLED) return null;
  try {
    let value;
    if (activeCacheProvider === "redis" && redisCloudClient?.isOpen) {
      const raw = await redisCloudClient.get(key);
      value = raw ? JSON.parse(raw) : null;
    } else if (activeCacheProvider === "upstash" && upstashClient) {
      value = await upstashClient.get(key);
    } else {
      value = getMemoryCache(key);
    }
    if (value === null || value === undefined) {
      cacheStats.misses += 1;
      return null;
    }
    cacheStats.hits += 1;
    return value;
  } catch (error) {
    cacheStats.errors += 1;
    console.warn("Cache get failed:", error.message);
    if (CACHE_STALE_IF_ERROR) return getMemoryCache(key);
    return null;
  }
}

async function cacheSet(key, value, ttlSeconds) {
  if (!CACHE_ENABLED) return;
  try {
    setMemoryCache(key, value, ttlSeconds);
    if (activeCacheProvider === "redis" && redisCloudClient?.isOpen) {
      await redisCloudClient.setEx(key, ttlSeconds, JSON.stringify(value));
    } else if (activeCacheProvider === "upstash" && upstashClient) {
      await upstashClient.set(key, value, { ex: ttlSeconds });
    } else {
      setMemoryCache(key, value, ttlSeconds);
    }
    cacheStats.sets += 1;
  } catch (error) {
    cacheStats.errors += 1;
    console.warn("Cache set failed:", error.message);
  }
}

async function cacheDelete(keys) {
  if (!CACHE_ENABLED) return;
  const list = Array.isArray(keys) ? keys.filter(Boolean) : [keys].filter(Boolean);
  if (!list.length) return;
  try {
    list.forEach((key) => memoryCache.delete(key));
    if (activeCacheProvider === "redis" && redisCloudClient?.isOpen) {
      await redisCloudClient.del(list);
    } else if (activeCacheProvider === "upstash" && upstashClient) {
      await upstashClient.del(...list);
    } else {
      list.forEach((key) => memoryCache.delete(key));
    }
    cacheStats.deletes += list.length;
  } catch (error) {
    cacheStats.errors += 1;
    console.warn("Cache delete failed:", error.message);
  }
}

async function cacheDeleteByPrefix(prefix) {
  if (!CACHE_ENABLED) return;
  try {
    for (const key of memoryCache.keys()) {
      if (key.startsWith(prefix)) memoryCache.delete(key);
    }
    if (activeCacheProvider === "redis" && redisCloudClient?.isOpen) {
      let cursor = "0";
      do {
        const result = await redisCloudClient.scan(cursor, { MATCH: `${prefix}*`, COUNT: 100 });
        cursor = String(result.cursor);
        if (result.keys.length) await redisCloudClient.del(result.keys);
      } while (cursor !== "0");
    } else if (activeCacheProvider === "upstash" && upstashClient) {
      let cursor = 0;
      do {
        const [nextCursor, keys] = await upstashClient.scan(cursor, { match: `${prefix}*`, count: 100 });
        cursor = Number(nextCursor);
        if (keys.length) await upstashClient.del(...keys);
      } while (cursor !== 0);
    }
  } catch (error) {
    cacheStats.errors += 1;
    console.warn("Cache prefix delete failed:", error.message);
  }
}

async function invalidateProductCache(tableId = null) {
  await Promise.all([
    cacheDelete(cacheKey("collections", "all")),
    cacheDelete(cacheKey("diagnose", "all")),
    cacheDeleteByPrefix(cacheKey("products")),
    tableId ? cacheDelete(cacheKey("table", tableId, "approved")) : Promise.resolve(),
  ]);
}

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

function normalizeFieldName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "")
    .trim();
}

function getByAliases(row, aliases, fieldMap = null) {
  for (const alias of aliases) {
    const value = readField(row, null, alias, fieldMap);
    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }
  return null;
}

function getByNormalizedAliases(row, aliases) {
  if (!row) return null;

  const normalizedAliases = new Set(aliases.map((alias) => normalizeFieldName(alias)));

  for (const [key, value] of Object.entries(row)) {
    if (normalizedAliases.has(normalizeFieldName(key))) {
      return value;
    }
  }

  return null;
}

function rowWithFieldNames(rawRow, fields = []) {
  const fieldNameByRawKey = {};

  fields.forEach((field) => {
    fieldNameByRawKey[`field_${field.id}`] = field.name;
  });

  const result = { ...rawRow };

  for (const [key, value] of Object.entries(rawRow || {})) {
    const fieldName = fieldNameByRawKey[key];
    if (fieldName) {
      result[fieldName] = value;
    }
  }

  return result;
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

  const fieldsCacheKey = cacheKey("fields", tableId);
  const cachedFields = await cacheGet(fieldsCacheKey);
  if (Array.isArray(cachedFields)) {
    const fieldMap = {
      byName: new Map(cachedFields.map((field) => [field.name, `field_${field.id}`])),
      fields: cachedFields,
    };
    fieldMapCache.set(String(tableId), fieldMap);
    return fieldMap;
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
  await cacheSet(fieldsCacheKey, fields, CACHE_FIELDS_TTL);
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

function findFieldByAliases(fieldMap, aliases) {
  const normalizedAliases = new Set(aliases.map((alias) => normalizeFieldName(alias)));
  const field = fieldMap?.fields?.find((item) => normalizedAliases.has(normalizeFieldName(item.name)));
  return field ? { id: field.id, name: field.name, type: field.type } : null;
}

function detectMediaFields(fieldMap) {
  return {
    generatedMediaFields: Object.fromEntries(
      Object.entries(GENERATED_MEDIA_ALIASES).map(([key, aliases]) => [key, findFieldByAliases(fieldMap, aliases)])
    ),
    referenceMediaFields: Object.fromEntries(
      Object.entries(REFERENCE_MEDIA_ALIASES).map(([key, aliases]) => [key, findFieldByAliases(fieldMap, aliases)])
    ),
  };
}

function sampleMediaAvailability(rows, tableConfig, fieldMap) {
  const counts = {
    rowsChecked: rows.length,
    frontCount: 0,
    sideCount: 0,
    backCount: 0,
    closeCount: 0,
    gridCount: 0,
    videoCount: 0,
    fullSuitCount: 0,
    suitBackCount: 0,
  };

  rows.forEach((row) => {
    const images = normalizeProduct(row, tableConfig, fieldMap).images;
    if (images.front) counts.frontCount += 1;
    if (images.side) counts.sideCount += 1;
    if (images.back) counts.backCount += 1;
    if (images.close) counts.closeCount += 1;
    if (images.grid) counts.gridCount += 1;
    if (images.video) counts.videoCount += 1;
    if (images.fullSuit) counts.fullSuitCount += 1;
    if (images.suitBack) counts.suitBackCount += 1;
  });

  return counts;
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

function getFileUrl(value) {
  if (!value) return null;

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    const file = value[0];
    if (!file) return null;
    return (
      file.url ||
      file.thumbnails?.large?.url ||
      file.thumbnails?.card_cover?.url ||
      file.thumbnails?.small?.url ||
      file.thumbnails?.tiny?.url ||
      null
    );
  }

  if (typeof value === "object") {
    return (
      value.url ||
      value.thumbnails?.large?.url ||
      value.thumbnails?.card_cover?.url ||
      value.thumbnails?.small?.url ||
      value.thumbnails?.tiny?.url ||
      null
    );
  }

  return null;
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
  const namedRow = rowWithFieldNames(row, fieldMap?.fields || []);
  const images = {
    full: getFileUrl(getByNormalizedAliases(namedRow, REFERENCE_MEDIA_ALIASES.full)),
    blouse: getFileUrl(getByNormalizedAliases(namedRow, REFERENCE_MEDIA_ALIASES.blouse)),
    pallu: getFileUrl(getByNormalizedAliases(namedRow, REFERENCE_MEDIA_ALIASES.pallu)),
    border: getFileUrl(getByNormalizedAliases(namedRow, REFERENCE_MEDIA_ALIASES.border)),
    fullSuit: getFileUrl(getByNormalizedAliases(namedRow, REFERENCE_MEDIA_ALIASES.fullSuit)),
    suitBack: getFileUrl(getByNormalizedAliases(namedRow, REFERENCE_MEDIA_ALIASES.suitBack)),
    front: getFileUrl(getByNormalizedAliases(namedRow, GENERATED_MEDIA_ALIASES.front)),
    side: getFileUrl(getByNormalizedAliases(namedRow, GENERATED_MEDIA_ALIASES.side)),
    back: getFileUrl(getByNormalizedAliases(namedRow, GENERATED_MEDIA_ALIASES.back)),
    close: getFileUrl(getByNormalizedAliases(namedRow, GENERATED_MEDIA_ALIASES.close)),
    grid: getFileUrl(getByNormalizedAliases(namedRow, GENERATED_MEDIA_ALIASES.grid)),
    video: getFileUrl(getByNormalizedAliases(namedRow, GENERATED_MEDIA_ALIASES.video)),
  };

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
    images,
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
  const approvedCacheKey = cacheKey("table", tableConfig.tableId, "approved");
  const cached = await cacheGet(approvedCacheKey);
  if (cached) {
    return {
      ...cached,
      fieldMap: await fetchFieldMap(tableConfig.tableId),
    };
  }

  const [rows, fieldMap] = await Promise.all([
    fetchBaserowRows(tableConfig.tableId),
    fetchFieldMap(tableConfig.tableId),
  ]);
  const approvedRows = rows.filter((row) => isApprovedGeneration(row, tableConfig, fieldMap));
  const result = {
    tableConfig,
    rows,
    fieldMap,
    approvedRows,
    products: approvedRows.map((row) => normalizeProduct(row, tableConfig, fieldMap)),
  };
  await cacheSet(approvedCacheKey, {
    tableConfig,
    rows,
    approvedRows,
    products: result.products,
  }, CACHE_PRODUCTS_TTL);
  return result;
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

async function buildCollectionsPayload() {
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

  return {
    success: true,
    total: collections.reduce((sum, item) => sum + item.count, 0),
    collections,
    errors,
  };
}

async function buildProductsPayload(query = {}) {
  const { tableId, collection, search, status, sort } = query;
  let tablesToFetch = SAREE_TABLES;
  let mode = "all-tables";

  if (tableId) {
    const tableConfig = getTableConfig(tableId);
    if (!tableConfig) {
      const error = new Error(`Unknown tableId ${tableId}`);
      error.status = 400;
      throw error;
    }
    tablesToFetch = [tableConfig];
    mode = "table";
  } else if (collection) {
    const tableConfig = getTableConfigByName(collection);
    if (!tableConfig) {
      const error = new Error(`Unknown collection ${collection}`);
      error.status = 400;
      throw error;
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

  return {
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
  };
}

app.get("/api/collections", async (req, res) => {
  try {
    const key = cacheKey("collections", "all");
    const cached = await cacheGet(key);
    if (cached) {
      return res.json({ ...cached, cache: { provider: cacheProvider(), status: "hit", ttlSeconds: CACHE_COLLECTIONS_TTL } });
    }

    const payload = await buildCollectionsPayload();
    await cacheSet(key, payload, CACHE_COLLECTIONS_TTL);
    res.json({ ...payload, cache: { provider: cacheProvider(), status: "miss", ttlSeconds: CACHE_COLLECTIONS_TTL } });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ success: false, error: error.message });
  }
});

app.get("/api/products", async (req, res) => {
  try {
    const key = cacheKey("products", stableQueryKey(req.query));
    const cached = await cacheGet(key);
    if (cached) {
      return res.json({ ...cached, debug: { ...cached.debug, cache: { provider: cacheProvider(), status: "hit", ttlSeconds: CACHE_PRODUCTS_TTL } } });
    }

    const payload = await buildProductsPayload(req.query);
    await cacheSet(key, payload, CACHE_PRODUCTS_TTL);
    res.json({ ...payload, debug: { ...payload.debug, cache: { provider: cacheProvider(), status: "miss", ttlSeconds: CACHE_PRODUCTS_TTL } } });
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
    await invalidateProductCache(tableId);

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
    await invalidateProductCache(tableId);

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
    await invalidateProductCache(tableId);

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

app.get("/api/cache/status", (req, res) => {
  res.json({
    success: true,
    enabled: CACHE_ENABLED,
    provider: cacheProvider(),
    connected: cacheConnected,
    fallback: cacheFallback,
    ttlSeconds: {
      products: CACHE_PRODUCTS_TTL,
      collections: CACHE_COLLECTIONS_TTL,
      fields: CACHE_FIELDS_TTL,
      diagnose: CACHE_DIAGNOSE_TTL,
    },
    staleIfError: CACHE_STALE_IF_ERROR,
    prefixConfigured: Boolean(CACHE_PREFIX),
    memoryKeys: memoryCache.size,
    stats: cacheStats,
  });
});

app.post("/api/cache/refresh", async (req, res) => {
  try {
    await invalidateProductCache();

    const [collections, products] = await Promise.all([
      buildCollectionsPayload(),
      buildProductsPayload({}),
    ]);

    await Promise.all([
      cacheSet(cacheKey("collections", "all"), collections, CACHE_COLLECTIONS_TTL),
      cacheSet(cacheKey("products", stableQueryKey({})), products, CACHE_PRODUCTS_TTL),
    ]);

    res.json({
      success: true,
      provider: cacheProvider(),
      refreshed: {
        collections: collections.collections.length,
        products: products.count,
      },
      ttlSeconds: {
        products: CACHE_PRODUCTS_TTL,
        collections: CACHE_COLLECTIONS_TTL,
        fields: CACHE_FIELDS_TTL,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ success: false, error: error.message });
  }
});

app.get("/api/baserow/diagnose", async (req, res) => {
  try {
    assertConfig();
    const diagnoseCacheKey = cacheKey("diagnose", "all");
    const cached = await cacheGet(diagnoseCacheKey);
    if (cached) {
      return res.json({
        ...cached,
        cache: { provider: cacheProvider(), status: "hit", ttlSeconds: CACHE_DIAGNOSE_TTL },
      });
    }

    const tables = [];

    await mapWithConcurrency(SAREE_TABLES, 4, async (tableConfig) => {
      try {
        const { approvedRows, fieldMap } = await fetchApprovedForTable(tableConfig);
        const validation = validateTableFields(tableConfig, fieldMap);
        const mediaFields = detectMediaFields(fieldMap);
        const mediaWarnings = [];
        const isSuitTable = /suits?/i.test(tableConfig.name);

        if (isSuitTable) {
          if (!mediaFields.referenceMediaFields.fullSuit) mediaWarnings.push("Full Suit Image field was not found.");
          if (!mediaFields.referenceMediaFields.suitBack) mediaWarnings.push("Back Image field was not found.");
        } else if (!mediaFields.generatedMediaFields.close) {
          mediaWarnings.push("Closeup View field or closeup alias was not found.");
        }

        tables.push({
          name: tableConfig.name,
          collection: tableConfig.name,
          tableId: tableConfig.tableId,
          readAccess: true,
          approvedRows: approvedRows.length,
          shopifyField: tableConfig.fields.shopify,
          commentField: tableConfig.fields.comment,
          generationStatusField: tableConfig.fields.generationStatus,
          liveFields: validation.fields,
          generatedMediaFields: mediaFields.generatedMediaFields,
          referenceMediaFields: mediaFields.referenceMediaFields,
          sampleMediaAvailability: sampleMediaAvailability(approvedRows.slice(0, 100), tableConfig, fieldMap),
          warnings: [...validation.warnings, ...mediaWarnings],
          error: null,
        });
      } catch (error) {
        tables.push({
          name: tableConfig.name,
          collection: tableConfig.name,
          tableId: tableConfig.tableId,
          readAccess: false,
          approvedRows: 0,
          shopifyField: tableConfig.fields.shopify,
          commentField: tableConfig.fields.comment,
          generationStatusField: tableConfig.fields.generationStatus,
          liveFields: null,
          generatedMediaFields: null,
          referenceMediaFields: null,
          sampleMediaAvailability: null,
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

    const payload = {
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
    };

    await cacheSet(diagnoseCacheKey, payload, CACHE_DIAGNOSE_TTL);
    res.json({
      ...payload,
      cache: { provider: cacheProvider(), status: "miss", ttlSeconds: CACHE_DIAGNOSE_TTL },
    });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, error: error.message });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

await initializeCache();

app.listen(PORT, () => {
  console.log(`Janardhana Saree Review Portal running at http://localhost:${PORT}`);
});
