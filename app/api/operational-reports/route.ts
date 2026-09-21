import {requireUser} from '../../../db/auth';
import {getWorkshopSettings} from '../../../db/settings';
import {loadReportData} from '../../../db/operational-reports';
import {buildOperationalReport} from '../../../lib/operational-report-data';
import {definitions,validateFilters,type Filters} from '../../../lib/operational-reports';

export async function POST(request:Request){
 const auth=await requireUser(request);if(auth instanceof Response)return auth;
 let id:string,f:Filters;
 try{const body=await request.json() as {id:string;filters:Filters};id=body.id;f=body.filters;if(!Object.hasOwn(definitions,id))throw Error('Select a valid report.');if(!f||typeof f.search!=='string'||f.search.length>200||!f.selections||typeof f.selections!=='object')throw Error('Invalid report filters.');for(const [k,v] of Object.entries(f.selections)){if(!definitions[id].filters.includes(k)||!Array.isArray(v)||v.length>1000||v.some(x=>typeof x!=='string'||x.length>2000))throw Error('Invalid report selection.');}validateFilters(f);}catch(e){return Response.json({error:(e as Error).message},{status:400})}
 try{const company=auth.companyCode.toLowerCase();const [source,settings]=await Promise.all([loadReportData(company),getWorkshopSettings(company)]);const report=buildOperationalReport(id,source,f,settings.defaultCurrency);return Response.json({...report,id,title:definitions[id].title,companyName:settings.companyName,generatedAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}})}catch(e){console.error(e);return Response.json({error:'Could not prepare the complete report. Try again; no partial results have been shown.'},{status:500})}
}
