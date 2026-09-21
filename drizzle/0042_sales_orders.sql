CREATE TABLE sales_orders (
 id INTEGER PRIMARY KEY AUTOINCREMENT, company_code TEXT NOT NULL, order_number TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','confirmed','cancelled')), revision INTEGER NOT NULL DEFAULT 1,
 customer_id INTEGER NOT NULL REFERENCES customers(id), customer_name TEXT NOT NULL, customer_snapshot TEXT NOT NULL,
 order_date TEXT NOT NULL, expected_delivery_date TEXT NOT NULL DEFAULT '', currency TEXT NOT NULL, payment_terms TEXT NOT NULL,
 purchase_order_number TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', discount_rate REAL NOT NULL DEFAULT 0,
 total REAL NOT NULL, request_key TEXT NOT NULL, request_hash TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX sales_orders_company_number ON sales_orders(company_code,order_number);
CREATE UNIQUE INDEX sales_orders_company_request ON sales_orders(company_code,request_key);
CREATE TABLE sales_order_lines (
 id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL REFERENCES sales_orders(id), line_type TEXT NOT NULL,
 item_id INTEGER REFERENCES items(id), description TEXT NOT NULL, unit TEXT NOT NULL DEFAULT 'unit',
 quantity REAL NOT NULL CHECK(quantity>0), unit_price REAL NOT NULL CHECK(unit_price>=0),
 line_discount_rate REAL NOT NULL DEFAULT 0, tax_rate REAL NOT NULL DEFAULT 0
);
CREATE INDEX sales_order_lines_order ON sales_order_lines(order_id);
CREATE INDEX sales_orders_company_date ON sales_orders(company_code,order_date);
CREATE TABLE sales_order_guards (token TEXT PRIMARY KEY NOT NULL, valid INTEGER NOT NULL);
CREATE TABLE sales_order_events (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL REFERENCES sales_orders(id), action TEXT NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
ALTER TABLE invoices ADD sales_order_id INTEGER REFERENCES sales_orders(id);
ALTER TABLE invoices ADD sales_order_revision INTEGER;
ALTER TABLE invoice_lines ADD sales_order_line_id INTEGER REFERENCES sales_order_lines(id);
ALTER TABLE invoice_lines ADD unit TEXT NOT NULL DEFAULT 'unit';
CREATE INDEX invoices_sales_order ON invoices(sales_order_id);
CREATE INDEX invoice_lines_sales_order ON invoice_lines(sales_order_line_id);
CREATE TRIGGER sales_order_link_guard BEFORE UPDATE OF sales_order_id ON invoices WHEN NEW.sales_order_id IS NOT NULL AND OLD.sales_order_id IS NULL BEGIN
 SELECT RAISE(ABORT,'Sales order changed. Refresh before converting.') WHERE NOT EXISTS(SELECT 1 FROM sales_orders o WHERE o.id=NEW.sales_order_id AND o.company_code=NEW.company_code AND o.customer_id=NEW.customer_id AND o.currency=NEW.currency AND o.state='confirmed' AND o.revision=NEW.sales_order_revision);
 UPDATE sales_orders SET revision=revision+1 WHERE id=NEW.sales_order_id;
END;
CREATE TRIGGER sales_order_quantity_guard BEFORE UPDATE OF sales_order_line_id ON invoice_lines WHEN NEW.sales_order_line_id IS NOT NULL AND OLD.sales_order_line_id IS NULL BEGIN
 SELECT RAISE(ABORT,'Quantity exceeds remaining sales order quantity.') WHERE NOT EXISTS(SELECT 1 FROM sales_order_lines l JOIN invoices i ON i.id=NEW.invoice_id WHERE l.id=NEW.sales_order_line_id AND l.order_id=i.sales_order_id AND NEW.quantity>0 AND NEW.quantity<=l.quantity-COALESCE((SELECT SUM(x.quantity) FROM invoice_lines x JOIN invoices xi ON xi.id=x.invoice_id WHERE x.sales_order_line_id=l.id AND xi.document_state IN ('draft','posted','reversed')),0)+0.000000001);
END;
CREATE TRIGGER sales_order_invoice_line_immutable BEFORE UPDATE ON invoice_lines WHEN OLD.sales_order_line_id IS NOT NULL AND (NEW.sales_order_line_id IS NOT OLD.sales_order_line_id OR NEW.quantity<>OLD.quantity OR NEW.unit_price<>OLD.unit_price OR NEW.discount_amount<>OLD.discount_amount OR NEW.tax_amount<>OLD.tax_amount OR NEW.line_discount_amount<>OLD.line_discount_amount OR NEW.item_id IS NOT OLD.item_id OR NEW.description<>OLD.description OR NEW.tax_rate<>OLD.tax_rate OR NEW.line_discount_rate<>OLD.line_discount_rate OR NEW.invoice_id<>OLD.invoice_id OR NEW.line_total<>OLD.line_total) BEGIN
 SELECT RAISE(ABORT,'Order invoice lines are locked. Cancel the draft and convert again.');
END;
CREATE TRIGGER sales_order_invoice_line_delete BEFORE DELETE ON invoice_lines WHEN OLD.sales_order_line_id IS NOT NULL AND EXISTS(SELECT 1 FROM invoices WHERE id=OLD.invoice_id AND document_state<>'cancelled') BEGIN
 SELECT RAISE(ABORT,'Cancel the order invoice draft before deleting its lines.');
END;
CREATE TRIGGER sales_order_invoice_state AFTER UPDATE OF document_state ON invoices WHEN NEW.sales_order_id IS NOT NULL AND NEW.document_state<>OLD.document_state BEGIN
 UPDATE sales_orders SET revision=revision+1 WHERE id=NEW.sales_order_id;
END;
CREATE TRIGGER sales_order_financial_lock BEFORE UPDATE OF customer_id,currency,discount_rate,payment_terms,customer_snapshot ON sales_orders WHEN EXISTS(SELECT 1 FROM invoices WHERE sales_order_id=OLD.id) BEGIN
 SELECT RAISE(ABORT,'An order with invoice history cannot be rewritten.');
END;
CREATE TRIGGER sales_order_line_delete_lock BEFORE DELETE ON sales_order_lines WHEN EXISTS(SELECT 1 FROM invoices WHERE sales_order_id=OLD.order_id) BEGIN
 SELECT RAISE(ABORT,'An order with invoice history cannot be rewritten.');
END;
