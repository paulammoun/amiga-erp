import {DatabaseSync} from 'node:sqlite';import fs from 'node:fs';import assert from 'node:assert/strict';
const db=new DatabaseSync(':memory:'),files=fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort();
for(const file of files.filter(f=>!f.startsWith('0043_')))db.exec(fs.readFileSync('drizzle/'+file,'utf8'));
db.exec(`INSERT INTO items(id,company_code,sku,name,brand,stock_qty,sale_price) VALUES(1,'legacy','A','Legacy item','Old brand',7.5,13);
INSERT INTO customers(id,company_code,name) VALUES(1,'legacy','Customer');
INSERT INTO invoices(id,company_code,invoice_number,customer_id,total) VALUES(1,'legacy','INV-OLD',1,39);
INSERT INTO invoice_lines(invoice_id,line_type,item_id,description,unit,quantity,unit_price,line_total) VALUES(1,'part',1,'Old description','piece',3,13,39);
INSERT INTO stock_transactions(company_code,item_id,transaction_type,reference,transaction_date,quantity) VALUES('legacy',1,'sale','INV-OLD','2026-01-01',-3);`);
const before=Object.fromEntries(['items','invoices','invoice_lines','stock_transactions'].map(t=>[t,db.prepare('SELECT * FROM '+t).all()]));
db.exec(fs.readFileSync('drizzle/0043_aspiring_spacker_dave.sql','utf8'));
for(const [table,rows] of Object.entries(before)){const after=db.prepare('SELECT * FROM '+table).all();for(let n=0;n<rows.length;n++)for(const column of Object.keys(rows[n]))assert.deepEqual(after[n][column],rows[n][column]);}
assert.equal(db.prepare('SELECT unit_factor FROM invoice_lines').get().unit_factor,1);assert.equal(db.prepare('SELECT active FROM items').get().active,1);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
console.log('PASS additive migration preserves every historical item, invoice, line and stock field; legacy conversion factor is 1; integrity check passed.');
