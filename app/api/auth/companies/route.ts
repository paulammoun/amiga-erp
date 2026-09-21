import { getRawDb } from "../../../../db";
import { hashPassword, requireUser, validPassword, validUsername } from "../../../../db/auth";

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  if (auth.role !== "superadmin") return Response.json({ error: "Only the super administrator can manage companies" }, { status: 403 });
  try {
    const db = getRawDb();
    const companyCode = new URL(request.url).searchParams.get("companyCode")?.trim().toLowerCase();
    if (companyCode) {
      const company = await db.prepare("SELECT id,code,name,created_at AS createdAt FROM companies WHERE LOWER(code)=? LIMIT 1").bind(companyCode).first();
      if (!company) return Response.json({ error: "Company not found" }, { status: 404 });
      const users = await db.prepare("SELECT id,username,company_code AS companyCode,role,created_at AS createdAt FROM users WHERE LOWER(company_code)=? ORDER BY CASE role WHEN 'superadmin' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, username COLLATE NOCASE").bind(companyCode).all();
      return Response.json({ company, users: users.results });
    }
    await db.prepare("INSERT OR IGNORE INTO companies (code,name) VALUES (?,?)").bind(auth.companyCode.toLowerCase(), auth.companyCode.toLowerCase() === "default" ? "Default company" : auth.companyCode).run();
    const companies = await db.prepare(`
      SELECT c.id,c.code,c.name,c.created_at AS createdAt,
             COUNT(u.id) AS userCount,
             SUM(CASE WHEN u.role='admin' THEN 1 ELSE 0 END) AS adminCount
        FROM companies c
        LEFT JOIN users u ON LOWER(u.company_code)=LOWER(c.code)
       GROUP BY c.id
       ORDER BY c.name COLLATE NOCASE
    `).all();
    return Response.json({ companies: companies.results });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not load companies" }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  if (auth.role !== "superadmin") return Response.json({ error: "Only the super administrator can reset user passwords" }, { status: 403 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const userId = Number(body.userId);
    const password = typeof body.password === "string" ? body.password : "";
    if (!Number.isSafeInteger(userId) || userId < 1) return Response.json({ error: "Select a user" }, { status: 400 });
    if (!validPassword(password)) return Response.json({ error: "Password must be between 8 and 200 characters" }, { status: 400 });
    const db = getRawDb();
    const user = await db.prepare("SELECT id,username,role FROM users WHERE id=? LIMIT 1").bind(userId).first<{ id: number; username: string; role: string }>();
    if (!user) return Response.json({ error: "User not found" }, { status: 404 });
    if (user.role === "superadmin") return Response.json({ error: "The fixed super-admin password cannot be changed here" }, { status: 400 });
    await db.batch([
      db.prepare("UPDATE users SET password_hash=? WHERE id=?").bind(await hashPassword(password), userId),
      db.prepare("DELETE FROM sessions WHERE user_id=?").bind(userId),
    ]);
    return Response.json({ user: { id: user.id, username: user.username }, message: "Password reset successfully" });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Could not reset the password" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  if (auth.role !== "superadmin") return Response.json({ error: "Only the super administrator can create companies" }, { status: 403 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const code = String(body.code ?? "").trim().toLowerCase();
    const name = String(body.name ?? "").trim();
    const username = String(body.username ?? "").trim().toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    if (!/^[a-z0-9][a-z0-9-]{1,19}$/.test(code)) return Response.json({ error: "Company code must be 2–20 characters using letters, numbers or dashes" }, { status: 400 });
    if (!name || name.length > 200) return Response.json({ error: "Enter a company name" }, { status: 400 });
    const fullUsername = `${code}.${username}`;
    if (!validUsername(fullUsername)) return Response.json({ error: "Enter a valid administrator username" }, { status: 400 });
    if (!validPassword(password)) return Response.json({ error: "Password must be between 8 and 200 characters" }, { status: 400 });
    const db = getRawDb();
    const duplicateCompany = await db.prepare("SELECT id FROM companies WHERE LOWER(code)=? LIMIT 1").bind(code).first();
    const duplicateUser = await db.prepare("SELECT id FROM users WHERE username_normalized=? LIMIT 1").bind(fullUsername).first();
    if (duplicateCompany || duplicateUser) return Response.json({ error: "That company code or administrator username is already in use" }, { status: 409 });
    const passwordHash = await hashPassword(password);
    await db.batch([
      db.prepare("INSERT INTO companies (code,name) VALUES (?,?)").bind(code, name),
      db.prepare("INSERT INTO users (company_code,username,username_normalized,password_hash,role) VALUES (?,?,?,?,?)").bind(code, fullUsername, fullUsername, passwordHash, "admin"),
    ]);
    const company = await db.prepare("SELECT id,code,name,created_at AS createdAt FROM companies WHERE code=?").bind(code).first<{ id: number; code: string; name: string; createdAt: string }>();
    const user = await db.prepare("SELECT id,username,company_code AS companyCode,role FROM users WHERE username_normalized=?").bind(fullUsername).first();
    return Response.json({ company, user }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create company";
    if (/UNIQUE/i.test(message)) return Response.json({ error: "That company code or administrator username is already in use" }, { status: 409 });
    return Response.json({ error: "Could not create company" }, { status: 503 });
  }
}
