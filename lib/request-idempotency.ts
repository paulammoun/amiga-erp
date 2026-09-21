export function requestKey(value:unknown){
  const key=String(value??"").trim();
  if(!/^[A-Za-z0-9._:-]{8,100}$/.test(key))throw new Error("Refresh the page and try saving again.");
  return key;
}

function canonical(value:unknown):string{
  if(value===null||typeof value!=="object")return JSON.stringify(value);
  if(Array.isArray(value))return "["+value.map(canonical).join(",")+"]";
  const record=value as Record<string,unknown>;
  return "{"+Object.keys(record).sort().map(key=>JSON.stringify(key)+":"+canonical(record[key])).join(",")+"}";
}

export async function requestHash(value:unknown){
  const bytes=new TextEncoder().encode(canonical(value));
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("");
}
