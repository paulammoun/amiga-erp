type PricedLine = { quantity: number; unitPrice: number; taxRate: number | null; lineDiscountRate?: number | null };

// Convert decimal inputs before multiplication; round each monetary stage half up to cents.
function decimal(value: number): [bigint, bigint] {
  if (!Number.isFinite(value) || value < 0) return [BigInt(0), BigInt(1)]; // incomplete entry preview
  const [mantissa, exponent = "0"] = String(value).split("e");
  const places = (mantissa.split(".")[1]?.length ?? 0) - Number(exponent);
  const digits = BigInt(mantissa.replace(".", ""));
  return places >= 0 ? [digits, BigInt(10) ** BigInt(places)] : [digits * BigInt(10) ** BigInt(-places), BigInt(1)];
}
const round = (n: bigint, d: bigint) => (BigInt(2) * n + d) / (BigInt(2) * d);
function productCents(a: number, b: number) {
  const [an, ad] = decimal(a), [bn, bd] = decimal(b);
  return round(an * bn * BigInt(100), ad * bd);
}
function percentage(amount: bigint, rate: number) {
  const [n, d] = decimal(Math.min(100, rate));
  return round(amount * n, d * BigInt(100));
}
const money = (cents: bigint) => Number(cents) / 100;

/** Gross -> line discount -> additional invoice discount -> per-line VAT.
 * Allocate cumulative rounded shares in saved line order, including any residual cent.
 * discountAmount retains its original meaning: allocated invoice discount only.
 */
export function invoiceTotals(lines: PricedLine[], discountRate = 0, orderDiscounts?: number[]) {
  const gross = lines.map(line => productCents(line.quantity, line.unitPrice));
  const discounts = lines.map((line, i) => percentage(gross[i], line.lineDiscountRate ?? 0));
  const remaining = gross.map((amount, i) => amount - discounts[i]);
  const sum = (values: bigint[]) => values.reduce((a, b) => a + b, BigInt(0));
  const grossCents = sum(gross), lineDiscountCents = sum(discounts), remainingCents = sum(remaining);
  const discountCents = orderDiscounts ? sum(orderDiscounts.map(v=>productCents(v,1))) : percentage(remainingCents, discountRate);
  let cumulative = BigInt(0), allocated = BigInt(0), taxCents = BigInt(0);
  const amounts = lines.map((line, index) => {
    cumulative += remaining[index];
    const cumulativeDiscount = remainingCents ? round(discountCents * cumulative, remainingCents) : BigInt(0);
    const invoiceDiscount = orderDiscounts ? productCents(orderDiscounts[index],1) : cumulativeDiscount - allocated;
    allocated = cumulativeDiscount;
    const net = remaining[index] - invoiceDiscount;
    const tax = percentage(net, line.taxRate ?? 0);
    taxCents += tax;
    return { lineTotal: money(gross[index]), lineDiscountAmount: money(discounts[index]), discountAmount: money(invoiceDiscount), netAmount: money(net), taxAmount: money(tax), total: money(net + tax) };
  });
  const netCents = remainingCents - discountCents;
  return { grossSubtotal: money(grossCents), lineDiscountTotal: money(lineDiscountCents), discountAmount: money(discountCents), subtotal: money(netCents), tax: money(taxCents), taxRate: netCents ? Number((Number(taxCents) / Number(netCents) * 100).toFixed(6)) : 0, total: money(netCents + taxCents), lines: amounts };
}

/** Display saved amounts; never recalculate historical discounts or VAT. */
export function savedLineTotal(line: {lineTotal:number;lineDiscountAmount?:number;discountAmount?:number;taxAmount:number}) {
  return (Math.round(line.lineTotal*100)-Math.round((line.lineDiscountAmount??0)*100)-Math.round((line.discountAmount??0)*100)+Math.round(line.taxAmount*100))/100;
}

/** Local total and net round first; VAT receives the residual cent.
 * Legacy records retain their original independently rounded countervalues.
 */
export function localCountervalues(invoice: {subtotal:number;tax:number;total:number;calculationVersion?:number;grossSubtotal?:number}, rate:number) {
  const net = productCents(invoice.subtotal, rate), total = productCents(invoice.total, rate);
  const reconciled=Boolean(invoice.calculationVersion)||"grossSubtotal" in invoice;
  return { subtotal:money(net), tax:money(reconciled ? total-net : productCents(invoice.tax,rate)), total:money(total) };
}
