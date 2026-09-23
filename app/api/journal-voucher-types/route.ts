import {getRawDb} from '../../../db';
import {requireUser} from '../../../db/auth';
const columns='id,description,prefix,active';
export async function GET(request:Request){const auth=await requireUser(request);if(auth instanceof Response)return auth;try{const rows=await getRawDb().prepare(`SELECT ${columns} FROM journal_voucher_types WHERE company_code=? ORDER BY description,prefix`).bind(auth.companyCode.toLowerCase()).all();return Response.json({types:rows.results})}catch(error){console.error(error);return Response.json({error:'Could not load journal voucher types.'},{status:500})}}
async function save(request:Request){const auth=await requireUser(request);if(auth instanceof Response)return auth;try{
 const body=await request.json() as Record<string,unknown>,description=String(body.description??'').trim(),prefix=String(body.prefix??'').trim().toUpperCase(),active=body.active===false||body.active===0?0:1,company=auth.companyCode.toLowerCase(),db=getRawDb();
 if(!description||description.length>200)throw new Error('Enter a description of up to 200 characters.');
 if(!/^[A-Z0-9-]{3}$/.test(prefix))throw new Error('The prefix must contain exactly 3 letters, digits, or hyphens.');
 if(request.method==='POST'){const type=await db.prepare(`INSERT INTO journal_voucher_types(company_code,description,prefix,active) VALUES(?,?,?,?) RETURNING ${columns}`).bind(company,description,prefix,active).first();return Response.json({type},{status:201})}
 const id=Number(body.id);if(!Number.isSafeInteger(id)||id<1)throw new Error('Invalid voucher type.');
 const old=await db.prepare('SELECT prefix FROM journal_voucher_types WHERE id=? AND company_code=?').bind(id,company).first<{prefix:string}>();if(!old)return Response.json({error:'Voucher type not found.'},{status:404});
 if(old.prefix!==prefix)throw new Error('Prefixes cannot change. Create a new type for a different numbering series.');
 const type=await db.prepare(`UPDATE journal_voucher_types SET description=?,active=? WHERE id=? AND company_code=? RETURNING ${columns}`).bind(description,active,id,company).first();return Response.json({type});
 }catch(error){const message=error instanceof Error?error.message:String(error);return Response.json({error:/UNIQUE/.test(message)?'This prefix already exists in your company.':message},{status:400})}}
export const POST=save;export const PUT=save;