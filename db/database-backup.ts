type SchemaRow = { type: "table" | "index" | "trigger"; name: string; tblName: string; sql: string | null };

function quoteIdentifier(value: string) {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

function sqlValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replaceAll("'", "''")}'`;
}

export async function createDatabaseBackup(db: D1Database, generatedAt = new Date()) {
  const schema = await db.prepare(`
    SELECT type, name, tbl_name AS tblName, sql
      FROM sqlite_master
     WHERE type IN ('table', 'index', 'trigger')
       AND tbl_name NOT LIKE 'sqlite_%'
       AND tbl_name NOT LIKE '_cf_%'
       AND tbl_name <> 'd1_migrations'
       AND sql IS NOT NULL
     ORDER BY CASE type WHEN 'table' THEN 1 WHEN 'index' THEN 2 ELSE 3 END, name
  `).all<SchemaRow>();
  const tables = schema.results.filter(row => row.type === "table");
  const lines = [
    "-- Auto Workshop database backup",
    `-- Generated ${generatedAt.toISOString()}`,
    "PRAGMA foreign_keys=OFF;",
    "BEGIN TRANSACTION;",
    ...schema.results.filter(row => row.type !== "trigger").map(row => `${row.sql};`),
  ];
  for (const table of tables) {
    const records = await db.prepare(`SELECT * FROM ${quoteIdentifier(table.name)}`).all<Record<string, unknown>>();
    for (const record of records.results) {
      const columns = Object.keys(record);
      if (!columns.length) continue;
      lines.push(`INSERT INTO ${quoteIdentifier(table.name)} (${columns.map(quoteIdentifier).join(", ")}) VALUES (${columns.map(column => sqlValue(record[column])).join(", ")});`);
    }
  }
  lines.push(...schema.results.filter(row => row.type === "trigger").map(row => `${row.sql};`));
  lines.push("COMMIT;", "PRAGMA foreign_keys=ON;", "");
  return lines.join("\n");
}
