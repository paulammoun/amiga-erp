INSERT OR IGNORE INTO currencies(company_code,code,name,rate,active)
SELECT values_table.company_code,UPPER(values_table.value_code),values_table.name,
  CASE WHEN UPPER(values_table.value_code)=settings.local_currency THEN 1 ELSE COALESCE(NULLIF(settings.local_currency_rate,0),1) END,
  values_table.active
FROM customer_master_values values_table
LEFT JOIN workshop_settings settings ON settings.company_code=values_table.company_code
WHERE values_table.category='currency';
--> statement-breakpoint
DELETE FROM customer_master_values WHERE category='currency';
