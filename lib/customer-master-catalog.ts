export const customerMasterCategories = [
  {key:"customer_type",label:"Customer types",singular:"customer type",defaults:[["company","Company"],["individual","Individual"],["government","Government"]]},
  {key:"customer_group",label:"Customer groups",singular:"customer group",defaults:[["retail","Retail"],["fleet","Fleet"],["wholesale","Wholesale"],["insurance","Insurance"],["other","Other"]]},
  {key:"territory",label:"Territories",singular:"territory",defaults:[["beirut","Beirut"],["keserwan","Keserwan"],["north","North"],["south","South"]]},
  {key:"payment_terms",label:"Payment terms",singular:"payment term",defaults:[["cash","Cash"],["15_days","15 days"],["30_days","30 days"],["60_days","60 days"]]},
  {key:"payment_method",label:"Payment methods",singular:"payment method",defaults:[["bank_transfer","Bank transfer"],["cash","Cash"],["cheque","Cheque"],["card","Card"]]},
  {key:"preferred_language",label:"Languages",singular:"language",defaults:[["English","English"],["Arabic","Arabic"],["French","French"]]},
  {key:"country",label:"Countries",singular:"country",defaults:[["Lebanon","Lebanon"]]},
  {key:"tax_registration_status",label:"Tax registration statuses",singular:"tax registration status",defaults:[["vat_registered","VAT registered"],["not_registered","Not registered"]]},
  {key:"statement_delivery",label:"Statement delivery methods",singular:"statement delivery method",defaults:[["email_monthly","Email monthly"],["on_request","Email on request"],["printed","Printed"],["none","Do not send"]]},
  {key:"acquisition_source",label:"Acquisition sources",singular:"acquisition source",defaults:[["referral","Referral"],["walk_in","Walk-in"],["website","Website"],["campaign","Campaign"],["other","Other"]]},
] as const;

export type CustomerMasterCategory=typeof customerMasterCategories[number]["key"];
export type CustomerMasterValue={id:number;category:CustomerMasterCategory;code:string;name:string;active:boolean;sortOrder:number};
export const customerMasterCategoryKeys=new Set<string>(customerMasterCategories.map(category=>category.key));
export const customerMasterCategory=(key:string)=>customerMasterCategories.find(category=>category.key===key);
