CREATE TABLE stock_transactions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 company_code TEXT NOT NULL,
 item_id INTEGER NOT NULL,
 transaction_type TEXT NOT NULL,
 source_id INTEGER,
 source_line_id INTEGER,
 reference TEXT NOT NULL DEFAULT '',
 transaction_date TEXT NOT NULL,
 quantity REAL NOT NULL,
 unit_cost REAL,
 currency TEXT,
 notes TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
