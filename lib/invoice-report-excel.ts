import ExcelJS from 'exceljs';
import {amountDue,paymentStatus,reportTotals,type ReportDetails,type ReportInvoice} from './invoice-report';

export async function invoiceReportWorkbook(invoices:ReportInvoice[],details:ReportDetails){
 const book=new ExcelJS.Workbook();book.creator=details.companyName;book.created=new Date();
 const sheet=book.addWorksheet('Invoice list',{views:[{state:'frozen',ySplit:6}],pageSetup:{orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:6'}});
 sheet.columns=[{width:19},{width:14},{width:18},{width:30},{width:13},...Array.from({length:7},()=>({width:19}))];
 sheet.addRow([details.companyName]);sheet.mergeCells('A1:L1');sheet.getRow(1).font={size:18,bold:true};
 sheet.addRow(['Invoice list report']);sheet.mergeCells('A2:L2');sheet.getRow(2).font={size:14,bold:true};
 sheet.addRow(['Customer',details.customer]);sheet.mergeCells('B3:L3');
 sheet.addRow(['From',details.fromDate||'All dates','To',details.toDate||'All dates','Currency',details.currency]);
 sheet.addRow([]);
 sheet.addRow(['Invoice','Date','Customer code','Customer','Status',`Gross subtotal (${details.currency})`,`Line discounts (${details.currency})`,`Additional invoice discount (${details.currency})`,`Net before VAT (${details.currency})`,`VAT (${details.currency})`,`Total incl. VAT (${details.currency})`,`Due (${details.currency})`]);
 sheet.getRow(6).height=34;sheet.getRow(6).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(6).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF211B20'}};sheet.getRow(6).alignment={vertical:'middle',wrapText:true};
 for(const i of invoices)sheet.addRow([i.invoiceNumber,new Date(i.invoiceDate+'T00:00:00Z'),i.customerCode,i.customerName,paymentStatus(i),i.subtotal+(i.discountAmount||0)+(i.lineDiscountTotal||0),i.lineDiscountTotal||0,i.discountAmount||0,i.subtotal,i.tax,i.total,amountDue(i)]);
 const last=sheet.rowCount;sheet.autoFilter={from:{row:6,column:1},to:{row:last,column:12}};
 const totals=reportTotals(invoices);const row=sheet.addRow(['Totals','','','',invoices.length,totals.gross,totals.lineDiscount,totals.discount,totals.subtotal,totals.tax,totals.total,totals.due]);
 row.font={bold:true};row.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF5E9ED'}};
 for(let index=6;index<=12;index++){
  sheet.getColumn(index).numFmt='#,##0.00;[Red](#,##0.00)';
  const letter=sheet.getColumn(index).letter;
  row.getCell(index).value={formula:`SUM(${letter}7:${letter}${last})`,result:Number(row.getCell(index).value)};
 }
 sheet.getColumn(2).numFmt='yyyy-mm-dd';
 sheet.eachRow((r,n)=>{if(n>6)r.alignment={vertical:'top',wrapText:true};});
 sheet.pageSetup.printArea=`A1:L${sheet.rowCount}`;
 sheet.headerFooter.oddFooter='&L'+details.companyName.replaceAll('&','&&')+'&RPage &P of &N';
 return book.xlsx.writeBuffer();
}
