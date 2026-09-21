import { getRawDb } from "../../../db";
import { requireUser } from "../../../db/auth";
import { getWorkshopSettings } from "../../../db/settings";

const validDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value);

export async function GET(request:Request){
 const auth=await requireUser(request);if(auth instanceof Response)return auth;
 const params=new URL(request.url).searchParams,accountNumber=(params.get("accountNumber")??"").trim(),from=params.get("from")??"",to=params.get("to")??"";
 if(!accountNumber||accountNumber.length>100||!validDate(from)||!validDate(to)||from>to)return Response.json({error:"Choose an account and a valid From and To date."},{status:400});
 try{const db=getRawDb(),company=auth.companyCode.toLowerCase(),[account,opening,transactions,settings]=await Promise.all([
  db.prepare("SELECT account_number AS accountNumber,name,account_type AS accountType,currency,active FROM accounts WHERE company_code=? AND account_number=?").bind(company,accountNumber).first(),
  db.prepare("SELECT COALESCE(SUM(CASE WHEN indicator='debit' THEN amount_local_currency ELSE -amount_local_currency END),0) AS balance FROM accounting_transactions WHERE company_code=? AND account_number=? AND transaction_date<?").bind(company,accountNumber,from).first<{balance:number}>(),
  db.prepare("SELECT id,transaction_date AS transactionDate,transaction_type AS transactionType,reference,currency,amount_currency AS amountCurrency,amount_local_currency AS amountLocalCurrency,indicator,notes FROM accounting_transactions WHERE company_code=? AND account_number=? AND transaction_date>=? AND transaction_date<=? ORDER BY transaction_date,id").bind(company,accountNumber,from,to).all(),
  getWorkshopSettings(company,db),
 ]);if(!account)return Response.json({error:"Account not found."},{status:404});return Response.json({account,from,to,currency:settings.localCurrency,openingBalance:Number(opening?.balance??0),transactions:transactions.results});
 }catch(error){console.error(error);return Response.json({error:"Could not prepare the account statement."},{status:500})}
}
