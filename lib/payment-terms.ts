export function paymentTermDays(value:string){
  const normalized=String(value??"").trim().toLowerCase();
  if(!normalized||normalized==="cash"||normalized==="due_on_receipt")return 0;
  const match=normalized.match(/(\d+)/);
  return match?Math.max(0,Math.min(3650,Number(match[1]))):0;
}

export function dueDateFor(invoiceDate:string,paymentTerms:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate))return invoiceDate;
  const date=new Date(invoiceDate+"T00:00:00Z");
  date.setUTCDate(date.getUTCDate()+paymentTermDays(paymentTerms));
  return date.toISOString().slice(0,10);
}

export function paymentTermsLabel(value:string){
  if(value==="cash"||value==="due_on_receipt")return "Due on receipt";
  return value.replaceAll("_"," ").replace(/^./,letter=>letter.toUpperCase());
}
