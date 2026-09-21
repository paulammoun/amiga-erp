import { getRawDb } from ".";

export type WorkshopSettings = {
  customerAccountPrefix: string;
  supplierAccountPrefix: string;
  companyName: string;
  companyAddress: string;
  sellerTaxRegistration: string;
  menuName: string;
  menuSubtitle: string;
  logoDataUrl: string;
  overviewKicker: string;
  overviewTitle: string;
  overviewDescription: string;
  defaultTax: number;
  salesAccountNumber: string;
  taxAccountNumber: string;
  purchaseAccountNumber: string;
  purchaseTaxAccountNumber: string;
  defaultCurrency: string;
  localCurrencyRate: number;
  localCurrency: string;
  negativeStockPolicy: "warn"|"block";
};

export const defaultWorkshopSettings: WorkshopSettings = {
  customerAccountPrefix: "4111",
  supplierAccountPrefix: "4011",
  companyName: "Auto Workshop",
  companyAddress: "",
  sellerTaxRegistration: "",
  menuName: "Workshop",
  menuSubtitle: "Service desk",
  logoDataUrl: "",
  overviewKicker: "BUSINESS DESK",
  overviewTitle: "Ready for your next sale.",
  overviewDescription: "Create invoices, track items and serve customers from one place.",
  defaultTax: 11,
  salesAccountNumber: "",
  taxAccountNumber: "",
  purchaseAccountNumber: "",
  purchaseTaxAccountNumber: "",
  defaultCurrency: "USD",
  localCurrencyRate: 1,
  localCurrency: "USD",
  negativeStockPolicy: "warn",
};

export async function getWorkshopSettings(companyCode: string, db: D1Database = getRawDb()) {
  const settings = await db.prepare(`
    SELECT customer_account_prefix AS customerAccountPrefix, supplier_account_prefix AS supplierAccountPrefix, company_name AS companyName,
           company_address AS companyAddress,
           seller_tax_registration AS sellerTaxRegistration,
           menu_name AS menuName,
           menu_subtitle AS menuSubtitle,
           logo_data_url AS logoDataUrl,
           overview_kicker AS overviewKicker,
           overview_title AS overviewTitle,
           overview_description AS overviewDescription,
           default_tax AS defaultTax,
           sales_account_number AS salesAccountNumber,
           tax_account_number AS taxAccountNumber,
           purchase_account_number AS purchaseAccountNumber,
           purchase_tax_account_number AS purchaseTaxAccountNumber,
           default_currency AS defaultCurrency,
           COALESCE((SELECT rate FROM currencies WHERE company_code=workshop_settings.company_code AND code=workshop_settings.default_currency),local_currency_rate) AS localCurrencyRate,
           local_currency AS localCurrency
           ,negative_stock_policy AS negativeStockPolicy
      FROM workshop_settings
     WHERE company_code = ?
     LIMIT 1
  `).bind(companyCode.toLowerCase()).first<WorkshopSettings>();
  if (settings) return settings;
  const company = await db.prepare("SELECT name FROM companies WHERE LOWER(code)=? LIMIT 1").bind(companyCode.toLowerCase()).first<{ name: string }>();
  return { ...defaultWorkshopSettings, companyName: company?.name ?? defaultWorkshopSettings.companyName };
}
