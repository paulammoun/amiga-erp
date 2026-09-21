# Sales Orders

Sales Orders use the existing company session, customer/item masters, customer price lists, currency master and invoice monetary calculation stages. Any signed-in company user who can create invoices can manage that company's orders. Orders never post accounting or stock movements.

- Draft orders can be edited and confirmed. Confirmation creates no invoice.
- Confirmed orders can be edited until their first invoice is created. Invoice history locks the order's financial snapshot and lines, including after a draft cancellation.
- Invoice conversion accepts the order revision and a stable request key. Server-selected source lines replace client-provided prices, customer, currency, terms and discounts. One atomic D1 batch creates the invoice, source links and applicable invoice ledger entries. A revision trigger rejects competing conversions and a quantity trigger prevents excess allocation.
- Draft invoice quantities are reserved but do not contribute to the invoiced status. Posting through the normal invoice endpoint changes them to invoiced quantities. Cancelling or deleting a draft releases its quantities; deletion is an audited soft cancellation. Cancelled drafts have no receivable balance and are excluded from sales reports.
- Order status is computed from linked posted invoice quantities, never manually set to partially or fully invoiced. Existing sales returns remain separate accounting documents. Returns/reversals do not reopen order demand; replacement sales require a new order. Reversed quantities stay consumed but do not count as currently invoiced.
- Remaining order quantities can be cancelled while retaining posted invoices. Linked drafts must first be posted or cancelled. An order cannot be converted after cancellation.

## Rounding and discounts

The original order discount is allocated to order lines using the existing invoice calculator. Each conversion receives a proportional share of its source line's remaining discount budget. The final remaining quantity receives the residual cents, capped at that invoice line's net value. Cancelling a draft returns its discount allocation along with its quantity. Line discounts, gross amounts and VAT round independently per invoice using the existing half-up cents rules; aggregate partial-invoice VAT can therefore differ from the full-order preview by rounding cents. Discount allocations never exceed the order budget or make a line negative.

## Verification

Run `node scripts/test-sales-orders.mjs` for full/partial conversion, multiple lines, duplicate and simultaneous requests, quantity validation, draft cancellation/deletion, posting, immutable history, customer snapshots, company isolation, rounding and balanced accounting. The existing invoice lifecycle, line-discount, sales-return and database-backup tests remain applicable. Database tests execute actual routes and migrations against an isolated SQLite database with D1-style atomic batches.
