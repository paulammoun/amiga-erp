import { and, desc, eq } from "drizzle-orm";
import { getDb,getRawDb } from "../../../db";
import { expenses } from "../../../db/schema";
import { requireUser } from "../../../db/auth";
import {getCurrency} from "../../../db/currencies";

function details(body: Record<string, unknown>) {
  const expenseDate = String(body.expenseDate ?? "").trim();
  const category = String(body.category ?? "").trim();
  const description = String(body.description ?? "").trim();
  const amount = Number(body.amount);
  const currency = String(body.currency ?? "USD").trim().toUpperCase();
  const notes = String(body.notes ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) throw new Error("Enter a valid expense date.");
  if (!category || !description) throw new Error("Category and description are required.");
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12) throw new Error("Enter a valid amount greater than zero.");
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Select a currency from Company Configuration.");
  if ([category, description, notes].some(value => value.length > 2000)) throw new Error("Expense details are too long.");
  return { expenseDate, category, description, amount, currency, notes };
}

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  try { return Response.json({ expenses: await getDb().select().from(expenses).where(eq(expenses.companyCode, auth.companyCode.toLowerCase())).orderBy(desc(expenses.expenseDate), desc(expenses.id)) }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not load expenses." }, { status: 500 }); }
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  try {
    const values = details(await request.json() as Record<string, unknown>);
    if(!(await getCurrency(auth.companyCode,values.currency,getRawDb()))?.active)throw new Error("Select an active currency from Company Configuration.");
    const [expense] = await getDb().insert(expenses).values({ ...values, companyCode: auth.companyCode.toLowerCase() }).returning();
    return Response.json({ expense }, { status: 201 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not save expense." }, { status: 400 }); }
}

export async function PUT(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  try {
    const body = await request.json() as Record<string, unknown>;
    const id = Number(body.id);
    if (!Number.isSafeInteger(id) || id < 1) return Response.json({ error: "Invalid expense." }, { status: 400 });
    const values=details(body);
    if(!(await getCurrency(auth.companyCode,values.currency,getRawDb()))?.active)throw new Error("Select an active currency from Company Configuration.");
    const [expense] = await getDb().update(expenses).set(values).where(and(eq(expenses.id, id), eq(expenses.companyCode, auth.companyCode.toLowerCase()))).returning();
    if (!expense) return Response.json({ error: "Expense not found." }, { status: 404 });
    return Response.json({ expense });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not update expense." }, { status: 400 }); }
}
