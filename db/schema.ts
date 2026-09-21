import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const reportPresets=sqliteTable('report_presets',{
 id:integer('id').primaryKey({autoIncrement:true}),companyCode:text('company_code').notNull(),userId:integer('user_id').notNull(),reportId:text('report_id').notNull(),name:text('name').notNull(),filtersJson:text('filters_json').notNull(),
},t=>[uniqueIndex('report_presets_owner_name').on(t.companyCode,t.userId,t.reportId,t.name)]);

export const companies = sqliteTable("companies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const items = sqliteTable("items", {
  active: integer("active").notNull().default(1),
  masterJson: text("master_json").notNull().default("{}"),
  masterRevision: integer("master_revision").notNull().default(0),
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyCode: text("company_code").notNull().default("default"),
  sku: text("sku").notNull(),
  name: text("name").notNull(),
  brand: text("brand").notNull().default(""),
  salePrice: real("sale_price").notNull().default(0),
  vatRate: real("vat_rate").notNull().default(0),
  discountRate: real("discount_rate").notNull().default(0),
  stockQty: real("stock_qty").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [uniqueIndex("items_company_sku_unique").on(table.companyCode, table.sku), index("idx_items_company").on(table.companyCode)]);

export const priceLists = sqliteTable("price_lists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyCode: text("company_code").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  active: integer("active",{mode:"boolean"}).notNull().default(true),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [uniqueIndex("price_lists_company_code_unique").on(table.companyCode,table.code),index("idx_price_lists_company_name").on(table.companyCode,table.name)]);

export const priceListItems = sqliteTable("price_list_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  priceListId: integer("price_list_id").notNull().references(() => priceLists.id,{onDelete:"cascade"}),
  itemId: integer("item_id").notNull().references(() => items.id),
  price: real("price").notNull(),
}, table => [uniqueIndex("price_list_items_list_item_unique").on(table.priceListId,table.itemId),index("idx_price_list_items_item").on(table.itemId)]);

export const salesmen = sqliteTable("salesmen", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyCode: text("company_code").notNull(),
  salesmanCode: text("salesman_code").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  active: integer("active",{mode:"boolean"}).notNull().default(true),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [uniqueIndex("salesmen_company_code_unique").on(table.companyCode,table.salesmanCode),index("idx_salesmen_company_name").on(table.companyCode,table.name)]);

