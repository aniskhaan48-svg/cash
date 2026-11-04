// Dependency-free unit tests for the payroll API validation and reporting flow.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const originalLoad = Module._load;
const routeHandlers = {};
const existing = new Map();
let nextId = 1n;
const history = [];
const leaves = new Map();
let nextLeaveId = 500n;
let mockPrismaInjected = false;
const prisma = {
  payroll_months: {
    findUnique: async ({ where }) => existing.get(where.month_key) || [...existing.values()].find(m => m.id === where.id) || null,
    findMany: async ({ where = {}, orderBy }) => [...existing.values()].filter(m => !where.month_key || m.month_key.startsWith(where.month_key.startsWith)).sort((a,b) => a.month_key.localeCompare(b.month_key)).reverse(),
    create: async ({ data }) => { const result = { id: nextId++, ...data, rows: [], updated_at: new Date() }; existing.set(result.month_key, result); return result; },
    update: async ({ where, data }) => { const target=[...existing.values()].find(x => x.id === where.id); Object.assign(target,data); return target; },
  },
  payroll_rows: {
    createMany: async ({ data }) => { data.forEach((r,i) => {const batch=[...existing.values()].find(m=>m.id===r.month_id);batch.rows.push({...r,id:BigInt(i+1)});}); },
    deleteMany: async ({ where }) => {const batch=[...existing.values()].find(m=>m.id===where.month_id);batch.rows=[];},
  },
  payroll_leave_allowances: {
    findMany: async ({ where }) => [...leaves.values()].filter(x=>x.year_key===where.year_key),
    createMany: async ({ data }) => {
      let count=0;
      for (const row of data) {
        const key=`${row.year_key}:${row.employee_key}`;
        if (!leaves.has(key)) { leaves.set(key,{id:nextLeaveId++,...row});count++; }
      }
      return {count};
    },
    findUnique: async ({ where }) => leaves.get(`${where.year_key_employee_key.year_key}:${where.year_key_employee_key.employee_key}`) || null,
    upsert: async ({ where, create, update }) => {
      const key=`${where.year_key_employee_key.year_key}:${where.year_key_employee_key.employee_key}`;
      const item=leaves.get(key);
      const result=item ? Object.assign(item,update) : {id:nextLeaveId++,...create};
      leaves.set(key,result);
      return result;
    },
  },
  audit_logs: { create: async ({ data }) => history.push(data) },
  $transaction: async callback => callback(prisma),
};
Module._load = function(request, parent, isMain) {
  if (request === "express") return { Router: () => ({ get: (path, fn) => routeHandlers[`GET ${path}`] = fn, post: (path, fn) => routeHandlers[`POST ${path}`] = fn, put: (path, fn) => routeHandlers[`PUT ${path}`] = fn }) };
  if (request === "../config/prisma" && parent?.filename?.replace(/\\/g, "/").endsWith("/src/routes/payroll.js")) {
    mockPrismaInjected = true;
    return prisma;
  }
  return originalLoad.apply(this, arguments);
};
const { _private } = require("../src/routes/payroll");
Module._load = originalLoad;
assert.ok(mockPrismaInjected, "Payroll tests must use the mock database, never the real DATABASE_URL");
async function request(method, path, { body = {}, params = {}, query = {}, role = "CEO" } = {}) {
  const res={ code: 200, status(code){this.code=code;return this},json(body){this.body=body;return this;} };
  await routeHandlers[`${method} ${path}`]({ body,params,query,user:{id:1,role} },res);
  return res;
}
const exampleRows=[
  {employee_code:"100",employee_name:"أحمد",base_salary:3000,overtime:200,allowances:150,deductions:100,advances:250,net_salary:3000},
  {employee_code:"101",employee_name:"سعيد",base_salary:4000,overtime:100,allowances:0,deductions:0,advances:0,net_salary:4100},
];
test("Salary validation, monthly and annual aggregation, duplicate protection and revisions", async () => {
  assert.equal(_private.parseRows(exampleRows)[0].net_salary, "3000.00");
  assert.throws(() => _private.parseRows([exampleRows[0],exampleRows[0]]), /مكرر/);
  assert.throws(() => _private.parseRows([{employee_name:"A",base_salary:"abc"}]), /قيمة غير صحيحة/);
  assert.throws(() => _private.parseRows([null]), /السطر/);
  assert.equal(_private.parseRows([{employee_name:"X",deductions:50,net_salary:100}])[0].net_salary,"100.00");
  const created = await request("POST", "/months", { body:{ month:"2026-09",rows:exampleRows,file_name:"salaries.xlsx" } });
  assert.equal(created.code,201, JSON.stringify(created.body)); assert.equal(created.body.count,2);
  const invalid = await request("POST", "/months", { body: { month: "2026-07", rows: [{ employee_name: "X", base_salary: "abc" }] } });
  assert.equal(invalid.code, 400);
  assert.equal(existing.has("2026-07"), false);
  const dup = await request("POST", "/months", { body:{ month:"2026-09",rows:exampleRows } });
  assert.equal(dup.code,409);
  const view = await request("GET","/months/:month",{ params:{ month:"2026-09" } });
  assert.equal(view.body.totals.net_salary,7100);
  const denied = await request("POST","/months",{ body:{ month:"2026-08", rows:exampleRows },role:"ACCOUNTANT" });
  assert.equal(denied.code,403);
  const saveAug = await request("POST", "/months", {body:{ month:"2026-08", rows:[exampleRows[0]] }});
  assert.equal(saveAug.code,201);
  const annual = await request("GET", "/annual", {query:{year:"2026"}});
  assert.equal(annual.body.summary.net_salary,10100);
  assert.equal(annual.body.summary.employees_count,2);
  assert.equal(annual.body.employees.find(x=>x.employee_code==="100").net_total,6000);
  const noConfirm=await request("PUT","/months/:month", {params:{month:"2026-09"},body:{rows:[exampleRows[1]]}});
  assert.equal(noConfirm.code,400);
  const replaced=await request("PUT","/months/:month", {params:{month:"2026-09"},body:{rows:[exampleRows[1]],confirm_replace:true}});
  assert.equal(replaced.code,200);
  assert.equal(history.length,1);
  assert.equal(history[0].old_values.rows.length,2);
  const view2 = await request("GET","/months/:month",{params:{month:"2026-09"}});
  assert.equal(view2.body.totals.net_salary,4100);
});

