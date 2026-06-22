## Multi-table Field-ID Sync Result

| Check | Result |
|---|---|
| SAREE_TABLES has table-specific field IDs | Yes |
| Generation Status filter uses per-table field | Yes |
| /api/collections works | Yes |
| /api/products all tables works | Yes |
| /api/products?tableId works | Yes |
| Approve updates only per-table SHOPIFY field | Yes |
| Reject updates per-table SHOPIFY + Generation Status Failed + Comment | Yes |
| Request Changes updates per-table SHOPIFY + Generation Status Failed + Comment | Yes |
| Jamawar comment-null handled | Yes |
| Frontend uses tableId + rowId for PATCH | Yes |
| Frontend refreshes after updates | Yes |
| Diagnose validates live fields and options | Yes |

## Table Access Summary

| Collection | Table ID | Read Access | Approved Rows | Error |
|---|---:|---|---:|---|
| Kanjivaram Silks | 948083 | Yes | 39 |  |
| Pure Silk Sarees | 935204 | Yes | 16 |  |
| Tussar Silk Saree | 948245 | Yes | 28 |  |
| South Weaves - South Silk Sarees | 935205 | Yes | 19 |  |
| Soft Silk Sarees | 935207 | Yes | 16 |  |
| Patola & Orissa Silk Sarees | 935208 | Yes | 13 |  |
| Printed Pure Silk Sarees | 935203 | Yes | 3 |  |
| Cotton Silk Sarees | 935215 | Yes | 10 |  |
| Paithani Silk Sarees | 935206 | Yes | 7 |  |
| Banarasi Georgette Silk Sarees | 935209 | Yes | 12 |  |
| Banarasi Silk Sarees | 935210 | Yes | 9 |  |
| Banarasi Kora Silk Saree | 935211 | Yes | 7 |  |
| Gadwal Handloom | 935213 | Yes | 13 |  |
| Jamawar Silk Sarees | 935214 | Yes | 1 |  |
| Cotton Saree | 935216 | Yes | 0 |  |
| Linen & Kota Silk Sarees | 935217 | Yes | 1 |  |
| Art Silk Sarees | 935218 | Yes | 0 |  |
| Bandhani Silk Saree | 935212 | Yes | 0 | Configured Shopify field is live field "Error Notes" |

Total approved rows: 194
Accessible tables: 18
Failed tables: 0
Diagnose warnings: 1
