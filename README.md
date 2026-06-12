# Janardhana Silk House Baserow Saree Review Portal

Express backend and premium HTML frontend for reviewing Baserow-generated saree assets.

## Setup

```bash
npm install
cp .env.example .env
```

Paste a REST database token into `.env`:

```env
BASEROW_API_URL=https://api.baserow.io
BASEROW_DATABASE_ID=419522
BASEROW_TOKEN=your_rest_database_token
PORT=3003
```

Do not use the MCP endpoint token as `BASEROW_TOKEN`.
Do not put tokens in `public/index.html`.

## Multi-Table Mode

The portal fetches each saree collection table separately and merges approved rows for All Collections. It does not use one global `view_id`, because Baserow view IDs are table-specific.

Configured tables:

| Collection | Table ID |
|---|---:|
| Kanjivaram Silks | 948083 |
| Pure Silk Sarees | 935204 |
| Tussar Silk Saree | 948245 |
| South Weaves | 935205 |
| Soft Silk Sarees | 935207 |
| Patola & Orissa | 935208 |
| Printed Pure Silk | 935203 |
| Cotton Silk Sarees | 935215 |
| Paithani Silk Sarees | 935206 |
| Banarasi Georgette | 935209 |
| Banarasi Silk | 935210 |
| Banarasi Kora | 935211 |
| Gadwal Handloom | 935213 |
| Jamawar Silk | 935214 |
| Cotton Saree | 935216 |
| Linen & Kota | 935217 |
| Art Silk | 935218 |
| Bandhani Silk | 935212 |

The REST token needs read/update access to all 18 tables and update access to these fields in each table:

- `SHOPIFY`
- `Approvel`
- `Comment`

## Commands

```bash
npm run check:baserow
npm run dev
```

Open:

```text
http://localhost:3003
```

## API

```text
GET /api/health
GET /api/baserow/diagnose
GET /api/collections
GET /api/products
GET /api/products?tableId=935215
GET /api/products?collection=Kanjivaram%20Silks
PATCH /api/products/:tableId/:rowId/approve
PATCH /api/products/:tableId/:rowId/request-changes
PATCH /api/products/:tableId/:rowId/reject
```

Row IDs can repeat across tables, so updates must include both `tableId` and `rowId`.

Only rows where `Generation Status = Approved` appear in the portal.

## Test

```bash
curl.exe -s http://localhost:3003/api/baserow/diagnose
curl.exe -s http://localhost:3003/api/collections
curl.exe -s http://localhost:3003/api/products
curl.exe -s "http://localhost:3003/api/products?tableId=935215"
```
