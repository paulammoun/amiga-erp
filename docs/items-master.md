# Items Master

The item editor uses General, Units, Barcodes, Suppliers, Stock and Manage lists tabs. Item lists and barcodes are scoped to the signed-in company. Barcode strings preserve leading zeroes; uniqueness is enforced case-insensitively in the API and by a normalized database key, including concurrent saves.

Each item has exactly one base stock unit with factor 1, plus sales and purchase defaults. Sale prices and price-list prices are per base unit; choosing a transaction unit scales the suggested price. Entered transaction prices are per selected unit. Supplier-specific purchase units take precedence over the item purchase default. Barcode lookup selects its linked unit.

Saved unit names and factors cannot be removed or changed. Add a differently named unit for new packaging. Transaction lines store the unit and factor, while stock quantities and stock ledger costs/prices use base units. Orders reserve and invoice quantities in the order's original unit. Returns use the original invoice factor and the original stock movements, including for inactive items.

Migration 0043 is additive: existing items become active with a base/default `unit`; existing line factors default to 1. Existing order and invoice unit labels, values, quantities, stock balances and ledger entries are unchanged. Missing item configuration is interpreted as the legacy default and materializes on save. Existing brands are added to company lists without renaming items. No historical supplier links are guessed. The migration does not replay stock or accounting.

Stock is read-only in the item editor. Adjust stock accepts a signed quantity, unit and reason. It atomically writes the ledger and on-hand balance, records the operator, rejects stale balances, and prevents duplicate submission using the request key. Item saves use optimistic revisions and an atomic batch; duplicate barcode errors roll back the whole edit.

Checks: `test-item-migration.mjs`, `test-item-master.mjs`, `test-invoice-lifecycle.mjs`, `test-sales-orders.mjs`, `test-sales-returns.mjs`, TypeScript and production build. Browser verification uses a local QA company only.