test("Annual leave amounts: manual edits, import skips existing, audit and annual sums", async()=>{
  const before=await request("GET","/annual",{query:{year:"2026"}});
  const wage=before.body.employees.find(x=>x.employee_code==="100");
  assert.ok(wage);
  assert.equal(wage.net_total,3000);
  assert.equal(wage.leave_allowance,0);
  const saved=await request("POST","/annual/leave-allowances",{body:{year:"2026",mode:"import",source_file:"2026.xlsx",rows:[{employee_key:"CODE:100",amount:2200}]}});
  assert.equal(saved.code,200, JSON.stringify(saved.body));
  assert.equal(saved.body.saved,1);
  const after=await request("GET","/annual",{query:{year:"2026"}});
  assert.equal(after.body.employees.find(x=>x.employee_code==="100").received_total,5200);
  assert.equal(after.body.summary.leave_allowances_total,2200);
  assert.equal(after.body.summary.received_total,after.body.summary.net_salary+2200);
  const duplicate=await request("POST","/annual/leave-allowances",{body:{year:"2026",mode:"import",rows:[{employee_key:"CODE:100",amount:4000}]}});
  assert.equal(duplicate.body.saved,0);
  assert.equal(duplicate.body.skipped,1);
  const edited=await request("POST","/annual/leave-allowances",{body:{year:"2026",mode:"manual",rows:[{employee_key:"CODE:100",amount:2300}]}});
  assert.equal(edited.body.saved,1);
  assert.equal((await request("GET","/annual",{query:{year:"2026"}})).body.employees.find(x=>x.employee_code==="100").received_total,5300);
  assert.equal((await request("POST","/annual/leave-allowances",{role:"ACCOUNTANT",body:{year:"2026",mode:"manual",rows:[{employee_key:"CODE:100",amount:0}]}})).code,403);
  assert.equal((await request("POST","/annual/leave-allowances",{body:{year:"2026",mode:"manual",rows:[{employee_key:"CODE:UNKNOWN",amount:5}]}})).code,400);
  assert.equal((await request("POST","/annual/leave-allowances",{body:{year:"2026",mode:"manual",rows:[{employee_key:"CODE:100",amount:"xxx"}]}})).code,400);
  assert.equal((await request("POST","/annual/leave-allowances",{body:{year:"2026",mode:"import",rows:[{employee_key:"CODE:100",amount:1},{employee_key:"CODE:100",amount:2}]}})).code,400);
  assert.equal(history.filter(x=>x.action?.startsWith("PAYROLL_LEAVE")).length,2);
  const summary=(await request("GET","/annual",{query:{year:"2026"}})).body.summary;
  assert.equal(summary.net_salary,7100);
  assert.equal(summary.received_total,9400);
  const editedZero=await request("POST","/annual/leave-allowances",{body:{year:"2026",mode:"manual",rows:[{employee_key:"CODE:100",amount:0}]}});
  assert.equal(editedZero.code,200);
  const zero=(await request("GET","/annual",{query:{year:"2026"}})).body;
  assert.equal(zero.summary.leave_allowances_total,0);
  assert.equal(zero.summary.received_total,7100);
});
