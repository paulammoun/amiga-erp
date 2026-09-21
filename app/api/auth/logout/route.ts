import { clearSessionCookie, revokeSession } from "../../../../db/auth";

export async function POST(request: Request) {
  try { await revokeSession(request); }
  catch (error) { console.error(error); }
  return new Response(null, { status: 204, headers: { "Set-Cookie": clearSessionCookie(request) } });
}
