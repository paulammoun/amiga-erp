CREATE TABLE salesmen (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 company_code TEXT NOT NULL,
 salesman_code TEXT NOT NULL,
 name TEXT NOT NULL,
 phone TEXT NOT NULL DEFAULT '',
 email TEXT NOT NULL DEFAULT '',
 active INTEGER NOT NULL DEFAULT 1,
 notes TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX salesmen_company_code_unique ON salesmen(company_code,salesman_code);
CREATE INDEX idx_salesmen_company_name ON salesmen(company_code,name);

INSERT INTO salesmen(company_code,salesman_code,name)
SELECT company_code,'UNASSIGNED','Unassigned' FROM customers GROUP BY company_code;

ALTER TABLE customers ADD COLUMN salesman_id INTEGER REFERENCES salesmen(id);
UPDATE customers SET salesman_id=(SELECT id FROM salesmen WHERE salesmen.company_code=customers.company_code AND salesman_code='UNASSIGNED');
CREATE INDEX idx_customers_company_salesman ON customers(company_code,salesman_id);
