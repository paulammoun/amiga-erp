CREATE TABLE price_lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  company_code TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX price_lists_company_code_unique
ON price_lists(company_code, code);

CREATE INDEX idx_price_lists_company_name
ON price_lists(company_code, name);

CREATE TABLE price_list_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  price_list_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  price REAL NOT NULL,
  FOREIGN KEY (price_list_id) REFERENCES price_lists(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE UNIQUE INDEX price_list_items_list_item_unique
ON price_list_items(price_list_id, item_id);

CREATE INDEX idx_price_list_items_item
ON price_list_items(item_id);

ALTER TABLE customers ADD COLUMN price_list_id INTEGER REFERENCES price_lists(id);

INSERT INTO price_lists(company_code, code, name, active, notes)
SELECT company_code, 'DEFAULT', 'Default price list', 1, 'Uses the standard item price unless an override is added.'
FROM workshop_settings
WHERE 1
ON CONFLICT(company_code, code) DO NOTHING;

UPDATE customers
SET price_list_id = (
  SELECT id
  FROM price_lists
  WHERE price_lists.company_code = customers.company_code
    AND price_lists.code = 'DEFAULT'
);

CREATE INDEX idx_customers_price_list
ON customers(price_list_id);
