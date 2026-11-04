// CashBox Cloud - Excel layouts shared by payroll import and local tests.
// Handles both ordinary single-month files and annual matrices with two header rows.
export const AR_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const norm = v => String(v ?? "").toLowerCase().replace(/[\s\u0640\-_()\/\\.]+/g, "").replace(/[أإآٱ]/g,"ا").replace(/ة/g,"ه").replace(/[ًٌٍَُِّْ]/g,"");
const aliases = {
 employee_code: ["بصمه","رقمالبصمه","رقمالعامل","رقمالموظف","الرقمالوظيفي","employeeid","empid","staffid","idno"],
 employee_name: ["الاسم","اسمالعامل","اسمالموظف","الاسمالكامل","employeename","staffname","name"],
 base_salary: ["الرواتب","الراتب","الراتبالاساسي","الراتبالشهري","basic","basicsalary","salary"],
 overtime: ["الاضافي","اضافي","ساعاتاضافيه","قيمهالاضافي","overtime","otamount","ot"],
 allowances: ["بدلات","البدلات","بدل","allowances","allowance"],
 bonuses: ["حافز","حوافز","حافزبدلات","مكافات","المكافات","مكافاه","bonus","bonuses","incentive"],
 deductions: ["الخصومات","خصومات","الاستقطاعات","خصم","deduction","deductions"],
 advances: ["السلف","سلف","السلفيات","advance","advances","loan"],
 net_salary: ["الاجمالي","صافي","الصافي","صافيالراتب","صافىالراتب","الصافيلمستحق","المستحق","netsalary","net","netpay","totalpay"],
 notes: ["ملاحظات","البيان","notes","remarks"]
};
export const PAYROLL_FIELDS = ["employee_code","employee_name","base_salary","overtime","allowances","bonuses","deductions","advances","net_salary","notes"];
export const CORE_FIELDS = ["employee_code","employee_name","base_salary","overtime","bonuses","deductions","net_salary"];
export function autoMap(grid, index) {
 const row=grid[index]||[];
 return Object.fromEntries(PAYROLL_FIELDS.map(k=>[k,findColumn(row,k)]));
}
function findColumn(row,key,start=0,end=row.length) {
 const opts=(aliases[key]||[]).map(norm);
 const pos=row.findIndex((v,i)=>i>=start && i<end && opts.includes(norm(v)));
 return pos<0?"":String(pos);
}
export function pickHeader(grid) {
 let best=0,score=-1;
 grid.slice(0,Math.min(25,grid.length)).forEach((row,i)=>{
  const m=autoMap(grid,i);
  const count=Object.values(m).filter(v=>v!=="").length;
  const weighted=count+(m.employee_name!==""?3:0)+(m.base_salary!==""?1:0);
  if(weighted>score){score=weighted;best=i;}
 });
 return best;
}
export function annualLayout(grid) {
 let best=null;
 grid.slice(0,Math.min(24,grid.length)).forEach((row,i)=>{
  const marks=[];
  row.forEach((cell,col)=>{const month=AR_MONTHS.findIndex(m=>norm(m)===norm(cell));if(month>=0)marks.push({month,col});});
  const nameCol=findColumn(row,"employee_name");
  if(marks.length<6||nameCol==="")return;
  const codeCol=findColumn(row,"employee_code");
  const sub=i+1;
  if(sub>=grid.length)return;
  const subrow=grid[sub]||[];
  const first=marks[0],second=marks[1];
  const check=["base_salary","overtime","bonuses","deductions","net_salary"].filter(k=>findColumn(subrow,k,first.col,second.col)!=="").length;
  if(check<3)return;
  const score=marks.length*10+check;
  if(!best||score>best.score)best={monthRow:i,headerRow:sub,nameCol,codeCol,marks,score};
 });
 return best;
}
export function sheetYear(sheet) {
 const s=String(sheet?.name||"")+" "+String(sheet?.grid?.[0]?.[0]||"");
 const years=s.match(/20\d{2}/g)||[];
 return years.length ? years[0] : "";
}
export function monthMap(sheet, month) {
 const grid=sheet?.grid||[];
 const layout=annualLayout(grid);
 if(layout) {
  const want=Number(String(month||"").slice(5,7))-1;
  const idx=layout.marks.findIndex(m=>m.month===want);
  if(idx<0)throw new Error("الشهر المحدد غير موجود في ورقة Excel");
  const start=layout.marks[idx].col;
  const end=layout.marks[idx+1]?.col??(grid[layout.headerRow]?.length||start+5);
  const subrow=grid[layout.headerRow]||[];
  const mapping=Object.fromEntries(PAYROLL_FIELDS.map(k=>[k,""]));
  mapping.employee_name=layout.nameCol;
  mapping.employee_code=layout.codeCol;
  ["base_salary","overtime","bonuses","deductions","net_salary"].forEach(k=>{
   mapping[k]=findColumn(subrow,k,start,end);
  });
  if(mapping.base_salary===""||mapping.net_salary==="")throw new Error("لم يتم العثور على أعمدة الرواتب والإجمالي ضمن الشهر المطلوب");
  return {mapping,headerIndex:layout.headerRow,isAnnual:true,workbookYear:sheetYear(sheet)};
 }
 const headerIndex=pickHeader(grid);
 return {mapping:autoMap(grid,headerIndex),headerIndex,isAnnual:false,workbookYear:sheetYear(sheet)};
}
export function bestPayrollSheet(sheets) {
 let best=0,score=-1;
 sheets.forEach((s,i)=>{
  const layout=annualLayout(s.grid);
  const normal=autoMap(s.grid,pickHeader(s.grid));
  const sname=norm(s.name);
  const points=layout?100+layout.marks.length*10: Object.values(normal).filter(x=>x!=="").length;
  const finalBoost=/final|نهائي/.test(sname)?50:0;
  const value=points+finalBoost;
  if(value>score){score=value;best=i;}
 });
 return best;
}
const digitize=v=>String(v??"").replace(/[٠-٩]/g,c=>String("٠١٢٣٤٥٦٧٨٩".indexOf(c))).replace(/[۰-۹]/g,c=>String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)));
export function cleanAmount(raw) {
 if(raw==null||raw==="")return "";
 if(typeof raw==="number")return String(raw);
 const s=digitize(raw).trim().replace(/[\s\u00a0]|ر\.?س\.?|SAR|﷼/gi,"");
 if(!s||s==="-")return "";
 if(s.includes(",")&&!s.includes("."))return s.replace(/,(?=\d{3}(?:,|$))/g,"").replace(",",".");
 return s.replace(/,/g,"");
}
export function amount(value) {
 if(value===""||value==null)return 0;
 const v=cleanAmount(value);
 return /^\d{1,12}(?:\.\d{1,2})?$/.test(v)?Number(v):NaN;
}
export function calculatedNet(r) {
 return ["base_salary","overtime","allowances","bonuses"].reduce((s,k)=>s+amount(r[k]),0)
 - ["deductions","advances"].reduce((s,k)=>s+amount(r[k]),0);
}
const nameIsValid=v=>{
 const n=norm(v);
 return !!n&&!["الاسم","اسمالعامل","الاجمالي","المجموع","total","grandtotal","sum","مراجعه"].includes(n);
};
export function buildImportedRows(grid,headerIndex,mapping) {
 if(mapping.employee_name==="")throw new Error("لم يتم التعرف على عمود اسم العامل");
 if(mapping.base_salary===""&&mapping.net_salary==="")throw new Error("لم يتم التعرف على عمود الراتب أو الإجمالي");
 const rows=[];let emptyRows=0;
 for(const cells of grid.slice(headerIndex+1)){
  const r=Object.fromEntries(PAYROLL_FIELDS.map(k=>[k,mapping[k]===""?"":String(cells[Number(mapping[k])]??"").trim()]));
  if(!nameIsValid(r.employee_name)||norm(r.employee_code)==="بصمه")continue;
  for(const k of ["base_salary","overtime","allowances","bonuses","deductions","advances","net_salary"])r[k]=cleanAmount(r[k]);
  if(r.net_salary==="")r.net_salary=String(Math.round(calculatedNet(r)*100)/100);
  // Files often repeat an inactive worker with all-zero monthly earnings.
  // Exclude such rows to avoid false duplicate-fingerprint errors.
  const values=["base_salary","overtime","allowances","bonuses","deductions","advances","net_salary"].map(k=>amount(r[k]));
  if(values.every(v=>v===0)){emptyRows++;continue;}
  rows.push(r);
 }
 return {rows,emptyRows};
}

