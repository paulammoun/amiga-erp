import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const source = readFileSync(resolve(root, "db/database-backup.ts"), "utf8");
const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { createDatabaseBackup } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);

function d1(database) {
  return {
    prepare(sql) {
      const statement = database.prepare(sql);
      return { all: async () => ({ results: statement.all() }) };
    },
  };
}

const original = new DatabaseSync(":memory:");
original.exec(`
  CREATE TABLE stock_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, reference TEXT NOT NULL);
  CREATE TABLE accounting_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, account_number TEXT NOT NULL, amount REAL);
  CREATE TABLE future_table (id INTEGER PRIMARY KEY, value TEXT);
  CREATE INDEX idx_accounting_account ON accounting_transactions(account_number);
  CREATE TRIGGER future_table_cleanup AFTER DELETE ON future_table BEGIN DELETE FROM future_table WHERE id = OLD.id; END;
  INSERT INTO stock_transactions(reference) VALUES ('STK-1');
  INSERT INTO accounting_transactions(account_number, amount) VALUES ('4000-SALES', 12.5);
  INSERT INTO future_table(id, value) VALUES (1, 'Owner''s data');
`);

const backup = await createDatabaseBackup(d1(original), new Date("2026-09-14T00:00:00.000Z"));
const restored = new DatabaseSync(":memory:");
restored.exec(backup);

const tables = restored.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.name);
assert.deepEqual(tables, ["accounting_transactions", "future_table", "stock_transactions"]);
assert.equal(restored.prepare("SELECT reference FROM stock_transactions").get().reference, "STK-1");
const accounting = restored.prepare("SELECT account_number, amount FROM accounting_transactions").get();
assert.equal(accounting.account_number, "4000-SALES");
assert.equal(accounting.amount, 12.5);
assert.equal(restored.prepare("SELECT value FROM future_table").get().value, "Owner's data");
assert.equal(restored.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type = 'index' AND name = 'idx_accounting_account'").get().count, 1);
assert.equal(restored.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type = 'trigger' AND name = 'future_table_cleanup'").get().count, 1);

console.log("Passed database backup round trip for all discovered tables, records, indexes and triggers.");
