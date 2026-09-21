# Purchase landed costs

Purchase tax totals can be manually overridden, including zero, or reset using “Use tax %”. The override persists on edits and flows through supplier totals and tax accounting, while inventory landed cost remains exclusive of tax. Original currency totals and LBP countervalues are displayed and saved with a server-derived LBP exchange rate. Where LBP is not the local currency, the rate is calculated through the configured local-currency rates. Missing LBP configuration is shown explicitly, never assumed. Migration 0045 adds nullable fields without rewriting history.

The purchase form uses the available screen width, scrolls its body independently, and keeps save controls visible. Each item has separate quantity, unit, entered cost, landed cost and goods total fields. Smaller screens use labeled cards.

Purchase expenses contain a category, description, currency and positive amount. Categories can be typed or chosen from existing expense category suggestions. Each expense is converted to the company's local currency using its configured rate. The purchase and expense exchange rates are saved on the server and reused when editing. Changing an expense currency uses its current configured rate; client-supplied rates are never trusted.

Expense percentage = total expenses in local currency / goods subtotal in local currency × 100. Allocation is proportional to goods value before tax. Landed unit cost = entered unit cost × (1 + expense percentage / 100). Entered costs, supplier invoice totals and tax remain separate from this allocation. Expense entries are purchase costing allocations, not expense payment postings.

Stock entries use landed cost divided by the selected unit's conversion factor. Editing reverses and replaces stock and supplier accounting atomically. Removing all expenses restores entered cost as landed cost. Supplier accounting uses the purchase's saved exchange rate. Existing inventory reports retain their established reporting-currency conversion behavior.

Migration 0044 adds fields only, with no recalculation or rewriting of historical documents or stock. Historical lines with no landed cost fall back to entered cost. Legacy purchases receive a rate snapshot when explicitly edited. Purchases saved under a different local currency cannot be edited until that original local currency is restored in configuration.

Validation: `scripts/test-purchase-landed-cost.mjs` exercises real route handlers with SQLite, mixed currencies, proportional allocation, conversions, saved-rate protection, expense removal, validation, tenant isolation and migration preservation. Existing Items Master, invoice, sales-order and return regression suites also cover the shared stock path.
