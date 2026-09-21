CREATE TABLE IF NOT EXISTS journal_vouchers (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 company_code TEXT NOT NULL,
 voucher_number TEXT NOT NULL,
 voucher_date TEXT NOT NULL,
 currency TEXT NOT NULL,
 external_reference TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS journal_vouchers_company_number_unique ON journal_vouchers(company_code,voucher_number);
CREATE INDEX IF NOT EXISTS idx_journal_vouchers_company_date ON journal_vouchers(company_code,voucher_date);
