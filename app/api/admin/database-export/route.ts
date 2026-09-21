import { getRawDb } from "../../../../db";
import { requireUser } from "../../../../db/auth";
import { createDatabaseBackup } from "../../../../db/database-backup";

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  if (auth.role !== "superadmin") return Response.json({ error: "Super-admin access is required." }, { status: 403 });

  try {
    const db = getRawDb();
    const backup = await createDatabaseBackup(db);
    const filename = `auto-workshop-backup-${new Date().toISOString().slice(0, 10)}.sql`;
    return new Response(backup, { headers: {
      "content-type": "application/sql; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    } });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Could not create the database backup." }, { status: 503 });
  }
}
