import ExcelJS from 'exceljs';
import {labels,type ReportRow,type Column,type Filters} from './operational-reports';
export type ReportResult={id:string;title:string;companyName:string;generatedAt:string;columns:Column[];rows:ReportRow[];totals:ReportRow[];subtotals:ReportRow[];options:Record<string,string[]>;filters:Filters;warnings:string[]};
export function filterDescription(f:Filters){return [f.from+' to '+f.to,...Object.entries(f.selections).filter(([,v])=>v.length).map(([k,v])=>(labels[k]||k)+': '+v.join(', ')),...(f.search?['Reference contains: '+f.search]:[]),...(f.min!==''?['Minimum outstanding: '+f.min]:[]),...(f.max!==''?['Maximum outstanding: '+f.max]:[]),'View: '+f.mode,'Group: '+(f.group||'None'),'Sort: '+f.sort+(f.descending?' descending':' ascending')].join(' · ')}
export async function operationalWorkbook(report:ReportResult){
 const book=new ExcelJS.Workbook();book.creator='AMIGA-ERP';book.created=new Date(report.generatedAt);
 const sheet=book.addWorksheet('Report',{pageSetup:{orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:9},views:[{state:'frozen',ySplit:6}]});
 sheet.addRow([report.title]);sheet.addRow([report.companyName]);sheet.addRow(['Generated',new Date(report.generatedAt)]);sheet.getCell('B3').numFmt='yyyy-mm-dd hh:mm:ss';sheet.addRow([filterDescription(report.filters)]);sheet.addRow(['Amounts remain in the displayed currency; quantities in the displayed base unit. Unavailable values are blank.']);sheet.addRow(report.columns.map(c=>c.label));
 const add=(row:ReportRow)=>sheet.addRow(report.columns.map(c=>{const v=row[c.key];if(c.key==='date'&&typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v))return new Date(v+'T00:00:00Z');return v??null}));
 report.rows.forEach(add);const last=sheet.rowCount;sheet.autoFilter={from:{row:6,column:1},to:{row:Math.max(6,last),column:report.columns.length}};
 if(report.subtotals.length){sheet.addRow([]);sheet.addRow(['SUBTOTALS']);report.subtotals.forEach(add)}
 sheet.addRow([]);sheet.addRow(['GRAND TOTALS — separately by currency and base unit']);report.totals.forEach(add);
 sheet.columns.forEach((c,i)=>{c.width=report.columns[i].numeric?20:28;if(report.columns[i].numeric)c.numFmt='#,##0.00########;[Red](#,##0.00########)';if(report.columns[i].key==='date')c.numFmt='yyyy-mm-dd'});
 for(const n of [1,6]){sheet.getRow(n).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(n).fill={type:'pattern',pattern:'solid',fgColor:{argb:n===1?'FF211B20':'FFBF3656'}}}
 sheet.pageSetup.printTitlesRow='1:6';sheet.headerFooter.oddFooter='Page &P of &N';
 const notes=book.addWorksheet('Report notes');notes.columns=[{width:120}];report.warnings.forEach(w=>{const r=notes.addRow([w]);r.alignment={wrapText:true};r.height=45});
 return book.xlsx.writeBuffer();
}
