export type ItemUnit={code:string;factor:number};
export type ItemBarcode={code:string;unit:string;primary:boolean};
export type ItemSupplier={supplierId:number;itemCode:string;unit:string;isDefault:boolean};
export type ItemMaster={active:boolean;group:string;subgroup:string;units:ItemUnit[];baseUnit:string;salesUnit:string;purchaseUnit:string;barcodes:ItemBarcode[];itemSuppliers:ItemSupplier[];masterRevision:number};
export const defaultMaster=():ItemMaster=>({active:true,group:'',subgroup:'',units:[{code:'unit',factor:1}],baseUnit:'unit',salesUnit:'unit',purchaseUnit:'unit',barcodes:[],itemSuppliers:[],masterRevision:0});
export function validateMaster(value:ItemMaster){
 if(!Array.isArray(value.units)||!value.units.length||value.units.length>50)throw new Error('Add between 1 and 50 units.');
 if(value.units.some(u=>!u.code.trim()||u.code!==u.code.trim()||u.code.length>30||!Number.isFinite(u.factor)||u.factor<=0||u.factor>1e9)||new Set(value.units.map(u=>u.code.toLowerCase())).size!==value.units.length)throw new Error('Unit names must be unique and conversion factors must be positive.');
 const codes=new Set(value.units.map(u=>u.code));
 if(!codes.has(value.baseUnit)||!codes.has(value.salesUnit)||!codes.has(value.purchaseUnit)||value.units.find(u=>u.code===value.baseUnit)?.factor!==1)throw new Error('Choose a base unit with factor 1 and default sales and purchase units.');
 if(value.barcodes.length>100||value.barcodes.some(b=>!b.code.trim()||b.code!==b.code.trim()||b.code.length>100||!codes.has(b.unit))||new Set(value.barcodes.map(b=>b.code.toLowerCase())).size!==value.barcodes.length)throw new Error('Barcodes must be unique and linked to an item unit.');
 if(value.barcodes.length&&value.barcodes.filter(b=>b.primary).length!==1)throw new Error('Choose exactly one primary barcode.');
 if(value.itemSuppliers.length>100||value.itemSuppliers.some(s=>!Number.isSafeInteger(s.supplierId)||s.supplierId<1||!codes.has(s.unit)||s.itemCode.length>100)||new Set(value.itemSuppliers.map(s=>s.supplierId)).size!==value.itemSuppliers.length)throw new Error('Select each supplier once with a valid purchase unit.');
 if(value.itemSuppliers.length&&value.itemSuppliers.filter(s=>s.isDefault).length!==1)throw new Error('Choose exactly one default supplier.');
 return value;
}
export function stockQuantity(quantity:number,factor:number){const result=quantity*factor;if(!Number.isFinite(result)||Math.abs(result)>1e12)throw new Error('Converted stock quantity is too large.');return Math.round(result*1e9)/1e9;}
