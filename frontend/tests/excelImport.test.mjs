import test from 'node:test';
import assert from 'node:assert/strict';
import { annualLayout, monthMap, bestPayrollSheet, buildImportedRows, amount, calculatedNet, readAnnualLeaveRows } from '../src/app/payroll/excelImport.mjs';

const months=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const monthlyLabels=['الرواتب','الإضافي','حافز','خصومات','الإجمالي'];
function exampleAnnual() {
 const headings=['م','بصمة','الأسم',...months.flatMap(m=>[m,'','','','']), 'إجمالي الخصومات','بدل إجازة','الإجمالي المستلم'];
 const subhead=['','','',...months.flatMap(()=>monthlyLabels)];
 const jan=[2100,378,200,0,2678];
 const feb=[2100,380,167,420,2227];
 const empty=[0,0,0,0,0];
 return [['كشف الرواتب لعام 2025'],headings,subhead,[1,9,'عامل تجريبي',...jan,...feb,...Array.from({length:10},()=>empty).flat(),0,2200,0], [2,20,'عامل جديد',...Array.from({length:11},()=>empty).flat(),2200,100,0,0,2300,0,0,0], [3,30,'عامل غير نشط',...Array.from({length:12},()=>empty).flat(),0,0,0]];
}
test('detect annual headers and month boundaries',()=>{
 const grid=exampleAnnual(),layout=annualLayout(grid);
 assert.ok(layout);
 assert.equal(layout.nameCol,'2');assert.equal(layout.codeCol,'1');
 assert.equal(layout.marks.length,12);
 for(let i=1;i<=12;i++){
  const info=monthMap({name:'2025final',grid},`2025-${String(i).padStart(2,'0')}`);
  assert.equal(info.mapping.base_salary,String(3+5*(i-1)));
  assert.equal(info.mapping.net_salary,String(7+5*(i-1)));
  assert.equal(info.mapping.employee_name,'2');
  assert.equal(info.workbookYear,'2025');
 }
});
test('import only selected monthly salary figures, skip all-zero months',()=>{
 const grid=exampleAnnual();
 const jan=monthMap({name:'2025final',grid},'2025-01');
 const first=buildImportedRows(grid,jan.headerIndex,jan.mapping);
 assert.equal(first.rows.length,1);assert.equal(first.rows[0].employee_code,'9');assert.equal(first.rows[0].net_salary,'2678');
 assert.equal(calculatedNet(first.rows[0]),2678);
 const feb=monthMap({name:'2025final',grid},'2025-02');
 assert.equal(buildImportedRows(grid,feb.headerIndex,feb.mapping).rows[0].net_salary,'2227');
 const dec=monthMap({name:'2025final',grid},'2025-12');
 assert.equal(buildImportedRows(grid,dec.headerIndex,dec.mapping).rows.length,1);
});
test('ordinary one-month files with بصمة + الراتب + حافز',()=>{
 const grid=[['بصمة','الاسم','الراتب','الإضافي','حافز','خصومات','الإجمالي'], ['44','أحمد',2000,300,100,50,2350]];
 const info=monthMap({name:'رواتب',grid},'2026-11');
 assert.equal(info.isAnnual,false);
 const {rows}=buildImportedRows(grid,info.headerIndex,info.mapping);
 assert.equal(rows.length,1);assert.equal(rows[0].net_salary,'2350');
 assert.equal(calculatedNet(rows[0]),2350);
});
test('select final annual tab; parse Arabic numbers',()=>{
 const grid=exampleAnnual();
 assert.equal(bestPayrollSheet([{name:'2023',grid:[['test']]},{name:'2025ف',grid},{name:'2025final',grid}]),2);
 assert.equal(amount('٢٬١٠٠'),NaN); // unsupported separator must not silently change totals
 assert.equal(amount('٢١٠٠'),2100);
});

test('read annual leave exactly once after December, not total received',()=>{
 const grid=exampleAnnual();
 const p=readAnnualLeaveRows({name:'2025final',grid});
 assert.equal(p.year,'2025');
 assert.equal(p.rows.length,1);
 assert.equal(p.rows[0].employee_key,'CODE:9');
 assert.equal(p.rows[0].amount,2200);
 assert.equal(p.rows[0].employee_name,'عامل تجريبي');
 const malformed=exampleAnnual();
 malformed[3][64]='invalid'; // annual leave column: 3+12*5+1=64
 assert.throws(()=>readAnnualLeaveRows({name:'2025final',grid:malformed}),/غير صحيح/);
});
