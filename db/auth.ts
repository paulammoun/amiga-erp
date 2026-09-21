import { getRawDb } from ".";
import { env } from "cloudflare:workers";

export const SESSION_COOKIE = "workshop_session";
export const SESSION_DAYS = 30;
export const PASSWORD_ITERATIONS = 100000;
export const FIXED_SUPERADMIN_USERNAME = "superadmin";
export const FIXED_SUPERADMIN_COMPANY = "default";

export type AuthUser = { id: number; username: string; companyCode: string; role: "superadmin" | "admin" | "user" };

const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - value.length % 4) % 4);
  const binary = atob(normalized);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function secureEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export function normalizeUsername(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function validUsername(value: string) {
  return /^[a-z0-9][a-z0-9._-]{2,59}$/.test(value);
}

export function validPassword(value: unknown) {
  return typeof value === "string" && value.length >= 8 && value.length <= 200;
}

export async function ensureFixedSuperAdmin() {
  // Each independent installation must supply its own server-side secret.
  const FIXED_SUPERADMIN_PASSWORD_HASH = env.SUPERADMIN_PASSWORD_HASH;
  if (!FIXED_SUPERADMIN_PASSWORD_HASH || !/^pbkdf2-sha256\$100000\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/.test(FIXED_SUPERADMIN_PASSWORD_HASH)) {
    throw new Error("Configure SUPERADMIN_PASSWORD_HASH with a newly generated administrator password hash.");
  }
  const db = getRawDb();
  await db.prepare("INSERT OR IGNORE INTO companies (code,name) VALUES (?,?)").bind(FIXED_SUPERADMIN_COMPANY, "Default company").run();
  const namedUser = await db.prepare("SELECT id,username,username_normalized AS usernameNormalized,company_code AS companyCode,password_hash AS passwordHash,role FROM users WHERE username_normalized=? LIMIT 1").bind(FIXED_SUPERADMIN_USERNAME).first<{ id: number; username: string; usernameNormalized: string; companyCode: string; passwordHash: string; role: string }>();
  const currentSuperAdmin = await db.prepare("SELECT id,username,username_normalized AS usernameNormalized,company_code AS companyCode,password_hash AS passwordHash,role FROM users WHERE role='superadmin' ORDER BY id LIMIT 1").first<{ id: number; username: string; usernameNormalized: string; companyCode: string; passwordHash: string; role: string }>();
  const account = namedUser ?? currentSuperAdmin;

  if (!account) {
    await db.prepare("INSERT INTO users (company_code,username,username_normalized,password_hash,role) VALUES (?,?,?,?,?)").bind(FIXED_SUPERADMIN_COMPANY, FIXED_SUPERADMIN_USERNAME, FIXED_SUPERADMIN_USERNAME, FIXED_SUPERADMIN_PASSWORD_HASH, "superadmin").run();
    return;
  }

  const alreadyCorrect = account.username === FIXED_SUPERADMIN_USERNAME
    && account.usernameNormalized === FIXED_SUPERADMIN_USERNAME
    && account.companyCode.toLowerCase() === FIXED_SUPERADMIN_COMPANY
    && account.passwordHash === FIXED_SUPERADMIN_PASSWORD_HASH
    && account.role === "superadmin";
  if (alreadyCorrect) return;

  await db.batch([
    db.prepare("DELETE FROM sessions WHERE user_id=?").bind(account.id),
    db.prepare("UPDATE users SET role='admin' WHERE role='superadmin' AND id<>?").bind(account.id),
    db.prepare("UPDATE users SET company_code=?,username=?,username_normalized=?,password_hash=?,role='superadmin' WHERE id=?").bind(FIXED_SUPERADMIN_COMPANY, FIXED_SUPERADMIN_USERNAME, FIXED_SUPERADMIN_USERNAME, FIXED_SUPERADMIN_PASSWORD_HASH, account.id),
  ]);
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: PASSWORD_ITERATIONS, hash: "SHA-256" }, key, 256);
  return `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${base64Url(salt)}$${base64Url(new Uint8Array(derived))}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, iterationText, saltText, hashText] = encoded.split("$");
  const iterations = Number(iterationText);
  if (algorithm !== "pbkdf2-sha256" || !Number.isSafeInteger(iterations) || iterations < 100000 || !saltText || !hashText) return false;
  try {
    const salt = fromBase64Url(saltText);
    const expected = fromBase64Url(hashText);
    const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    const derived = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, expected.length * 8));
    return secureEqual(derived, expected);
  } catch { return false; }
}

async function hashToken(token: string) {
  return base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(token))));
}

function readCookie(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.split(";").map(value => value.trim()).find(value => value.startsWith(`${SESSION_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(SESSION_COOKIE.length + 1)) : "";
}

function cookieHeader(request: Request, token: string, maxAge: number) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax; Path=/${secure}`;
}

export function clearSessionCookie(request: Request) {
  return cookieHeader(request, "", 0) + "; Expires=Thu, 01 Jan 1970 00:00:00 GMT";
}

export async function createSession(request: Request, userId: number) {
  const token = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const db = getRawDb();
  await db.batch([
    db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now.toISOString()),
    db.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at) VALUES (?,?,?,?)").bind(crypto.randomUUID(), userId, tokenHash, expiresAt),
  ]);
  return { token, expiresAt, cookie: cookieHeader(request, token, SESSION_DAYS * 24 * 60 * 60) };
}

export async function getSessionUser(request: Request): Promise<AuthUser | null> {
  const token = readCookie(request);
  if (!token) return null;
  const tokenHash = await hashToken(token);
  const db = getRawDb();
  const user = await db.prepare(`
    SELECT u.id, u.username, u.company_code AS companyCode, u.role
      FROM sessions s
      INNER JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?
     LIMIT 1
  `).bind(tokenHash, new Date().toISOString()).first<AuthUser>();
  return user ?? null;
}

export async function revokeSession(request: Request) {
  const token = readCookie(request);
  if (!token) return;
  await getRawDb().prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await hashToken(token)).run();
}

export async function requireUser(request: Request) {
  const user = await getSessionUser(request);
  return user ?? Response.json({ error: "Please sign in to continue", authenticated: false }, { status: 401 });
}
