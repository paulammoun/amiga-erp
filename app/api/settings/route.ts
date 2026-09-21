import { getRawDb } from "../../../db";
import { getWorkshopSettings } from "../../../db/settings";
import { ensureCompanyCurrencies } from "../../../db/currencies";
import { requireUser } from "../../../db/auth";

function currencyCode(value: unknown, label: string) {
  const code = String(value ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw new Error(`${label} must use a three-letter currency code, such as USD or LBP`);
  try { new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(0); }
  catch { throw new Error(`${label} is not a valid currency code`); }
  return code;
}

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  try { return Response.json({ settings: await getWorkshopSettings(auth.companyCode) }); }
  catch (error) {
    console.error(error);
    return Response.json({ error: "Could not load configuration. Please try again." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  try {
    const body = await request.json() as Record<string, unknown>;
    const companyName = String(body.companyName ?? "").trim();
    const companyAddress = String(body.companyAddress ?? "").trim();
    const sellerTaxRegistration = String(body.sellerTaxRegistration ?? "").trim();
    const menuName = String(body.menuName ?? "").trim();
    const menuSubtitle = String(body.menuSubtitle ?? "").trim();
    const logoDataUrl = String(body.logoDataUrl ?? "").trim();
    const overviewKicker = String(body.overviewKicker ?? "").trim();
    const overviewTitle = String(body.overviewTitle ?? "").trim();
    const overviewDescription = String(body.overviewDescription ?? "").trim();
    const defaultTax = Number(body.defaultTax);
    const salesAccountNumber = String(body.salesAccountNumber ?? "").trim();
    const taxAccountNumber = String(body.taxAccountNumber ?? "").trim();
    const purchaseAccountNumber = String(body.purchaseAccountNumber ?? "").trim();
    const purchaseTaxAccountNumber = String(body.purchaseTaxAccountNumber ?? "").trim();
    if (!companyName) return Response.json({ error: "Company name is required" }, { status: 400 });
    if (!menuName) return Response.json({ error: "Menu name is required" }, { status: 400 });
    if (!overviewTitle) return Response.json({ error: "Overview title is required" }, { status: 400 });
    if (companyName.length > 200 || companyAddress.length > 2000 || sellerTaxRegistration.length > 100) return Response.json({ error: "Company details are too long" }, { status: 400 });
    if (menuName.length > 60 || menuSubtitle.length > 100) return Response.json({ error: "Menu branding text is too long" }, { status: 400 });
    if (overviewKicker.length > 60 || overviewTitle.length > 160 || overviewDescription.length > 500) return Response.json({ error: "Overview text is too long" }, { status: 400 });
    if (logoDataUrl && (!/^data:image\/(png|jpeg|webp);base64,/i.test(logoDataUrl) || logoDataUrl.length > 700000)) return Response.json({ error: "Upload a PNG, JPG, or WebP logo smaller than 500 KB" }, { status: 400 });
    if (!Number.isFinite(defaultTax) || defaultTax < 0 || defaultTax > 100) return Response.json({ error: "Default tax must be between 0 and 100" }, { status: 400 });
    if ([salesAccountNumber, taxAccountNumber, purchaseAccountNumber, purchaseTaxAccountNumber].some(value => value.length > 100)) return Response.json({ error: "Ledger account numbers must be 100 characters or fewer" }, { status: 400 });
    const defaultCurrency = currencyCode(body.defaultCurrency, "Default currency");
    const localCurrency = currencyCode(body.localCurrency, "Local currency");
    const negativeStockPolicy=String(body.negativeStockPolicy??"warn");
    if(!["warn","block"].includes(negativeStockPolicy))return Response.json({error:"Negative stock policy must be Warn or Block."},{status:400});
    const db = getRawDb(), company = auth.companyCode.toLowerCase();
    const oldSettings=await getWorkshopSettings(company,db);
    for(const [key,code] of Object.entries({salesAccountNumber,taxAccountNumber,purchaseAccountNumber,purchaseTaxAccountNumber})){
      if(code&&code!==oldSettings[key as keyof typeof oldSettings]&&!await db.prepare("SELECT id FROM accounts WHERE company_code=? AND account_number=? AND active=1 AND length(account_number)=10 AND account_number NOT GLOB '*[^0-9]*'").bind(company,code).first())return Response.json({error:"Ledger settings must use active 10-digit posting accounts in this company."},{status:400});
    }
    await ensureCompanyCurrencies(company, db);
    const currencies = await db.prepare("SELECT code,active FROM currencies WHERE company_code=? AND code IN (?,?)").bind(company,defaultCurrency,localCurrency).all<{code:string;active:number}>();
    if (![defaultCurrency,localCurrency].every(code=>currencies.results.some(currency=>currency.code===code&&currency.active))) return Response.json({ error: "Default and local currencies must be active in Currency master data." }, { status: 400 });
    await db.prepare(`
      INSERT INTO workshop_settings
        (company_code, company_name, company_address, seller_tax_registration, menu_name, menu_subtitle, logo_data_url, overview_kicker, overview_title, overview_description, default_tax, sales_account_number, tax_account_number, purchase_account_number, purchase_tax_account_number, default_currency, local_currency,negative_stock_policy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)
      ON CONFLICT(company_code) DO UPDATE SET
        company_name = excluded.company_name,
        company_address = excluded.company_address,
        seller_tax_registration = excluded.seller_tax_registration,
        menu_name = excluded.menu_name,
        menu_subtitle = excluded.menu_subtitle,
        logo_data_url = excluded.logo_data_url,
        overview_kicker = excluded.overview_kicker,
        overview_title = excluded.overview_title,
        overview_description = excluded.overview_description,
        default_tax = excluded.default_tax,
        sales_account_number = excluded.sales_account_number,
        tax_account_number = excluded.tax_account_number,
        purchase_account_number = excluded.purchase_account_number,
        purchase_tax_account_number = excluded.purchase_tax_account_number,
        default_currency = excluded.default_currency,
        local_currency = excluded.local_currency,
        negative_stock_policy=excluded.negative_stock_policy,
        updated_at = CURRENT_TIMESTAMP
    `).bind(company, companyName, companyAddress, sellerTaxRegistration, menuName, menuSubtitle, logoDataUrl, overviewKicker, overviewTitle, overviewDescription, defaultTax, salesAccountNumber, taxAccountNumber, purchaseAccountNumber, purchaseTaxAccountNumber, defaultCurrency, localCurrency,negativeStockPolicy).run();
    await db.prepare("UPDATE currencies SET rate=1,active=1 WHERE company_code=? AND code=?").bind(company,localCurrency).run();
    return Response.json({ settings: await getWorkshopSettings(company,db) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save configuration";
    const clientError = message.includes("currency code");
    if (!clientError) console.error(error);
    return Response.json({ error: clientError ? message : "Could not save configuration. Please try again." }, { status: clientError ? 400 : 503 });
  }
}
