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
const CACHE_VERSION = "v3";
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

const MEDIA_PROFILES = {
  saree: {
    generated: [
      { label: "Front View", key: "front", type: "image", aliases: GENERATED_MEDIA_ALIASES.front },
      { label: "Side View", key: "side", type: "image", aliases: GENERATED_MEDIA_ALIASES.side },
      { label: "Back View", key: "back", type: "image", aliases: GENERATED_MEDIA_ALIASES.back },
      { label: "Close-up View", key: "close", type: "image", aliases: GENERATED_MEDIA_ALIASES.close },
      { label: "Grid View", key: "grid", type: "image", aliases: GENERATED_MEDIA_ALIASES.grid },
      { label: "Video", key: "video", type: "video", aliases: GENERATED_MEDIA_ALIASES.video },
    ],
    reference: [
      { label: "Full Saree Image", key: "full", type: "image", aliases: REFERENCE_MEDIA_ALIASES.full },
      { label: "Blouse Image", key: "blouse", type: "image", aliases: REFERENCE_MEDIA_ALIASES.blouse },
      { label: "Pallu Image", key: "pallu", type: "image", aliases: REFERENCE_MEDIA_ALIASES.pallu },
      { label: "Border Image", key: "border", type: "image", aliases: REFERENCE_MEDIA_ALIASES.border },
    ],
  },
  suit: {
    generated: [
      { label: "Front View", key: "front", type: "image", aliases: GENERATED_MEDIA_ALIASES.front },
      { label: "Side View", key: "side", type: "image", aliases: GENERATED_MEDIA_ALIASES.side },
      { label: "Back View", key: "back", type: "image", aliases: GENERATED_MEDIA_ALIASES.back },
      { label: "Close-up View", key: "close", type: "image", aliases: GENERATED_MEDIA_ALIASES.close },
      { label: "Grid View", key: "grid", type: "image", aliases: GENERATED_MEDIA_ALIASES.grid },
    ],
    reference: [
      { label: "Full Suit Image", key: "fullSuit", type: "image", aliases: REFERENCE_MEDIA_ALIASES.fullSuit },
      { label: "Back Image", key: "suitBack", type: "image", aliases: REFERENCE_MEDIA_ALIASES.suitBack },
    ],
  },
  menAccessory: {
    generated: [
      { label: "Generated Front View", key: "front", type: "image", aliases: ["Generated Front View", "Front View", "Front", "Generated Front", "field_8133053"] },
    ],
    reference: [],
  },
  dupatta: {
    generated: [
      { label: "Front View", key: "front", type: "image", aliases: ["Generated Front View", "Front View", "Front"] },
      { label: "Side View", key: "side", type: "image", aliases: ["Side View", "Generated Side View", "Side"] },
      { label: "Back View", key: "back", type: "image", aliases: ["Back View", "Generated Back View", "Back"] },
      { label: "Close-up View", key: "close", type: "image", aliases: ["Closeup View", "Close Up View", "Close-up View", "Close-Up View", "Generated Closeup View", "Generated Close Up View", "Generated Close-up View"] },
    ],
    reference: [],
  },
  designerBlouse: {
    generated: [
      { label: "Generated Front View", key: "front", type: "image", aliases: ["Generated Front View", "Front View", "Front"] },
      { label: "Generated Back View", key: "back", type: "image", aliases: ["Generated Back View", "Back View", "Back"] },
      { label: "Generated Detailed View", key: "detail", type: "image", aliases: ["Generated Detailed View", "Detailed View", "Detail View", "Sleeve Detail", "Close-up Detail"] },
    ],
    reference: [],
  },
  shawl: {
    generated: [
      { label: "Full Drape View", key: "fullDrape", type: "image", aliases: ["Full Drape View", "Generated Full Drape View"] },
      { label: "Shoulder Styling View", key: "shoulder", type: "image", aliases: ["Shoulder Styling View", "Shoulder View", "Generated Shoulder View"] },
      { label: "Folded Texture View", key: "foldedTexture", type: "image", aliases: ["Folded Texture View", "Texture View", "Generated Folded Texture View"] },
      { label: "Close-up Border View", key: "closeBorder", type: "image", aliases: ["Close-up Border View", "Closeup Border View", "Border Close-up View"] },
      { label: "Generated Front View", key: "front", type: "image", aliases: ["Generated Front View", "Front View"] },
      { label: "Close-up View", key: "close", type: "image", aliases: GENERATED_MEDIA_ALIASES.close },
    ],
    reference: [],
    dynamicGenerated: true,
  },
  silkScarf: {
    generated: [
      { label: "Flat Lay View", key: "flatLay", type: "image", aliases: ["Flat Lay View", "Flatlay View", "Generated Flat Lay", "Generated Flatlay"] },
      { label: "Shoulder View", key: "shoulder", type: "image", aliases: ["Shoulder View", "Shoulder Styling View", "Generated Shoulder View"] },
      { label: "Close-up View", key: "close", type: "image", aliases: ["Closeup View", "Close Up View", "Close-up View", "Close-Up View", "Fabric Detail", "Close-up Fabric Detail"] },
    ],
    reference: [],
  },
  silkStole: {
    generated: [
      { label: "Full Length", key: "fullLength", type: "image", aliases: ["Full Length", "Full Length View", "Generated Full Length"] },
      { label: "Shoulder View", key: "shoulder", type: "image", aliases: ["Shoulder View", "Engaged Shoulder", "Shoulder Styling View", "Generated Shoulder View"] },
      { label: "Front Facing Neck Wrap", key: "neckWrap", type: "image", aliases: ["Front Facing Neck Wrap", "Neck Wrap View", "Front Neck Wrap", "Generated Neck Wrap"] },
    ],
    reference: [],
  },
  fabric: {
    generated: [
      { label: "Luxury Chair Drape", key: "chairDrape", type: "image", aliases: ["Luxury Chair Drape", "Chair Drape", "Generated Chair Drape"] },
      { label: "Hanging Ladder Display", key: "ladder", type: "image", aliases: ["Hanging Ladder Display", "Ladder Display", "Generated Hanging Ladder"] },
      { label: "Fabric Roll + Cascading Drape", key: "rollDrape", type: "image", aliases: ["Fabric Roll + Cascading Drape", "Fabric Roll Cascading Drape", "Roll + Cascading Drape", "Generated Roll Drape"] },
      { label: "Artistic Spiral Flatlay Close-Up", key: "spiral", type: "image", aliases: ["Artistic Spiral Flatlay Close-Up", "Artistic Spiral Flatlay Closeup", "Spiral Flatlay Close-Up", "Spiral Flatlay", "Generated Spiral Flatlay"] },
    ],
    reference: [],
  },
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
    group: "Salwar Kameez",
    subcategory: "Cotton Suits",
    displayName: "Cotton Suits",
    mediaProfile: "suit",
    tableId: 936059,
    fields: {
      generationStatus: "field_8132747",
      shopify: "field_8132750",
      comment: "field_8132748",
    },
  },
  {
    name: "Silk Suits",
    group: "Salwar Kameez",
    subcategory: "Silk Suits",
    displayName: "Silk Suits",
    mediaProfile: "suit",
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
  {
    name: "Men Accessories",
    displayName: "Men Tie",
    group: "Accessories",
    subcategory: "Men Accessories",
    mediaProfile: "menAccessory",
    tableId: 936098,
    fields: {
      generationStatus: "field_8133054",
      shopify: "field_8133057",
      comment: "field_8133056",
    },
  },
  {
    name: "Dupattas",
    displayName: "Dupattas",
    group: "Accessories",
    subcategory: "Dupattas",
    mediaProfile: "dupatta",
    tableId: 936099,
    fields: {
      generationStatus: "field_8133069",
      shopify: "field_8133072",
      comment: "field_8133070",
    },
  },
  {
    name: "Designer Blouses",
    displayName: "Designer Blouses",
    group: "Accessories",
    subcategory: "Designer Blouses",
    mediaProfile: "designerBlouse",
    tableId: 936100,
    fields: {
      generationStatus: "field_8133084",
      shopify: "field_8133087",
      comment: "field_8133086",
    },
  },
  {
    name: "Shawls",
    displayName: "Shawls",
    group: "Accessories",
    subcategory: "Shawls",
    mediaProfile: "shawl",
    tableId: 936101,
    fields: {
      generationStatus: "field_8133109",
      shopify: "field_8133115",
      comment: "field_8133113",
    },
  },
  {
    name: "Silk Scarves",
    displayName: "Silk Scarves",
    group: "Accessories",
    subcategory: "Silk Scarves",
    mediaProfile: "silkScarf",
    tableId: 936102,
    fields: {
      generationStatus: "field_8133130",
      shopify: "field_8133133",
      comment: "field_8133132",
    },
  },
  {
    name: "Silk Stoles",
    displayName: "Silk Stoles",
    group: "Accessories",
    subcategory: "Silk Stoles",
    mediaProfile: "silkStole",
    tableId: 936103,
    fields: {
      generationStatus: "field_8133145",
      shopify: "field_8133148",
      comment: "field_8133147",
    },
  },
  {
    name: "Fabrics",
    displayName: "Silk Fabric",
    group: "Fabric",
    subcategory: "Silk Fabric",
    mediaProfile: "fabric",
    tableId: 948124,
    fields: {
      generationStatus: "field_8253764",
      shopify: "field_8253767",
      comment: "field_8253765",
    },
  },
];

