import { ensureFixedSuperAdmin, getSessionUser } from "../../../../db/auth";

export async function GET(request: Request) {
  try {
    await ensureFixedSuperAdmin();
    const user = await getSessionUser(request);
    return Response.json({ authenticated: !!user, user, setupRequired: false });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Could not check sign-in status" }, { status: 503 });
  }
}