export const currencies = sqliteTable("currencies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyCode: text("company_code").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  rate: real("rate").notNull().default(1),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [uniqueIndex("currencies_company_code_unique").on(table.companyCode, table.code), index("idx_currencies_company_name").on(table.companyCode, table.name)]);

export const customers = sqliteTable("customers", {
  accountId: integer("account_id"),
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyCode: text("company_code").notNull().default("default"),
  customerCode: text("customer_code"),
  accountNumber: text("account_number").notNull().default(""),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  tradingName: text("trading_name").notNull().default(""),
  customerType: text("customer_type").notNull().default("individual"),
  mofNumber: text("mof_number").notNull().default(""),
  companyRegistrationNumber: text("company_registration_number").notNull().default(""),
  preferredLanguage: text("preferred_language").notNull().default("English"),
  phone: text("phone").notNull().default(""),
  mobile: text("mobile").notNull().default(""),
  email: text("email").notNull().default(""),
  website: text("website").notNull().default(""),
  address: text("address").notNull().default(""),
  city: text("city").notNull().default(""),
  country: text("country").notNull().default("Lebanon"),
  salesmanId: integer("salesman_id").references(() => salesmen.id),
  priceListId: integer("price_list_id").references(() => priceLists.id),
  defaultCurrency: text("default_currency").notNull().default("USD"),
  paymentTerms: text("payment_terms").notNull().default("cash"),
  creditLimit: real("credit_limit").notNull().default(0),
  defaultDiscount: real("default_discount").notNull().default(0),
  customerGroup: text("customer_group").notNull().default("retail"),
  territory: text("territory").notNull().default(""),
  defaultPaymentMethod: text("default_payment_method").notNull().default("cash"),
  vatTreatment: text("vat_treatment").notNull().default("standard"),
  taxRegistrationStatus: text("tax_registration_status").notNull().default("not_registered"),
  statementDelivery: text("statement_delivery").notNull().default("on_request"),
  statementEmail: text("statement_email").notNull().default(""),
  allowCreditSales: integer("allow_credit_sales", { mode: "boolean" }).notNull().default(true),
  applyWithholdingTax: integer("apply_withholding_tax", { mode: "boolean" }).notNull().default(false),
  creditHold: integer("credit_hold", { mode: "boolean" }).notNull().default(false),
  blockInvoices: integer("block_invoices", { mode: "boolean" }).notNull().default(false),
  warnCreditLimit: integer("warn_credit_limit", { mode: "boolean" }).notNull().default(true),
  requirePoNumber: integer("require_po_number", { mode: "boolean" }).notNull().default(false),
  tags: text("tags").notNull().default(""),
  acquisitionSource: text("acquisition_source").notNull().default(""),
  internalNotes: text("internal_notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [uniqueIndex("customers_company_code_unique").on(table.companyCode, table.customerCode), index("idx_customers_company").on(table.companyCode)]);

export const customerContacts = sqliteTable("customer_contacts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyCode: text("company_code").notNull(),
  customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  receives: text("receives").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [index("idx_customer_contacts_customer").on(table.companyCode, table.customerId)]);

export const customerAddresses = sqliteTable("customer_addresses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyCode: text("company_code").notNull(),
  customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  addressType: text("address_type").notNull().default("service"),
  label: text("label").notNull().default(""),
  line1: text("line1").notNull(),
  line2: text("line2").notNull().default(""),
  city: text("city").notNull().default(""),
  region: text("region").notNull().default(""),
  postalCode: text("postal_code").notNull().default(""),
  country: text("country").notNull().default("Lebanon"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [index("idx_customer_addresses_customer").on(table.companyCode, table.customerId)]);

export const customerVehicles = sqliteTable("customer_vehicles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyCode: text("company_code").notNull(),
  customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  make: text("make").notNull().default(""),
  model: text("model").notNull().default(""),
  plateNumber: text("plate_number").notNull().default(""),
  vin: text("vin").notNull().default(""),
  vehicleYear: integer("vehicle_year"),
  mileage: integer("mileage").notNull().default(0),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [index("idx_customer_vehicles_customer").on(table.companyCode, table.customerId), index("idx_customer_vehicles_plate").on(table.companyCode, table.plateNumber)]);

export const customerMasterValues = sqliteTable("customer_master_values", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyCode: text("company_code").notNull(),
  category: text("category").notNull(),
  valueCode: text("value_code").notNull(),
  name: text("name").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [
  uniqueIndex("customer_master_values_company_category_code_unique").on(table.companyCode, table.category, table.valueCode),
  index("idx_customer_master_values_company_category").on(table.companyCode, table.category, table.sortOrder, table.name),
]);

export const invoices = sqliteTable("invoices", {
  warehouseCode: text("warehouse_code").notNull().default("MAIN"),
  salesOrderId: integer("sales_order_id").references(()=>salesOrders.id),
  salesOrderRevision: integer("sales_order_revision"),
  documentState: text("document_state").notNull().default("posted"),
  draftNumber: text("draft_number").notNull().default(""),
  createdBy: text("created_by").notNull().default(""),
  postedBy: text("posted_by").notNull().default(""),
  postedAt: text("posted_at").notNull().default(""),
  reversedBy: text("reversed_by").notNull().default(""),
  reversedAt: text("reversed_at").notNull().default(""),
  correctionReason: text("correction_reason").notNull().default(""),
  postRequestKey: text("post_request_key").notNull().default(""),
  postRequestHash: text("post_request_hash").notNull().default(""),
  lineDiscountTotal: real("line_discount_total").notNull().default(0),
  calculationVersion: integer("calculation_version").notNull().default(0),
  discountRate: real("discount_rate").notNull().default(0),
  discountAmount: real("discount_amount").notNull().default(0),
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyCode: text("company_code").notNull().default("default"),
  invoiceNumber: text("invoice_number").notNull(),
  invoiceDate: text("invoice_date").notNull().default(""),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  salesmanId: integer("salesman_id").references(() => salesmen.id),
  currency: text("currency").notNull().default(""),
  currencyRate: real("currency_rate").notNull().default(0),
  localCurrency: text("local_currency").notNull().default(""),
  paymentTerms: text("payment_terms").notNull().default(""),
  dueDate: text("due_date").notNull().default(""),
  sellerCompanyName: text("seller_company_name").notNull().default(""),
  sellerCompanyAddress: text("seller_company_address").notNull().default(""),
  sellerTaxRegistration: text("seller_tax_registration").notNull().default(""),
  sellerLogoDataUrl: text("seller_logo_data_url").notNull().default(""),
  customerCode: text("customer_code").notNull().default(""),
  customerName: text("customer_name").notNull().default(""),
  customerTradingName: text("customer_trading_name").notNull().default(""),
  customerMofNumber: text("customer_mof_number").notNull().default(""),
  customerPhone: text("customer_phone").notNull().default(""),
  customerMobile: text("customer_mobile").notNull().default(""),
  customerEmail: text("customer_email").notNull().default(""),
  customerAddress: text("customer_address").notNull().default(""),
  customerCity: text("customer_city").notNull().default(""),
  customerCountry: text("customer_country").notNull().default(""),
  salesmanCode: text("salesman_code").notNull().default(""),
  salesmanName: text("salesman_name").notNull().default(""),
  historicalFallbacks: text("historical_fallbacks").notNull().default(""),
  snapshotVersion: integer("snapshot_version").notNull().default(0),
  revision: integer("revision").notNull().default(1),
  editToken: text("edit_token").notNull().default(""),
  requestKey: text("request_key").notNull().default(""),
  requestHash: text("request_hash").notNull().default(""),
  purchaseOrderNumber: text("purchase_order_number").notNull().default(""),
  vehicle: text("vehicle").notNull().default(""),
  plateNumber: text("plate_number").notNull().default(""),
  mileage: integer("mileage").notNull().default(0),
  status: text("status").notNull().default("unpaid"),
  notes: text("notes").notNull().default(""),
  subtotal: real("subtotal").notNull().default(0),
  tax: real("tax").notNull().default(0),
  taxRate: real("tax_rate"),
  total: real("total").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(""),
}, table => [uniqueIndex("invoices_company_number_unique").on(table.companyCode, table.invoiceNumber), uniqueIndex("invoices_company_request_unique").on(table.companyCode,table.requestKey).where(sql`${table.requestKey} <> ''`), index("idx_invoices_company").on(table.companyCode), index("idx_invoices_company_date").on(table.companyCode, table.invoiceDate)]);

export const customerReceipts = sqliteTable("customer_receipts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyCode: text("company_code").notNull().default("default"),
  receiptNumber: text("receipt_number").notNull(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  receiptDate: text("receipt_date").notNull(),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  currencyRate: real("currency_rate").notNull().default(0),
  invoiceCurrencyAmount: real("invoice_currency_amount").notNull().default(0),
  accountNumber: text("account_number").notNull().default(""),
  paymentMethod: text("payment_method").notNull().default("cash"),
  reference: text("reference").notNull().default(""),
  notes: text("notes").notNull().default(""),
  requestKey: text("request_key").notNull().default(""),
  requestHash: text("request_hash").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [
  uniqueIndex("receipts_company_number_unique").on(table.companyCode, table.receiptNumber),
  index("idx_receipts_company_date").on(table.companyCode, table.receiptDate),
  index("idx_receipts_customer").on(table.customerId),
  uniqueIndex("receipts_company_request_unique").on(table.companyCode,table.requestKey).where(sql`${table.requestKey} <> ''`),
]);

export const receiptInvoiceAllocations = sqliteTable("receipt_invoice_allocations", {
  id: integer("id").primaryKey({autoIncrement:true}),
  companyCode: text("company_code").notNull(),
  receiptId: integer("receipt_id").notNull().references(()=>customerReceipts.id),
  invoiceId: integer("invoice_id").notNull().references(()=>invoices.id),
  amount: real("amount").notNull(),
  amountReceiptCurrency: real("amount_receipt_currency").notNull().default(0),
}, table=>[uniqueIndex("receipt_allocations_receipt_invoice_unique").on(table.receiptId,table.invoiceId),index("idx_receipt_allocations_invoice").on(table.companyCode,table.invoiceId)]);

export const customerAdvanceApplications = sqliteTable("customer_advance_applications", {
  id: integer("id").primaryKey({autoIncrement:true}),
  companyCode: text("company_code").notNull(),
  receiptId: integer("receipt_id").notNull().references(()=>customerReceipts.id),
  invoiceId: integer("invoice_id").notNull().references(()=>invoices.id),
  applicationDate: text("application_date").notNull(),
  amount: real("amount").notNull(),
  amountReceiptCurrency: real("amount_receipt_currency").notNull().default(0),
  requestKey: text("request_key").notNull().default(""),
  requestHash: text("request_hash").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table=>[index("idx_advance_applications_receipt").on(table.companyCode,table.receiptId),index("idx_advance_applications_invoice").on(table.companyCode,table.invoiceId),uniqueIndex("advance_applications_company_request_unique").on(table.companyCode,table.requestKey).where(sql`${table.requestKey} <> ''`)]);

export const documentSequences = sqliteTable("document_sequences", {
  companyCode: text("company_code").notNull(),
  documentType: text("document_type").notNull(),
  lastNumber: integer("last_number").notNull().default(0),
}, table=>[uniqueIndex("document_sequences_company_type_unique").on(table.companyCode,table.documentType)]);

export const paymentStatusReconciliations = sqliteTable("payment_status_reconciliations", {
  id: integer("id").primaryKey({autoIncrement:true}),
  companyCode: text("company_code").notNull(),
  invoiceId: integer("invoice_id").notNull().references(()=>invoices.id),
  legacyStatus: text("legacy_status").notNull(),
  calculatedStatus: text("calculated_status").notNull(),
  reason: text("reason").notNull(),
  resolved: integer("resolved",{mode:"boolean"}).notNull().default(false),
  detectedAt: text("detected_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table=>[uniqueIndex("payment_reconciliations_invoice_unique").on(table.invoiceId),index("idx_payment_reconciliations_company").on(table.companyCode,table.resolved)]);

export const invoiceEditGuards = sqliteTable("invoice_edit_guards", {
  invoiceId: integer("invoice_id").primaryKey().references(()=>invoices.id,{onDelete:"cascade"}),
  expectedRevision: integer("expected_revision").notNull(),
  editToken: text("edit_token").notNull(),
});

export const invoicePostingGuards = sqliteTable("invoice_posting_guards", {
  invoiceId: integer("invoice_id").primaryKey().references(()=>invoices.id,{onDelete:"cascade"}),
  token: text("token").notNull(),
});

export const invoiceLines = sqliteTable("invoice_lines", {
  unitFactor: real("unit_factor").notNull().default(1),
  salesOrderLineId: integer("sales_order_line_id").references(()=>salesOrderLines.id),
  unit: text("unit").notNull().default("unit"),
  lineDiscountRate: real("line_discount_rate").notNull().default(0),
  lineDiscountAmount: real("line_discount_amount").notNull().default(0),
  discountAmount: real("discount_amount").notNull().default(0),
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceId: integer("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  lineType: text("line_type").notNull(),
  itemId: integer("item_id").references(() => items.id),
  description: text("description").notNull(),
  quantity: real("quantity").notNull().default(1),
  unitPrice: real("unit_price").notNull().default(0),
  lineTotal: real("line_total").notNull().default(0),
  taxRate: real("tax_rate").notNull().default(0),
  taxAmount: real("tax_amount").notNull().default(0),
});

export const suppliers = sqliteTable("suppliers", {
  accountId: integer("account_id"),
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyCode: text("company_code").notNull().default("default"),
  supplierCode: text("supplier_code"),
  accountNumber: text("account_number").notNull().default(""),
  name: text("name").notNull(),
  mofNumber: text("mof_number").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  address: text("address").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [uniqueIndex("suppliers_company_code_unique").on(table.companyCode, table.supplierCode), index("idx_suppliers_company").on(table.companyCode)]);

export const purchaseInvoices = sqliteTable("purchase_invoices", {
  warehouseCode: text("warehouse_code").notNull().default("MAIN"),
  taxOverride: real("tax_override"),
  lbpRate: real("lbp_rate"),
  totalLbp: real("total_lbp"),
  expensesJson: text("expenses_json").notNull().default("[]"),
  currencyRate: real("currency_rate"),
  localCurrency: text("local_currency").notNull().default(""),
  expensePercent: real("expense_percent").notNull().default(0),
  expensesLocal: real("expenses_local").notNull().default(0),
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyCode: text("company_code").notNull().default("default"),
  purchaseNumber: text("purchase_number").notNull(),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  supplierName: text("supplier_name").notNull(),
  supplierInvoiceNumber: text("supplier_invoice_number").notNull().default(""),
  purchaseDate: text("purchase_date").notNull(),
  currency: text("currency").notNull().default("USD"),
  subtotal: real("subtotal").notNull().default(0),
  taxRate: real("tax_rate").notNull().default(0),
  tax: real("tax").notNull().default(0),
  total: real("total").notNull().default(0),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [uniqueIndex("purchases_company_number_unique").on(table.companyCode, table.purchaseNumber), index("idx_purchases_company").on(table.companyCode)]);

export const purchaseInvoiceLines = sqliteTable("purchase_invoice_lines", {
  landedUnitCost: real("landed_unit_cost"),
  unitFactor: real("unit_factor").notNull().default(1),
  unit: text("unit").notNull().default("unit"),
  id: integer("id").primaryKey({ autoIncrement: true }),
  purchaseInvoiceId: integer("purchase_invoice_id").notNull().references(() => purchaseInvoices.id, { onDelete: "cascade" }),
  itemId: integer("item_id").notNull().references(() => items.id),
  description: text("description").notNull(),
  quantity: real("quantity").notNull(),
  unitCost: real("unit_cost").notNull(),
  lineTotal: real("line_total").notNull(),
});

export const expenses = sqliteTable("expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyCode: text("company_code").notNull().default("default"),
  expenseDate: text("expense_date").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [index("idx_expenses_company_date").on(table.companyCode, table.expenseDate)]);

export const expenseCategories = sqliteTable("expense_categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyCode: text("company_code").notNull().default("default"),
  name: text("name").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [uniqueIndex("expense_categories_company_name_unique").on(table.companyCode, table.name), index("idx_expense_categories_company").on(table.companyCode)]);

export const workshopSettings = sqliteTable("workshop_settings", {
 customerAccountPrefix: text("customer_account_prefix").notNull().default("4111"),
 supplierAccountPrefix: text("supplier_account_prefix").notNull().default("4011"),
  negativeStockPolicy: text("negative_stock_policy").notNull().default("warn"),
  id: integer("id").primaryKey(),
  companyCode: text("company_code").notNull().default("default"),
  companyName: text("company_name").notNull().default("Auto Workshop"),
  companyAddress: text("company_address").notNull().default(""),
  sellerTaxRegistration: text("seller_tax_registration").notNull().default(""),
  menuName: text("menu_name").notNull().default("Workshop"),
  menuSubtitle: text("menu_subtitle").notNull().default("Service desk"),
  logoDataUrl: text("logo_data_url").notNull().default(""),
  overviewKicker: text("overview_kicker").notNull().default("BUSINESS DESK"),
  overviewTitle: text("overview_title").notNull().default("Ready for your next sale."),
  overviewDescription: text("overview_description").notNull().default("Create invoices, track items and serve customers from one place."),
  defaultTax: real("default_tax").notNull().default(11),
  salesAccountNumber: text("sales_account_number").notNull().default(""),
  taxAccountNumber: text("tax_account_number").notNull().default(""),
  purchaseAccountNumber: text("purchase_account_number").notNull().default(""),
  purchaseTaxAccountNumber: text("purchase_tax_account_number").notNull().default(""),
  defaultCurrency: text("default_currency").notNull().default("USD"),
  localCurrencyRate: real("local_currency_rate").notNull().default(1),
  localCurrency: text("local_currency").notNull().default("USD"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [uniqueIndex("workshop_settings_company_unique").on(table.companyCode)]);

export const creditNotes = sqliteTable("credit_notes", {
  warehouseCode: text("warehouse_code").notNull().default("MAIN"),
  localSubtotal: real("local_subtotal").notNull().default(0),
  localTax: real("local_tax").notNull().default(0),
  localTotal: real("local_total").notNull().default(0),
  workflow: text("workflow").notNull().default("legacy"),
  notes: text("notes").notNull().default(""),
  editToken: text("edit_token").notNull().default(""),
  id: integer("id").primaryKey({autoIncrement:true}),
  companyCode: text("company_code").notNull(),
  creditNumber: text("credit_number").notNull(),
  draftNumber: text("draft_number").notNull(),
  documentState: text("document_state").notNull().default("draft"),
  originalInvoiceId: integer("original_invoice_id").notNull().references(()=>invoices.id),
  creditDate: text("credit_date").notNull(),
  customerId: integer("customer_id").notNull().references(()=>customers.id),
  currency: text("currency").notNull(),
  currencyRate: real("currency_rate").notNull(),
  localCurrency: text("local_currency").notNull(),
  subtotal: real("subtotal").notNull().default(0),
  tax: real("tax").notNull().default(0),
  total: real("total").notNull().default(0),
  reason: text("reason").notNull(),
  createdBy: text("created_by").notNull(),
  postedBy: text("posted_by").notNull().default(""),
  postedAt: text("posted_at").notNull().default(""),
  requestKey: text("request_key").notNull(),
  requestHash: text("request_hash").notNull(),
  postRequestKey: text("post_request_key").notNull().default(""),
  postRequestHash: text("post_request_hash").notNull().default(""),
  revision: integer("revision").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table=>[
  uniqueIndex("credit_notes_company_number_unique").on(table.companyCode,table.creditNumber),
  uniqueIndex("credit_notes_company_draft_unique").on(table.companyCode,table.draftNumber),
  uniqueIndex("credit_notes_company_request_unique").on(table.companyCode,table.requestKey),
  index("idx_credit_notes_original").on(table.companyCode,table.originalInvoiceId),
]);

export const creditNoteLines = sqliteTable("credit_note_lines", {
  grossAmount: real("gross_amount").notNull().default(0),
  lineDiscountAmount: real("line_discount_amount").notNull().default(0),
  invoiceDiscountAmount: real("invoice_discount_amount").notNull().default(0),
  id: integer("id").primaryKey({autoIncrement:true}),
  creditNoteId: integer("credit_note_id").notNull().references(()=>creditNotes.id,{onDelete:"cascade"}),
  originalInvoiceLineId: integer("original_invoice_line_id").notNull().references(()=>invoiceLines.id),
  description: text("description").notNull(),
  quantityReturned: real("quantity_returned").notNull().default(0),
  restoreStock: integer("restore_stock",{mode:"boolean"}).notNull().default(false),
  subtotal: real("subtotal").notNull(),
  taxRate: real("tax_rate").notNull(),
  tax: real("tax").notNull(),
  total: real("total").notNull(),
});

export const creditNoteApplications = sqliteTable("credit_note_applications", {
  id: integer("id").primaryKey({autoIncrement:true}),
  companyCode: text("company_code").notNull(),
  creditNoteId: integer("credit_note_id").notNull().references(()=>creditNotes.id),
  invoiceId: integer("invoice_id").notNull().references(()=>invoices.id),
  applicationDate: text("application_date").notNull(),
  amount: real("amount").notNull(),
  amountCreditCurrency: real("amount_credit_currency").notNull().default(0),
  requestKey: text("request_key").notNull().default(""),
  requestHash: text("request_hash").notNull().default(""),
}, table=>[
  index("idx_credit_applications_note").on(table.companyCode,table.creditNoteId),
  index("idx_credit_applications_invoice").on(table.companyCode,table.invoiceId),
  uniqueIndex("credit_applications_request_unique").on(table.companyCode,table.requestKey).where(sql`${table.requestKey} <> ''`),
]);

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyCode: text("company_code").notNull().default("DEFAULT"),
  username: text("username").notNull(),
  usernameNormalized: text("username_normalized").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const stockTransactions = sqliteTable("stock_transactions", {
  warehouseCode: text("warehouse_code").notNull().default("MAIN"),
 id: integer("id").primaryKey({autoIncrement:true}),
 companyCode: text("company_code").notNull(),
 itemId: integer("item_id").notNull().references(()=>items.id),
 transactionType: text("transaction_type").notNull(),
 sourceId: integer("source_id"),
 sourceLineId: integer("source_line_id"),
 reference: text("reference").notNull().default(""),
 transactionDate: text("transaction_date").notNull(),
 quantity: real("quantity").notNull(),
 unitCost: real("unit_cost"),
 unitSalePrice: real("unit_sale_price"),
 currency: text("currency"),
 notes: text("notes").notNull().default(""),
 createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table=>[index("idx_stock_company_item").on(table.companyCode,table.itemId,table.id)]);

export const accountingTransactions = sqliteTable("accounting_transactions", {
  accountId: integer("account_id"),
 id: integer("id").primaryKey({autoIncrement:true}),
 companyCode: text("company_code").notNull(),
 transactionType: text("transaction_type").notNull(),
 sourceId: integer("source_id").notNull(),
 transactionDate: text("transaction_date").notNull(),
 accountNumber: text("account_number").notNull().default(""),
 currency: text("currency").notNull(),
 reference: text("reference").notNull(),
 amountCurrency: real("amount_currency").notNull(),
 amountLocalCurrency: real("amount_local_currency").notNull(),
 indicator: text("indicator").notNull(),
 notes: text("notes").notNull().default(""),
 createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table=>[index("idx_accounting_company_date").on(table.companyCode,table.transactionDate,table.id)]);

export const accounts = sqliteTable("accounts", {
 managed: integer("managed").notNull().default(0),
 id: integer("id").primaryKey({autoIncrement:true}),
 companyCode: text("company_code").notNull(),
 accountNumber: text("account_number").notNull(),
 name: text("name").notNull(),
 accountType: text("account_type").notNull(),
 currency: text("currency").notNull().default("USD"),
 active: integer("active",{mode:"boolean"}).notNull().default(true),
 notes: text("notes").notNull().default(""),
 createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table=>[uniqueIndex("accounts_company_number_unique").on(table.companyCode,table.accountNumber),index("idx_accounts_company_name").on(table.companyCode,table.name)]);

export const journalVouchers = sqliteTable("journal_vouchers", {
 id: integer("id").primaryKey({autoIncrement:true}),
 companyCode: text("company_code").notNull(),
 voucherNumber: text("voucher_number").notNull(),
 voucherDate: text("voucher_date").notNull(),
 currency: text("currency").notNull(),
 externalReference: text("external_reference").notNull().default(""),
 notes: text("notes").notNull().default(""),
 createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table=>[uniqueIndex("journal_vouchers_company_number_unique").on(table.companyCode,table.voucherNumber),index("idx_journal_vouchers_company_date").on(table.companyCode,table.voucherDate)]);

export const salesReturnGuards = sqliteTable('sales_return_guards', {
 token: text('token').primaryKey(),
 valid: integer('valid').notNull(),
});

export const salesOrders = sqliteTable('sales_orders', {
 warehouseCode:text('warehouse_code').notNull().default('MAIN'),
 id:integer('id').primaryKey({autoIncrement:true}),companyCode:text('company_code').notNull(),orderNumber:text('order_number').notNull(),state:text('state').notNull().default('draft'),revision:integer('revision').notNull().default(1),customerId:integer('customer_id').notNull().references(()=>customers.id),customerName:text('customer_name').notNull(),customerSnapshot:text('customer_snapshot').notNull(),orderDate:text('order_date').notNull(),expectedDeliveryDate:text('expected_delivery_date').notNull().default(''),currency:text('currency').notNull(),paymentTerms:text('payment_terms').notNull(),purchaseOrderNumber:text('purchase_order_number').notNull().default(''),notes:text('notes').notNull().default(''),discountRate:real('discount_rate').notNull().default(0),total:real('total').notNull(),requestKey:text('request_key').notNull(),requestHash:text('request_hash').notNull(),createdBy:text('created_by').notNull(),createdAt:text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
},t=>[uniqueIndex('sales_orders_company_number').on(t.companyCode,t.orderNumber),uniqueIndex('sales_orders_company_request').on(t.companyCode,t.requestKey),index('sales_orders_company_date').on(t.companyCode,t.orderDate)]);
export const salesOrderLines=sqliteTable('sales_order_lines',{
 unitFactor:real('unit_factor').notNull().default(1),
 id:integer('id').primaryKey({autoIncrement:true}),orderId:integer('order_id').notNull().references(()=>salesOrders.id),lineType:text('line_type').notNull(),itemId:integer('item_id').references(()=>items.id),description:text('description').notNull(),unit:text('unit').notNull().default('unit'),quantity:real('quantity').notNull(),unitPrice:real('unit_price').notNull(),lineDiscountRate:real('line_discount_rate').notNull().default(0),taxRate:real('tax_rate').notNull().default(0)
},t=>[index('sales_order_lines_order').on(t.orderId)]);
export const salesOrderGuards=sqliteTable('sales_order_guards',{token:text('token').primaryKey().notNull(),valid:integer('valid').notNull()});
export const salesOrderEvents=sqliteTable('sales_order_events',{id:integer('id').primaryKey({autoIncrement:true}),orderId:integer('order_id').notNull().references(()=>salesOrders.id),action:text('action').notNull(),actor:text('actor').notNull(),createdAt:text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)});

export const itemBarcodes=sqliteTable('item_barcodes',{
 id:integer('id').primaryKey({autoIncrement:true}),companyCode:text('company_code').notNull(),itemId:integer('item_id').notNull().references(()=>items.id),code:text('code').notNull(),unit:text('unit').notNull(),isPrimary:integer('is_primary').notNull().default(0)
},t=>[uniqueIndex('item_barcodes_company_code').on(t.companyCode,t.code),index('item_barcodes_item').on(t.itemId)]);
export const itemMasterValues=sqliteTable('item_master_values',{
 id:integer('id').primaryKey({autoIncrement:true}),companyCode:text('company_code').notNull(),category:text('category').notNull(),name:text('name').notNull(),parent:text('parent').notNull().default(''),active:integer('active').notNull().default(1)
},t=>[uniqueIndex('item_master_values_unique').on(t.companyCode,t.category,t.parent,t.name)]);
export const itemMasterGuards=sqliteTable('item_master_guards',{
 token:text('token').primaryKey(),valid:integer('valid').notNull()
});

export const warehouses=sqliteTable('warehouses',{
 id:integer('id').primaryKey({autoIncrement:true}),companyCode:text('company_code').notNull(),code:text('code').notNull(),name:text('name').notNull(),address:text('address').notNull().default(''),active:integer('active').notNull().default(1)
},t=>[uniqueIndex('warehouses_company_code').on(t.companyCode,t.code)]);

export const coaPostingGuards=sqliteTable("coa_posting_guards",{token:text("token").primaryKey(),maxId:integer("max_id").notNull(),valid:integer("valid").notNull()});
export const coaWriteGuards=sqliteTable("coa_write_guards",{token:text("token").primaryKey(),valid:integer("valid").notNull()});
