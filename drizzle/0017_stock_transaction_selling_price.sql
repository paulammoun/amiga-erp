ALTER TABLE stock_transactions ADD COLUMN unit_sale_price REAL;

UPDATE stock_transactions
SET unit_sale_price = (
  SELECT invoice_lines.unit_price
  FROM invoice_lines
  WHERE invoice_lines.id = stock_transactions.source_line_id
)
WHERE transaction_type = 'sale' AND source_line_id IS NOT NULL;