// Read the one annual leave column after December, without importing the
// workbook's total-received field as an additional payment.
export function readAnnualLeaveRows(sheet) {
 const grid=sheet?.grid||[];
 const layout=annualLayout(grid);
 if(!layout)throw new Error("لم يتم العثور على كشف سنوي يحتوي أشهر يناير إلى ديسمبر");
 const header=grid[layout.monthRow]||[];
 const lastMonth=layout.marks[layout.marks.length-1].col;
 const leaveCol=header.findIndex((v,i)=>i>lastMonth && ["بدلاجازه","بدلاجازة","بدلالاجازه","بدلالاجازة","بدلاجازات","بدلالاجازات","leaveallowance","leavepay"].includes(norm(v)));
 if(leaveCol<0)throw new Error("لم يتم العثور على عمود بدل إجازة بعد ديسمبر في ملف Excel");
 const rows=[];let ignored=0;
 const seen=new Set();
 for(const cells of grid.slice(layout.headerRow+1)){
  const employee_name=String(cells[Number(layout.nameCol)]??"").trim();
  const employee_code=layout.codeCol===""?"":String(cells[Number(layout.codeCol)]??"").trim();
  if(!nameIsValid(employee_name))continue;
  const raw=cells[leaveCol];
  if(raw==null||String(raw).trim()==="")continue;
  const value=amount(raw);
  if(!Number.isFinite(value)||value<0)throw new Error(`بدل إجازة غير صحيح للعامل ${employee_name}`);
  if(value===0){ignored++;continue;}
  const employee_key=employee_code?`CODE:${employee_code.toUpperCase()}`:`NAME:${employee_name.replace(/\s+/g," ").toLocaleLowerCase()}`;
  if(seen.has(employee_key))throw new Error(`تكرر رقم بصمة العامل ${employee_name} في كشف بدل الإجازة`);
  seen.add(employee_key);
  rows.push({employee_key,employee_code,employee_name,amount:Math.round(value*100)/100});
 }
 return {rows,ignored,year:sheetYear(sheet)};
}
