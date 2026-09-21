import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import ts from 'typescript';
import ExcelJS from 'exceljs';
const require=createRequire(import.meta.url);
const compile=(file,dependencies={})=>{const context={exports:{},require:name=>dependencies[name]??require(name),fetch:(...args)=>globalThis.fetch(...args),Date,Number,Math};new Function('require','exports','fetch',ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(context.require,context.exports,context.fetch);return context.exports;};
const report=compile('lib/invoice-report.ts');
const {invoiceReportWorkbook}=compile('lib/invoice-report-excel.ts',{'./invoice-report':report});
const invoices=[{id:2,invoiceNumber:'INV-000002',invoiceDate:'2026-09-17',customerId:1,customerName:'=1+1 العربية',customerCode:'0001',vehicle:'Car',plateNumber:'0012',status:'unpaid',subtotal:90,discountAmount:10,lineDiscountTotal:5,tax:9.9,total:99.9,appliedAmount:20,outstanding:79.9},{id:1,invoiceNumber:'INV-000001',invoiceDate:'2026-09-01',customerId:1,customerName:'Customer',customerCode:'0001',vehicle:'',plateNumber:'',status:'paid',subtotal:50,discountAmount:0,tax:0,total:50,appliedAmount:0,outstanding:50}];
const buffer=await invoiceReportWorkbook(invoices,{companyName:'Test company',currency:'USD',customer:'All customers',fromDate:'2026-09-01',toDate:'2026-09-30'});
const book=new ExcelJS.Workbook();await book.xlsx.load(buffer);const sheet=book.getWorksheet('Invoice list');
assert.equal(sheet.getCell('D7').value,'=1+1 العربية');assert.equal(sheet.getCell('C7').value,'0001');
assert.equal(sheet.getCell('B7').value.toISOString(),'2026-09-17T00:00:00.000Z');
// A legacy paid flag must not erase an outstanding amount without allocations.
assert.equal(sheet.getCell('L8').value,50);assert.equal(sheet.getCell('H9').result,10);assert.equal(sheet.getCell('K9').result,149.9);assert.equal(sheet.getCell('L9').result,129.9);assert.equal(sheet.getCell('K9').formula,'SUM(K7:K8)');
assert.equal(sheet.pageSetup.orientation,'landscape');assert.equal(sheet.views[0].ySplit,6);assert.equal(sheet.autoFilter,'A6:L8');
assert.ok(!sheet.getRow(6).values.includes('Vehicle'));assert.ok(!sheet.getRow(6).values.includes('Plate'));
const original=globalThis.fetch;const calls=[];
globalThis.fetch=async url=>{calls.push(url);return Response.json({invoices:[invoices[calls.length-1]],nextCursor:calls.length===1?2:null})};
const loaded=await report.loadInvoiceReport(new AbortController().signal);assert.equal(loaded.length,2);assert.ok(calls[1].endsWith('&beforeId=2'));
globalThis.fetch=async()=>new Response(JSON.stringify({error:'Unavailable'}),{status:503});await assert.rejects(()=>report.loadInvoiceReport(new AbortController().signal),/Unavailable/);globalThis.fetch=original;
console.log('Passed genuine XLSX round-trip: Unicode text, safe text cells, numeric totals, formulas, dates, leading zeros, removed vehicle columns, print settings; full report loading and failure handling.');

assert.equal(sheet.getCell('G9').result,5);assert.equal(sheet.getCell('F9').result,155);
