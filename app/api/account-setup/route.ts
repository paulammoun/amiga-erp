import {getRawDb} from "../../../db";
import {requireUser} from "../../../db/auth";
import {getWorkshopSettings} from "../../../db/settings";
import {accountAssertion} from "../../../db/coa-write";
export async function GET(request:Request){const auth=await requireUser(request);if(auth instanceof Response)return auth;return Response.json({settings:await getWorkshopSettings(auth.companyCode)});}
export async function PUT(request:Request){
 const auth=await requireUser(request);if(auth instanceof Response)return auth;
 try{
  const b=await request.json() as Record<string,unknown>,company=auth.companyCode.toLowerCase(),db=getRawDb(),settings=await getWorkshopSettings(company,db);
  const customer=String(b.customerAccountPrefix??""),supplier=String(b.supplierAccountPrefix??"");
  if(!/^[0-9]{4}$/.test(customer)||!/^[0-9]{4}$/.test(supplier))throw new Error("Each prefix must contain exactly 4 digits.");
  const statements:D1PreparedStatement[]=[];
  for(const [code,label,key] of [[customer,"Customer control group","customerGroupName"],[supplier,"Supplier control group","supplierGroupName"]]){
   const found=await db.prepare("SELECT id FROM accounts WHERE company_code=? AND account_number=?").bind(company,code).first();
   if(!found){if(!b.createGroups)throw new Error(`Group ${code} does not exist. Select Create missing groups or create it in the chart of accounts.`);
    const name=String(b[key]??label).trim();if(!name||name.length>200)throw new Error("Enter a group description of up to 200 characters.");
    statements.push(db.prepare("INSERT INTO accounts(company_code,account_number,name,account_type,currency,active) VALUES(?,?,?,'other',?,1) ON CONFLICT(company_code,account_number) DO NOTHING").bind(company,code,name,settings.defaultCurrency));
   }
  }
  const guard=accountAssertion(db,"EXISTS(SELECT 1 FROM accounts WHERE company_code=? AND account_number=?) AND EXISTS(SELECT 1 FROM accounts WHERE company_code=? AND account_number=?)",[company,customer,company,supplier]);
  statements.push(guard.check,db.prepare("INSERT INTO workshop_settings(company_code,customer_account_prefix,supplier_account_prefix) VALUES(?,?,?) ON CONFLICT(company_code) DO UPDATE SET customer_account_prefix=excluded.customer_account_prefix,supplier_account_prefix=excluded.supplier_account_prefix").bind(company,customer,supplier),guard.clear);
  await db.batch(statements);return Response.json({settings:await getWorkshopSettings(company,db)});
 }catch(e){return Response.json({error:e instanceof Error?e.message:String(e)},{status:400})}
}
