# Janardhana Silk House — Baserow Live Saree Review Portal

This package contains:

- Express backend API
- Live Baserow fetch from table `948083`
- Frontend HTML UI served from `/public/index.html`
- Approve / Request Changes / Reject PATCH routes
- Token kept in `.env`, not frontend code

## Setup

```bash
npm install
cp .env.example .env
```

Paste your Baserow token into `.env`:

```env
BASEROW_TOKEN=your_token_here
```

BASEROW_TOKEN must be a REST database token created inside Baserow database 419522.
It must have:
- Read access to table 948083
- Update access to table 948083
- Update access to fields: SHOPIFY, Approvel, Comment

Do not paste the MCP endpoint token here.
Do not paste a token from another database.

Validate the token:

```bash
npm run check:baserow
```

Then run:

```bash
npm run dev
```

Open:

```text
http://localhost:3003
```

## API Endpoints

```text
GET /api/health
GET /api/products
PATCH /api/products/:rowId/approve
PATCH /api/products/:rowId/request-changes
PATCH /api/products/:rowId/reject
```

## Fetch Rule

Only rows where:

```text
Generation Status = Approved
```

are returned to the frontend.

## Update Rules

Approve:

```json
{
  "SHOPIFY": "Approved"
}
```

Request Changes:

```json
{
  "SHOPIFY": "Reject",
  "Approvel": "Reject",
  "Comment": "Change Type: ...\n\nfeedback..."
}
```

Reject:

```json
{
  "SHOPIFY": "Reject",
  "Approvel": "Reject",
  "Comment": "Rejected from review portal"
}
```

## Security

Do not put your Baserow token inside `public/index.html`.
The frontend only calls your backend API.

## Final Baserow Token Fix

If `/api/products` returns `ERROR_NO_PERMISSION_TO_TABLE`, the code is not the problem.

The backend uses a REST database token from `.env`:

```env
BASEROW_TOKEN=...
```

This token must be created in database `419522`, not another database.

Required target:

* Database ID: `419522`
* Table ID: `948083`
* View ID: `1859321`

Required permissions:

* Read rows from table `948083`
* Update rows in table `948083`
* Update fields:
  * `SHOPIFY`
  * `Approvel`
  * `Comment`

After creating the correct token:

```bash
npm run check:baserow
npm run dev
```

Then test:

```bash
curl.exe -s http://localhost:3003/api/baserow/diagnose
curl.exe -s http://localhost:3003/api/products
```

Do not use your MCP endpoint token as `BASEROW_TOKEN`.
Do not share your Baserow account password.

## Baserow Tokens: REST vs MCP

There are two distinct types of Baserow tokens used in this project:
1. **REST Database Token**: Used by the Express backend to make direct REST API requests. It is configured in the `.env` file under `BASEROW_TOKEN`.
2. **MCP Endpoint Token**: Used by the Codex/AI agent to connect to Baserow's Model Context Protocol (MCP) server. It is configured locally in `.mcp.json` as part of the remote connection URL: `https://api.baserow.io/mcp/<MCP_ENDPOINT_TOKEN>/sse`.

*Note: Do not mix up these tokens or use the REST database token inside the MCP configuration unless Baserow explicitly generates that identical token for both.*
