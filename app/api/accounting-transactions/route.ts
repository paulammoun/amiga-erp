import { getRawDb } from "../../../db";
import { requireUser } from "../../../db/auth";

export async function GET(request:Request){
 const auth=await requireUser(request);if(auth instanceof Response)return auth;
 const params=new URL(request.url).searchParams,page=Number(params.get("page")||1);
 if(!Number.isSafeInteger(page)||page<1||page>100000)return Response.json({error:"Invalid page."},{status:400});
 const from=params.get('from')||'',to=params.get('to')||'',side=params.get('side')||'';
 const validDate=(s:string)=>!s||(/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s);
 if(!validDate(from)||!validDate(to)||(from&&to&&from>to))return Response.json({error:"Enter a valid date range."},{status:400});
 if(side&&!['debit','credit'].includes(side))return Response.json({error:"Invalid debit/credit filter."},{status:400});
 const where=['t.company_code=?'],args:(string|number)[]=[auth.companyCode.toLowerCase()];
 if(from){where.push('t.transaction_date>=?');args.push(from)}
 if(to){where.push('t.transaction_date<=?');args.push(to)}
 for(const [key,column] of [['reference','t.reference'],['account',"t.account_number||' '||coalesce(a.name,'')"],['notes','t.notes'],['q',"t.account_number||' '||coalesce(a.name,'')||' '||t.reference||' '||t.notes"]]){const value=(params.get(key)||'').trim();if(value){where.push(`instr(lower(${column}),lower(?))>0`);args.push(value)}}
 for(const [key,column] of [['currency','t.currency'],['type','t.transaction_type'],['side','t.indicator']]){const value=(params.get(key)||'').trim();if(value){where.push(`${column}=?`);args.push(value)}}
 try{
  const db=getRawDb();
  // Paginate whole references; blank references remain separate historical entries.
  const result=await db.prepare(`WITH filtered AS (
   SELECT t.id,t.transaction_date AS transactionDate,t.account_number AS accountNumber,coalesce(a.name,'') AS accountName,t.currency,t.reference,t.transaction_type AS transactionType,t.amount_currency AS amountCurrency,t.amount_local_currency AS amountLocalCurrency,t.indicator,t.notes,
    CASE WHEN trim(t.reference)='' THEN 'entry:'||t.id ELSE 'reference:'||t.reference END AS groupKey
   FROM accounting_transactions t LEFT JOIN accounts a ON a.company_code=t.company_code AND a.account_number=t.account_number WHERE ${where.join(' AND ')}
  ), groups AS (SELECT groupKey,ROW_NUMBER() OVER(ORDER BY MAX(transactionDate) DESC,MAX(id) DESC) AS position FROM filtered GROUP BY groupKey)
  SELECT f.*,g.position FROM filtered f JOIN groups g ON g.groupKey=f.groupKey WHERE g.position>? AND g.position<=? ORDER BY g.position,f.transactionDate,f.id`).bind(...args,(page-1)*20,page*20+1).all();
  const options=await db.prepare('SELECT DISTINCT currency,transaction_type AS transactionType FROM accounting_transactions WHERE company_code=? ORDER BY currency,transaction_type').bind(auth.companyCode.toLowerCase()).all();
  return Response.json({transactions:result.results.filter(r=>Number(r.position)<=page*20),hasMore:result.results.some(r=>Number(r.position)>page*20),currencies:[...new Set(options.results.map(r=>r.currency))],types:[...new Set(options.results.map(r=>r.transactionType))]});
 }catch(error){console.error(error);return Response.json({error:"Could not load journal voucher report."},{status:500});}
}
