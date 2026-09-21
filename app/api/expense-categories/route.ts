import { getRawDb } from "../../../db";
import { requireUser } from "../../../db/auth";

const categoryColumns = "id,name,active,created_at AS createdAt";

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  try { return Response.json({ categories: (await getRawDb().prepare(`SELECT ${categoryColumns} FROM expense_categories WHERE company_code=? ORDER BY active DESC,name COLLATE NOCASE`).bind(auth.companyCode.toLowerCase()).all()).results }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not load expense categories." }, { status: 500 }); }
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  try {
    const body = await request.json() as Record<string, unknown>, name = String(body.name ?? "").trim();
    if (!name || name.length > 100) return Response.json({ error: "Enter a category name of 100 characters or fewer." }, { status: 400 });
    const category = await getRawDb().prepare(`INSERT INTO expense_categories (company_code,name) VALUES (?,?) RETURNING ${categoryColumns}`).bind(auth.companyCode.toLowerCase(), name).first();
    return Response.json({ category }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create category.";
    return Response.json({ error: /UNIQUE/i.test(message) ? "This category already exists." : message }, { status: /UNIQUE/i.test(message) ? 409 : 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  try {
    const body = await request.json() as Record<string, unknown>, id = Number(body.id), name = String(body.name ?? "").trim(), active = body.active !== false;
    if (!Number.isSafeInteger(id) || id < 1) return Response.json({ error: "Invalid category." }, { status: 400 });
    if (!name || name.length > 100) return Response.json({ error: "Enter a category name of 100 characters or fewer." }, { status: 400 });
    const db = getRawDb(), existing = await db.prepare("SELECT name FROM expense_categories WHERE id=? AND company_code=?").bind(id,auth.companyCode.toLowerCase()).first<{name:string}>();
    if (!existing) return Response.json({ error: "Category not found." }, { status: 404 });
    const results = await db.batch([
      db.prepare("UPDATE expense_categories SET name=?,active=? WHERE id=? AND company_code=?").bind(name, active ? 1 : 0, id, auth.companyCode.toLowerCase()),
      db.prepare("UPDATE expenses SET category=? WHERE category=? AND company_code=?").bind(name, existing.name, auth.companyCode.toLowerCase()),
    ]);
    if (!results[0].success) throw new Error("Could not update category.");
    const category = await db.prepare(`SELECT ${categoryColumns} FROM expense_categories WHERE id=? AND company_code=?`).bind(id,auth.companyCode.toLowerCase()).first();
    return Response.json({ category });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update category.";
    return Response.json({ error: /UNIQUE/i.test(message) ? "This category already exists." : message }, { status: /UNIQUE/i.test(message) ? 409 : 500 });
  }
}
