import { getRawDb } from "../../../db";
import { requireUser } from "../../../db/auth";
import { getWorkshopSettings } from "../../../db/settings";

const validDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value);

export async function GET(request:Request){
 const auth=await requireUser(request);if(auth instanceof Response)return auth;
 const params=new URL(request.url).searchParams,from=params.get("from")??"",to=params.get("to")??"";
 if(!validDate(from)||!validDate(to)||from>to)return Response.json({error:"Choose a valid From and To date."},{status:400});
 try{const db=getRawDb(),company=auth.companyCode.toLowerCase(),[result,settings]=await Promise.all([
  db.prepare(`WITH ledger_accounts AS (
    SELECT company_code,account_number,name,account_type FROM accounts WHERE company_code=?
    UNION ALL
    SELECT DISTINCT tx.company_code,tx.account_number,
      CASE WHEN tx.account_number='' THEN 'Unassigned account' ELSE 'Account missing from chart' END AS name,
      'unassigned' AS account_type
    FROM accounting_transactions tx
    LEFT JOIN accounts existing ON existing.company_code=tx.company_code AND existing.account_number=tx.account_number
    WHERE tx.company_code=? AND existing.id IS NULL
   )
   SELECT account.account_number AS accountNumber,account.name,account.account_type AS accountType,
   COALESCE(SUM(CASE WHEN tx.transaction_date<? AND tx.indicator='debit' THEN tx.amount_local_currency WHEN tx.transaction_date<? AND tx.indicator='credit' THEN -tx.amount_local_currency ELSE 0 END),0) AS openingBalance,
   COALESCE(SUM(CASE WHEN tx.transaction_date>=? AND tx.indicator='debit' THEN tx.amount_local_currency ELSE 0 END),0) AS periodDebit,
   COALESCE(SUM(CASE WHEN tx.transaction_date>=? AND tx.indicator='credit' THEN tx.amount_local_currency ELSE 0 END),0) AS periodCredit
   FROM ledger_accounts account LEFT JOIN accounting_transactions tx ON tx.company_code=account.company_code AND tx.account_number=account.account_number AND tx.transaction_date<=?
   WHERE account.company_code=?
   GROUP BY account.account_number,account.name,account.account_type
   HAVING ABS(openingBalance)>=0.005 OR ABS(periodDebit)>=0.005 OR ABS(periodCredit)>=0.005
   ORDER BY account.account_number`).bind(company,company,from,from,from,from,to,company).all(),
  getWorkshopSettings(company,db),
 ]);return Response.json({from,to,currency:settings.localCurrency,companyName:settings.companyName,accounts:result.results});
 }catch(error){console.error(error);return Response.json({error:"Could not prepare the trial balance."},{status:500})}
}
