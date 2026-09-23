export function values(body:Record<string,unknown>){
 const code=String(body.code??"").trim().toUpperCase(),name=String(body.name??"").trim(),phone=String(body.phone??"").trim(),email=String(body.email??"").trim(),notes=String(body.notes??"").trim(),active=body.active===undefined||body.active===true||body.active===1;
 if(!code||code.length>40||!/^[A-Z0-9][A-Z0-9._-]*$/.test(code))throw new Error("Enter a salesman code using letters, numbers, dots, dashes or underscores.");
 if(!name||name.length>200)throw new Error("Enter a salesman name of 200 characters or fewer.");
 if(phone.length>100||email.length>320||notes.length>2000)throw new Error("Salesman details are too long.");
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error("Enter a valid email address.");
 return{code,name,phone,email,notes,active};
}
