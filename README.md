# Janardhana Silk House Baserow Saree Review Portal

Express backend and HTML frontend for reviewing Baserow-generated saree assets.

## Setup

```bash
npm install
cp .env.example .env
```

Use separate REST database tokens in `.env`:

```env
BASEROW_BASE_URL=https://api.baserow.io
SAREE_BASEROW_DATABASE_ID=419522
SAREE_BASEROW_TOKEN=your_saree_rest_database_token
SOCIAL_BASEROW_DATABASE_ID=414089
SOCIAL_BASEROW_TOKEN=your_social_rest_database_token
APP_REVIEW_PASSWORD=optional_portal_password
PORT=3003
```

Do not use the MCP endpoint token as a Baserow REST token.
Do not put tokens in `public/index.html`.

## Multi-Table Field-ID Mode

Each saree collection is a separate Baserow table. The backend fetches rows by raw field IDs, filters each table by its configured `Generation Status` field, and merges approved rows for All Collections.

The backend also fetches table field metadata so display fields such as product title and images still render even though row data is fetched by field ID.

## Required Token Permissions

The Saree REST database token needs:

- Read access to every configured saree table.
- Update access to every configured saree table.
- Update access to each table-specific `SHOPIFY` field.
- Update access to each table-specific `Comment` field when present.

The Social Media Review Portal uses a separate `SOCIAL_BASEROW_TOKEN` for Baserow database `414089`.

Approve updates only:

```text
SHOPIFY = Approved
```

Generation Status is not changed by Approve.

Reject and Request Changes update:

```text
SHOPIFY = Reject
Generation Status = Failed
Comment = feedback text
```

If a table has no Comment field, the backend skips Comment and still updates SHOPIFY.
Rejected and request-change rows disappear from the review dashboard after refresh because only `Generation Status = Approved` rows are listed.

## Table And Field IDs

| Collection | Table ID | Generation Status | SHOPIFY | Comment |
|---|---:|---|---|---|
| Kanjivaram Silks | 948083 | field_8253052 | field_8253055 | field_8253053 |
| Pure Silk Sarees | 935204 | field_8123033 | field_8123036 | field_8123034 |
| Tussar Silk Saree | 948245 | field_8254631 | field_8254634 | field_8254632 |
| South Weaves - South Silk Sarees | 935205 | field_8123050 | field_8123053 | field_8123051 |
| Soft Silk Sarees | 935207 | field_8123084 | field_8123087 | field_8123085 |
| Patola & Orissa Silk Sarees | 935208 | field_8123101 | field_8123104 | field_8123102 |
| Printed Pure Silk Sarees | 935203 | field_8123016 | field_8123019 | field_8123017 |
| Cotton Silk Sarees | 935215 | field_8123220 | field_8123223 | field_8123221 |
| Paithani Silk Sarees | 935206 | field_8123067 | field_8123070 | field_8123068 |
| Banarasi Georgette Silk Sarees | 935209 | field_8123118 | field_8123121 | field_8123119 |
| Banarasi Silk Sarees | 935210 | field_8123135 | field_8123138 | field_8123136 |
| Banarasi Kora Silk Saree | 935211 | field_8123152 | field_8123155 | field_8123153 |
| Gadwal Handloom | 935213 | field_8123186 | field_8123189 | field_8123187 |
| Jamawar Silk Sarees | 935214 | field_8123203 | field_8123206 | none |
| Cotton Saree | 935216 | field_8123237 | field_8123240 | field_8123238 |
| Cotton Suits | 936059 | field_8132747 | field_8132750 | field_8132748 |
| Silk Suits | 936060 | field_8132764 | field_8132767 | field_8132765 |
| Linen & Kota Silk Sarees | 935217 | field_8123254 | field_8123257 | field_8123255 |
| Art Silk Sarees | 935218 | field_8123271 | field_8123274 | field_8123272 |
| Bandhani Silk Saree | 935212 | field_8123169 | field_8123172 | field_8123170 |

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

Row IDs can repeat across tables, so every update route uses both `tableId` and `rowId`.

Only rows where the table-specific `Generation Status` value is `Approved` appear in the portal.

## Test

```bash
curl.exe -s http://localhost:3003/api/baserow/diagnose
curl.exe -s http://localhost:3003/api/collections
curl.exe -s http://localhost:3003/api/products
curl.exe -s "http://localhost:3003/api/products?tableId=935215"
```
