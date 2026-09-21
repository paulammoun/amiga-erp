ALTER TABLE items ADD COLUMN vat_rate REAL NOT NULL DEFAULT 0;

UPDATE items
SET vat_rate = COALESCE(
  (SELECT default_tax FROM workshop_settings WHERE workshop_settings.company_code = items.company_code),
  0
);

ALTER TABLE invoice_lines ADD COLUMN tax_rate REAL NOT NULL DEFAULT 0;
ALTER TABLE invoice_lines ADD COLUMN tax_amount REAL NOT NULL DEFAULT 0;

UPDATE invoice_lines
SET tax_rate = COALESCE(
      (SELECT tax_rate FROM invoices WHERE invoices.id = invoice_lines.invoice_id),
      0
    ),
    tax_amount = ROUND(
      line_total * COALESCE(
        (SELECT tax_rate FROM invoices WHERE invoices.id = invoice_lines.invoice_id),
        0
      ) / 100,
      2
    );

-- Keep historical invoice totals exact even when rounding tax separately by line
-- produces a small difference. Put the rounding remainder on the final line.
UPDATE invoice_lines
SET tax_amount = tax_amount + (
  SELECT invoices.tax - COALESCE((
    SELECT SUM(all_lines.tax_amount)
    FROM invoice_lines all_lines
    WHERE all_lines.invoice_id = invoices.id
  ), 0)
  FROM invoices
  WHERE invoices.id = invoice_lines.invoice_id
)
WHERE id = (
  SELECT MAX(last_line.id)
  FROM invoice_lines last_line
  WHERE last_line.invoice_id = invoice_lines.invoice_id
);
