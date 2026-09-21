import {requireUser} from '../../../../db/auth';
export async function POST(request:Request){const auth=await requireUser(request);if(auth instanceof Response)return auth;return Response.json({error:'Legacy credits remain viewable. Create a quantity-based Sales Return instead.'},{status:410})}
