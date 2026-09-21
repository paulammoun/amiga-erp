import { getRawDb } from "../../../../db";
import { ensureFixedSuperAdmin, getSessionUser, hashPassword, normalizeUsername, requireUser, validPassword, validUsername } from "../../../../db/auth";

type UserRow = { id: number; username: string; companyCode: string; role: "superadmin" | "admin" | "user"; createdAt: string };

function publicUser(user: UserRow) { return { id: user.id, username: user.username, companyCode: user.companyCode, role: user.role, createdAt: user.createdAt }; }

export async function GET(request: Request) {
  const current = await requireUser(request);
  if (current instanceof Response) return current;
  if (current.role !== "admin") return Response.json({ error: "Only administrators can manage users" }, { status: 403 });
  try {
    const users = await getRawDb().prepare("SELECT id,username,company_code AS companyCode,role,created_at AS createdAt FROM users WHERE company_code=? ORDER BY username COLLATE NOCASE").bind(current.companyCode).all<UserRow>();
    return Response.json({ users: users.results.map(publicUser) });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Could not load users" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const db = getRawDb();
    await ensureFixedSuperAdmin();
    const count = await db.prepare("SELECT COUNT(*) AS count FROM users").first<{ count: number }>();
    const existingUsers = Number(count?.count ?? 0);
    const current = await getSessionUser(request);
    if (!current || current.role !== "admin") return Response.json({ error: "Only company administrators can create users" }, { status: 403 });
    const body = await request.json() as Record<string, unknown>;
    const companyCode = String(body.companyCode ?? (current?.companyCode ?? "")).trim().toLowerCase();
    const currentCompanyCode = current?.companyCode.trim().toLowerCase() ?? "";
    const localUsername = normalizeUsername(body.username);
    const username = companyCode && localUsername && !localUsername.startsWith(`${companyCode}.`) ? `${companyCode}.${localUsername}` : localUsername;
    const password = typeof body.password === "string" ? body.password : "";
    if (!/^[a-z0-9][a-z0-9-]{1,19}$/.test(companyCode)) return Response.json({ error: "Company code must be 2–20 characters using letters, numbers or dashes" }, { status: 400 });
    if (existingUsers > 0 && current && companyCode !== currentCompanyCode) return Response.json({ error: "You can only create users for your company" }, { status: 403 });
    if (!validUsername(username) || !username.startsWith(`${companyCode}.`)) return Response.json({ error: "Use a username in the format companycode.username, such as cp1.admin" }, { status: 400 });
    if (!validPassword(password)) return Response.json({ error: "Password must be between 8 and 200 characters" }, { status: 400 });
    const role: "admin" | "user" = body.role === "admin" ? "admin" : "user";
    const user = await db.prepare("INSERT INTO users (company_code,username,username_normalized,password_hash,role) VALUES (?,?,?,?,?) RETURNING id,username,company_code AS companyCode,role,created_at AS createdAt").bind(companyCode, username, username, await hashPassword(password), role).first<UserRow>();
    if (!user) return Response.json({ error: "Could not create user" }, { status: 503 });
    const response = { user: publicUser(user), setupComplete: existingUsers === 0 };
    return Response.json(response, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create user";
    if (/UNIQUE constraint failed: users\.username_normalized|users_username_normalized_unique/i.test(message)) return Response.json({ error: "That username is already in use" }, { status: 409 });
    console.error(error);
    return Response.json({ error: "Could not create user" }, { status: 503 });
  }
}