SAREE_TABLES.forEach((table) => {
  if (!table.displayName) table.displayName = table.name;
  if (!table.group) table.group = /suits?/i.test(table.name) ? "Salwar Kameez" : "Saree Collections";
  if (!table.subcategory) table.subcategory = table.displayName;
  if (!table.mediaProfile) table.mediaProfile = table.group === "Salwar Kameez" ? "suit" : "saree";
  table.generationStatusFieldId = numericFieldId(table.fields.generationStatus);
  table.shopifyNotesFieldId = numericFieldId(table.fields.shopify);
  table.commentFieldId = numericFieldId(table.fields.comment);
});

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
  return `${CACHE_PREFIX}${parts.map((part) => String(part)).join(":")}:${CACHE_VERSION}`;
}

function legacyCacheKey(...parts) {
  return `${CACHE_PREFIX}${parts.map((part) => String(part)).join(":")}:v1`;
}

function versionedCacheKey(version, ...parts) {
  return `${CACHE_PREFIX}${parts.map((part) => String(part)).join(":")}:${version}`;
}

function stableQueryKey(query) {
  return Object.entries(query || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("&") || "all";
}

function productCacheKey(query = {}) {
  if (query.tableId) return cacheKey("products", "table", query.tableId);
  if (query.collection) return cacheKey("products", "collection", normalizeLookupName(query.collection));
  if (query.group) return cacheKey("products", "group", normalizeLookupName(query.group));
  return cacheKey("products", "all");
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
    cacheDelete(cacheKey("collections")),
    cacheDelete(cacheKey("diagnose")),
    cacheDeleteByPrefix(`${CACHE_PREFIX}products:`),
    tableId ? cacheDelete(cacheKey("products", "table-approved", tableId)) : Promise.resolve(),
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
  const target = normalizeLookupName(name);
  return SAREE_TABLES.find((table) =>
    normalizeLookupName(table.name) === target ||
    normalizeLookupName(table.displayName) === target ||
    normalizeLookupName(table.subcategory) === target
  );
}

function getTableConfigsByGroup(groupName) {
  const target = normalizeLookupName(groupName);
  return SAREE_TABLES.filter((table) => normalizeLookupName(table.group) === target);
}

function normalizeLookupName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function collectionGroupName(tableName) {
  if (typeof tableName === "object" && tableName) return tableName.group || "Saree Collections";
  const table = getTableConfigByName(tableName);
  return table?.group || "Saree Collections";
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
    .replace(/[\s_+\-]+/g, "")
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

  const fieldsCacheKey = cacheKey("fields", "table", tableId);
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
  const allGenerated = Object.fromEntries(
    Object.entries(MEDIA_PROFILES).flatMap(([, profile]) =>
      profile.generated.map((item) => [item.key, item.aliases])
    )
  );
  const allReference = Object.fromEntries(
    Object.entries(MEDIA_PROFILES).flatMap(([, profile]) =>
      profile.reference.map((item) => [item.key, item.aliases])
    )
  );

  return {
    generatedMediaFields: Object.fromEntries(
      Object.entries(allGenerated).map(([key, aliases]) => [key, findFieldByAliases(fieldMap, aliases)])
    ),
    referenceMediaFields: Object.fromEntries(
      Object.entries(allReference).map(([key, aliases]) => [key, findFieldByAliases(fieldMap, aliases)])
    ),
  };
}

function sampleMediaAvailability(rows, tableConfig, fieldMap) {
  const profile = MEDIA_PROFILES[tableConfig.mediaProfile] || MEDIA_PROFILES.saree;
  const counts = { rowsChecked: rows.length };
  [...profile.generated, ...profile.reference].forEach((item) => {
    counts[`${item.key}Count`] = 0;
  });

  rows.forEach((row) => {
    const images = normalizeProduct(row, tableConfig, fieldMap).images;
    [...profile.generated, ...profile.reference].forEach((item) => {
      if (images[item.key]) counts[`${item.key}Count`] += 1;
    });
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
  } else {
    const generationOptions = getSelectOptionValues(generationField);
    if (!generationOptions.includes("Approved")) {
      warnings.push(`Generation Status field ${tableConfig.fields.generationStatus} does not include option Approved.`);
    }
    if (!generationOptions.includes(GENERATION_STATUS_FAILED_VALUE)) {
      warnings.push(`Generation Status field ${tableConfig.fields.generationStatus} does not include option Failed.`);
    }
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

function mediaProfileFor(tableConfig) {
  return MEDIA_PROFILES[tableConfig.mediaProfile] || MEDIA_PROFILES.saree;
}

function buildMediaItems(namedRow, fieldMap, tableConfig, type) {
  const profile = mediaProfileFor(tableConfig);
  const configuredItems = profile[type] || [];
  const items = [];
  const seenKeys = new Set();

  configuredItems.forEach((item) => {
    const url = getFileUrl(getByNormalizedAliases(namedRow, item.aliases || []));
    items.push({ key: item.key, label: item.label, type: item.type || "image", url });
    seenKeys.add(item.key);
  });

  if (type === "generated" && profile.dynamicGenerated) {
    (fieldMap?.fields || []).forEach((field) => {
      if (!/file/i.test(String(field.type || ""))) return;
      const fieldName = String(field.name || "");
      if (!/(view|generated|drape|texture|border|close|front|shoulder|folded)/i.test(fieldName)) return;
      const key = slugify(fieldName).replace(/-/g, "_");
      if (seenKeys.has(key)) return;
      const url = getFileUrl(getByNormalizedAliases(namedRow, [fieldName, `field_${field.id}`]));
      if (!url) return;
      items.push({ key, label: fieldName, type: "image", url });
      seenKeys.add(key);
    });
  }

  return items;
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
  const generatedMedia = buildMediaItems(namedRow, fieldMap, tableConfig, "generated");
  const referenceMedia = buildMediaItems(namedRow, fieldMap, tableConfig, "reference");
  const images = Object.fromEntries(
    [...referenceMedia, ...generatedMedia].map((item) => [item.key, item.url])
  );

  return {
    id: `${tableConfig.tableId}:${row.id}`,
    rowId: row.id,
    tableId: tableConfig.tableId,
    collectionName: tableConfig.name,
    displayName: tableConfig.displayName,
    group: tableConfig.group,
    subcategory: tableConfig.subcategory,
    mediaProfile: tableConfig.mediaProfile,
    code: readField(row, null, "Product Code", fieldMap) || readField(row, null, "SKU", fieldMap) || readField(row, null, "Product SKU", fieldMap) || `ROW-${row.id}`,
    title: readField(row, null, "Product Title", fieldMap) || readField(row, null, "Title", fieldMap) || `Untitled ${tableConfig.displayName}`,
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
    generatedMedia,
    referenceMedia,
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
  const approvedCacheKey = cacheKey("products", "table-approved", tableConfig.tableId);
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

function buildCollectionGroups(collections) {
  const groups = [];
  const byName = new Map();

  collections.forEach((collection) => {
    const groupName = collection.group || "Saree Collections";
    if (!byName.has(groupName)) {
      const group = { name: groupName, count: 0, children: [] };
      byName.set(groupName, group);
      groups.push(group);
    }

    const group = byName.get(groupName);
    group.count += Number(collection.count || 0);
    group.children.push({
      name: collection.displayName || collection.name,
      collectionName: collection.name,
      displayName: collection.displayName || collection.name,
      subcategory: collection.subcategory || collection.displayName || collection.name,
      tableId: collection.tableId,
      count: collection.count || 0,
      error: collection.error || null,
    });
  });

  return groups;
}

async function buildCollectionsPayload() {
  const collections = [];
  const errors = [];

  await mapWithConcurrency(SAREE_TABLES, 4, async (tableConfig) => {
    try {
      const { approvedRows } = await fetchApprovedForTable(tableConfig);
      collections.push({
        name: tableConfig.name,
        displayName: tableConfig.displayName,
        tableId: tableConfig.tableId,
        slug: slugify(tableConfig.name),
        group: collectionGroupName(tableConfig),
        subcategory: tableConfig.subcategory,
        mediaProfile: tableConfig.mediaProfile,
        count: approvedRows.length,
        error: null,
      });
    } catch (error) {
      const item = {
        name: tableConfig.name,
        displayName: tableConfig.displayName,
        tableId: tableConfig.tableId,
        slug: slugify(tableConfig.name),
        group: collectionGroupName(tableConfig),
        subcategory: tableConfig.subcategory,
        mediaProfile: tableConfig.mediaProfile,
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

  const groups = buildCollectionGroups(collections);

  return {
    success: true,
    total: collections.reduce((sum, item) => sum + item.count, 0),
    groups,
    collections,
    errors,
  };
}

async function buildProductsPayload(query = {}) {
  const { tableId, collection, group, search, status, sort } = query;
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
  } else if (group) {
    tablesToFetch = getTableConfigsByGroup(group);
    mode = "group";
    if (!tablesToFetch.length) {
      const error = new Error(`Unknown group ${group}`);
      error.status = 400;
      throw error;
    }
  } else if (collection) {
    const groupTables = getTableConfigsByGroup(collection);
    if (groupTables.length) {
      tablesToFetch = groupTables;
      mode = "group";
    } else {
      const tableConfig = getTableConfigByName(collection);
      if (!tableConfig) {
        const error = new Error(`Unknown collection ${collection}`);
        error.status = 400;
        throw error;
      }
      tablesToFetch = [tableConfig];
      mode = "collection";
    }

    if (!tablesToFetch.length) {
      const error = new Error(`Unknown collection ${collection}`);
      error.status = 400;
      throw error;
    }
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
        displayName: tableConfig.displayName,
        tableId: tableConfig.tableId,
        slug: slugify(tableConfig.name),
        group: collectionGroupName(tableConfig),
        subcategory: tableConfig.subcategory,
        mediaProfile: tableConfig.mediaProfile,
        count: result.products.length,
        error: null,
      });
    } catch (error) {
      const item = {
        name: tableConfig.name,
        displayName: tableConfig.displayName,
        tableId: tableConfig.tableId,
        slug: slugify(tableConfig.name),
        group: collectionGroupName(tableConfig),
        subcategory: tableConfig.subcategory,
        mediaProfile: tableConfig.mediaProfile,
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
  const groups = buildCollectionGroups(collections);

  return {
    success: true,
    count: filteredProducts.length,
    products: filteredProducts,
    groups,
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
    const key = cacheKey("collections");
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
    const key = productCacheKey(req.query);
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

app.get("/api/cache/status", async (req, res) => {
  const cachedProducts = await cacheGet(productCacheKey({}));
  const cachedCollections = await cacheGet(cacheKey("collections"));
  const productSample = cachedProducts?.products?.[0] || null;
  res.json({
    success: true,
    enabled: CACHE_ENABLED,
    provider: cacheProvider(),
    connected: cacheConnected,
    fallback: cacheFallback,
    version: CACHE_VERSION,
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
    debug: {
      productsCacheKey: productCacheKey({}),
      collectionsCacheKey: cacheKey("collections"),
      productShapeSample: productSample ? {
        tableId: productSample.tableId,
        rowId: productSample.rowId,
        code: productSample.code,
        title: productSample.title,
        group: productSample.group,
        category: productSample.category,
        collectionName: productSample.collectionName,
        subcategory: productSample.subcategory,
        mediaProfile: productSample.mediaProfile,
      } : null,
      categoryMappings: SAREE_TABLES.map((table) => ({
        name: table.displayName || table.name,
        collectionName: table.name,
        group: table.group,
        tableId: table.tableId,
        count: cachedCollections?.collections?.find((item) => item.tableId === table.tableId)?.count ?? null,
      })),
    },
  });
});

app.post("/api/cache/refresh", async (req, res) => {
  try {
    await invalidateProductCache();
    await Promise.all([
      cacheDelete(legacyCacheKey("collections", "all")),
      cacheDelete(legacyCacheKey("collections")),
      cacheDelete(legacyCacheKey("diagnose", "all")),
      cacheDelete(legacyCacheKey("diagnose")),
      cacheDelete(versionedCacheKey("v2", "collections")),
      cacheDelete(versionedCacheKey("v2", "diagnose")),
      cacheDeleteByPrefix(`${CACHE_PREFIX}products:`),
    ]);

    const [collections, products] = await Promise.all([
      buildCollectionsPayload(),
      buildProductsPayload({}),
    ]);

    await Promise.all([
      cacheSet(cacheKey("collections"), collections, CACHE_COLLECTIONS_TTL),
      cacheSet(productCacheKey({}), products, CACHE_PRODUCTS_TTL),
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
    const diagnoseCacheKey = cacheKey("diagnose");
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
        const mediaProfile = mediaProfileFor(tableConfig);

        mediaProfile.generated.forEach((item) => {
          if (!findFieldByAliases(fieldMap, item.aliases || [])) {
            mediaWarnings.push(`${item.label} generated media field was not detected for profile ${tableConfig.mediaProfile}.`);
          }
        });

        mediaProfile.reference.forEach((item) => {
          if (!findFieldByAliases(fieldMap, item.aliases || [])) {
            mediaWarnings.push(`${item.label} reference media field was not detected for profile ${tableConfig.mediaProfile}.`);
          }
        });

        tables.push({
          name: tableConfig.name,
          displayName: tableConfig.displayName,
          collection: tableConfig.displayName,
          group: tableConfig.group,
          subcategory: tableConfig.subcategory,
          mediaProfile: tableConfig.mediaProfile,
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
          displayName: tableConfig.displayName,
          collection: tableConfig.displayName,
          group: tableConfig.group,
          subcategory: tableConfig.subcategory,
          mediaProfile: tableConfig.mediaProfile,
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
