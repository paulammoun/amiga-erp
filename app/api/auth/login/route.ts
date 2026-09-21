import { getRawDb } from "../../../../db";
import { createSession, ensureFixedSuperAdmin, FIXED_SUPERADMIN_COMPANY, FIXED_SUPERADMIN_USERNAME, normalizeUsername, verifyPassword, validPassword } from "../../../../db/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const username = normalizeUsername(body.username);
    const companyCode = username === FIXED_SUPERADMIN_USERNAME ? FIXED_SUPERADMIN_COMPANY : username.includes(".") ? username.slice(0, username.indexOf(".")) : "";
    const legacyUsername = companyCode === "default" ? username.slice(username.indexOf(".") + 1) : username;
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !validPassword(password)) return Response.json({ error: "Enter your username and password" }, { status: 400 });
    await ensureFixedSuperAdmin();
    const db = getRawDb();
    const user = await db.prepare("SELECT id,username,company_code AS companyCode,role,password_hash AS passwordHash FROM users WHERE username_normalized IN (?,?) AND LOWER(company_code)=? ORDER BY CASE WHEN username_normalized=? THEN 0 ELSE 1 END LIMIT 1").bind(username, legacyUsername, companyCode, username).first<{ id: number; username: string; companyCode: string; role: "superadmin" | "admin" | "user"; passwordHash: string }>();
    if (!user || !(await verifyPassword(password, user.passwordHash))) return Response.json({ error: "Incorrect username or password" }, { status: 401 });
    const session = await createSession(request, user.id);
    return Response.json({ user: { id: user.id, username: user.username, companyCode: user.companyCode, role: user.role } }, { headers: { "Set-Cookie": session.cookie } });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Could not sign in. Please try again." }, { status: 503 });
  }
}
