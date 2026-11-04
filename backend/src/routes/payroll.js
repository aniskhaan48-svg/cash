const express = require("express");
const prisma = require("../config/prisma");
const router = express.Router();

const MONTH_RE = /^(20\d{2})-(0[1-9]|1[0-2])$/;
const YEAR_RE = /^20\d{2}$/;
const MONEY_FIELDS = ["base_salary", "overtime", "allowances", "bonuses", "deductions", "advances", "net_salary"];

function cents(value, label) {
  if (value === "" || value == null) return 0;
  const str = String(value).trim();
  if (!/^-?\d{1,12}(?:\.\d{1,2})?$/.test(str)) throw new Error(`قيمة غير صحيحة في ${label}`);
  const amount = Math.round(Number(str) * 100);
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error(`المبلغ يجب أن يكون رقمًا موجبًا في ${label}`);
  return amount;
}

function parseRows(input) {
  if (!Array.isArray(input) || !input.length || input.length > 500) {
    throw new Error("يجب إرسال من 1 إلى 500 عامل في الشهر الواحد");
  }
  const seen = new Set();
  return input.map((row, i) => {
    const line = i + 1;
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(`بيانات العامل غير صحيحة في السطر ${line}`);
    const employee_name = String(row.employee_name || "").trim().replace(/\s+/g, " ").slice(0, 255);
    const employee_code = String(row.employee_code || "").trim().slice(0, 100) || null;
    if (!employee_name) throw new Error(`اسم العامل مطلوب في السطر ${line}`);
    const employee_key = employee_code ? `CODE:${employee_code.toUpperCase()}` : `NAME:${employee_name.toLocaleLowerCase()}`;
    if (seen.has(employee_key)) throw new Error(`العامل مكرر في الملف: ${employee_name} (السطر ${line})`);
    seen.add(employee_key);
    const amounts = Object.fromEntries(MONEY_FIELDS.map(f => [f, cents(row[f], `${f} - السطر ${line}`)]));
    const calculated = amounts.base_salary + amounts.overtime + amounts.allowances + amounts.bonuses - amounts.deductions - amounts.advances;
    if (calculated < 0 && (row.net_salary === "" || row.net_salary == null)) throw new Error(`صافي الراتب المحسوب سالب في السطر ${line}`);
    // Salary files may include a separately calculated net pay amount. Preserve it
    // instead of silently overwriting the number supplied by the accountant.
    const net = row.net_salary === "" || row.net_salary == null ? calculated : amounts.net_salary;
    return {
      employee_key, employee_code, employee_name,
      ...Object.fromEntries(MONEY_FIELDS.filter(f => f !== "net_salary").map(f => [f, (amounts[f] / 100).toFixed(2)])),
      net_salary: (net / 100).toFixed(2),
      notes: String(row.notes || "").trim().slice(0, 500) || null,
    };
  });
}

function publicRow(row) {
  return {
    id: String(row.id),
    employee_code: row.employee_code || "",
    employee_name: row.employee_name,
    employee_key: row.employee_key,
    ...Object.fromEntries(MONEY_FIELDS.map(k => [k, Number(row[k] || 0)])),
    notes: row.notes || "",
  };
}

function totals(rows) {
  return {
    count: rows.length,
    ...Object.fromEntries(MONEY_FIELDS.map(k => [k, Math.round(rows.reduce((sum, row) => sum + Number(row[k] || 0) * 100, 0)) / 100])),
  };
}

router.get("/months", async (req, res) => {
  try {
    const year = String(req.query.year || "");
    if (year && !YEAR_RE.test(year)) return res.status(400).json({ message: "السنة غير صحيحة" });
    const months = await prisma.payroll_months.findMany({
      where: year ? { month_key: { startsWith: `${year}-` } } : {},
      include: { rows: true },
      orderBy: { month_key: "desc" },
    });
    return res.json({ months: months.map(m => ({ month: m.month_key, file_name: m.file_name, updated_at: m.updated_at, totals: totals(m.rows) })) });
  } catch (error) {
    console.error("Payroll months error:", error);
    return res.status(500).json({ message: "تعذر تحميل الشهور" });
  }
});

router.get("/months/:month", async (req, res) => {
  try {
    if (!MONTH_RE.test(req.params.month)) return res.status(400).json({ message: "الشهر غير صحيح" });
    const month = await prisma.payroll_months.findUnique({
      where: { month_key: req.params.month },
      include: { rows: { orderBy: [{ employee_name: "asc" }, { id: "asc" }] } },
    });
    if (!month) return res.status(404).json({ message: "لم يتم حفظ هذا الشهر بعد" });
    return res.json({ month: month.month_key, file_name: month.file_name, updated_at: month.updated_at, rows: month.rows.map(publicRow), totals: totals(month.rows) });
  } catch (error) {
    console.error("Payroll monthly report error:", error);
    return res.status(500).json({ message: "تعذر تحميل التقرير الشهري" });
  }
});

router.get("/annual", async (req, res) => {
  try {
    const year = String(req.query.year || "");
    if (!YEAR_RE.test(year)) return res.status(400).json({ message: "السنة غير صحيحة" });
    const [months, allowances] = await Promise.all([
      prisma.payroll_months.findMany({
        where: { month_key: { startsWith: `${year}-` } },
        include: { rows: true },
        orderBy: { month_key: "asc" },
      }),
      prisma.payroll_leave_allowances.findMany({ where: { year_key: year } }),
    ]);
    const leaveByEmployee = new Map(allowances.map(r => [r.employee_key, Number(r.amount)]));
    const employees = new Map();
    const monthly = months.map(m => {
      for (const r of m.rows) {
        const current = employees.get(r.employee_key) || {
          employee_key: r.employee_key, employee_code: r.employee_code || "", employee_name: r.employee_name,
          months: {}, month_details: {}, net_total: 0, base_total: 0, overtime_total: 0,
          allowances_total: 0, bonuses_total: 0, deductions_total: 0, advances_total: 0,
        };
        current.employee_name = r.employee_name;
        current.employee_code = r.employee_code || current.employee_code;
        current.months[m.month_key] = Number(r.net_salary);
        current.month_details[m.month_key] = {
          base_salary: Number(r.base_salary), overtime: Number(r.overtime),
          bonuses: Math.round((Number(r.bonuses) + Number(r.allowances)) * 100) / 100,
          deductions: Math.round((Number(r.deductions) + Number(r.advances)) * 100) / 100,
          net_salary: Number(r.net_salary),
        };
        for (const field of ["net", "base", "overtime", "allowances", "bonuses", "deductions", "advances"]) {
          const k = field === "net" ? "net_salary" : field === "base" ? "base_salary" : field;
          current[`${field}_total`] = Math.round((current[`${field}_total`] + Number(r[k])) * 100) / 100;
        }
        employees.set(r.employee_key, current);
      }
      return { month: m.month_key, ...totals(m.rows) };
    });
    const list = Array.from(employees.values()).map(r => {
      const leave_allowance = leaveByEmployee.get(r.employee_key) || 0;
      return { ...r, leave_allowance,
        received_total: Math.round((r.net_total + leave_allowance) * 100) / 100 };
    }).sort((a, b) => a.employee_name.localeCompare(b.employee_name, "ar"));
    const net_salary = Math.round(monthly.reduce((n, m) => n + m.net_salary * 100, 0)) / 100;
    const leave_allowances_total = Math.round(list.reduce((n, r) => n + r.leave_allowance * 100, 0)) / 100;
    const summary = {
      months_count: months.length,
      employees_count: list.length,
      ...Object.fromEntries(MONEY_FIELDS.map(k => [k, Math.round(monthly.reduce((n, m) => n + m[k] * 100, 0)) / 100])),
      leave_allowances_total,
      received_total: Math.round((net_salary + leave_allowances_total) * 100) / 100,
    };
    return res.json({ year, months: monthly, employees: list, summary });
  } catch (error) {
    console.error("Payroll annual report error:", error);
    return res.status(500).json({ message: "تعذر تحميل التقرير السنوي" });
  }
});

// Annual leave is separate from monthly payroll. Import only fills empty slots;
// a manually changed value always wins until deliberately changed again.
router.post("/annual/leave-allowances", async (req, res) => {
  try {
    if (!["CEO", "MANAGER"].includes(req.user?.role)) return res.status(403).json({ message: "لا تملك صلاحية تعديل الرواتب" });
    const year = String(req.body?.year || "");
    if (!YEAR_RE.test(year)) return res.status(400).json({ message: "السنة غير صحيحة" });
    const mode = req.body?.mode;
    if (!["import", "manual"].includes(mode)) return res.status(400).json({ message: "طريقة التعديل غير صحيحة" });
    const input = req.body?.rows;
    if (!Array.isArray(input) || input.length < 1 || input.length > 500 || (mode === "manual" && input.length !== 1)) {
      return res.status(400).json({ message: "اختر من 1 إلى 500 عامل، أو عاملًا واحدًا للتعديل اليدوي" });
    }
    const unique = new Set();
    const rows = input.map((r, i) => {
      const employee_key = String(r?.employee_key || "").trim();
      if (!/^(CODE|NAME):.{1,245}$/.test(employee_key) || employee_key.length > 255) {
        throw new Error(`مفتاح العامل غير صحيح في السطر ${i + 1}`);
      }
      if (unique.has(employee_key)) throw new Error(`العامل مكرر في السطر ${i + 1}`);
      unique.add(employee_key);
      return { employee_key, amount: (cents(r.amount, `بدل الإجازة - السطر ${i + 1}`) / 100).toFixed(2) };
    });
    const yearMonths = await prisma.payroll_months.findMany({
      where: { month_key: { startsWith: `${year}-` } }, include: { rows: true },
    });
    const known = new Set(yearMonths.flatMap(m => m.rows.map(r => r.employee_key)));
    if (rows.some(r => !known.has(r.employee_key))) {
      return res.status(400).json({ message: "يوجد عامل غير محفوظ في رواتب هذه السنة؛ احفظ رواتب شهره أولًا" });
    }
    const source_file = mode === "import" ? String(req.body.source_file || "").slice(0, 255) || null : null;
    const user_id = BigInt(req.user.id);
    const result = await prisma.$transaction(async tx => {
      if (mode === "import") {
        // Import uses one bulk insert and one audit record. On remote TiDB this
        // avoids hundreds of round-trips and does not overwrite manual values.
        const savedBefore = await tx.payroll_leave_allowances.findMany({ where: { year_key: year } });
        const protectedKeys = new Set(savedBefore.map(r => r.employee_key));
        const newRows = rows.filter(r => !protectedKeys.has(r.employee_key));
        if (!newRows.length) return { saved: 0, skipped: rows.length };
        const inserted = await tx.payroll_leave_allowances.createMany({
          data: newRows.map(r => ({ year_key: year, ...r, source_file, updated_by: user_id })),
          skipDuplicates: true,
        });
        if (inserted.count) await tx.audit_logs.create({ data: {
          user_id, action: "PAYROLL_LEAVE_IMPORT", table_name: "payroll_leave_allowances",
          record_id: BigInt(year), old_values: null,
          new_values: { year, source_file, imported: inserted.count,
            candidates: newRows.map(r => ({ employee_key: r.employee_key, amount: Number(r.amount) })) },
        } });
        return { saved: inserted.count, skipped: rows.length - inserted.count };
      }
      const row = rows[0];
      const key = { year_key_employee_key: { year_key: year, employee_key: row.employee_key } };
      const before = await tx.payroll_leave_allowances.findUnique({ where: key });
      if (before && Number(before.amount).toFixed(2) === row.amount) return { saved: 0, skipped: 1 };
      const entry = await tx.payroll_leave_allowances.upsert({
        where: key,
        create: { year_key: year, employee_key: row.employee_key, amount: row.amount, source_file: null, updated_by: user_id },
        update: { amount: row.amount, source_file: null, updated_by: user_id, updated_at: new Date() },
      });
      await tx.audit_logs.create({ data: {
        user_id, action: before ? "PAYROLL_LEAVE_UPDATE" : "PAYROLL_LEAVE_CREATE",
        table_name: "payroll_leave_allowances", record_id: entry.id,
        old_values: before ? { year, employee_key: row.employee_key, amount: Number(before.amount) } : null,
        new_values: { year, employee_key: row.employee_key, amount: Number(row.amount) },
      } });
      return { saved: 1, skipped: 0 };
    }, { timeout: 20000 });
    return res.json({ success: true, year, ...result });
  } catch (error) {
    if (/مفتاح العامل|السطر|عامل مكرر|قيمة غير صحيحة|المبلغ/.test(error.message || "")) {
      return res.status(400).json({ message: error.message });
    }
    console.error("Payroll leave allowance error:", error);
    return res.status(500).json({ message: "تعذر حفظ بدل الإجازة. لم يتم حفظ جزء من العملية." });
  }
});

// Save is atomic, never silently overwrites an imported month. Explicitly
// confirmed replacement is available to CEO/MANAGER with an audit snapshot.
async function saveMonth(req, res, replace = false) {
  try {
    if (!["CEO", "MANAGER"].includes(req.user?.role)) return res.status(403).json({ message: "لا تملك صلاحية تعديل الرواتب" });
    const month = replace ? req.params.month : String(req.body.month || "");
    if (!MONTH_RE.test(month)) return res.status(400).json({ message: "الشهر غير صحيح" });
    if (replace && req.body.confirm_replace !== true) return res.status(400).json({ message: "يتطلب استبدال الشهر تأكيدًا صريحًا" });
    const rows = parseRows(req.body.rows);
    const file_name = String(req.body.file_name || "").trim().slice(0, 255) || null;
    const user_id = BigInt(req.user.id);
    const result = await prisma.$transaction(async tx => {
      const previous = await tx.payroll_months.findUnique({ where: { month_key: month }, include: { rows: true } });
      if (previous && !replace) return { conflict: true };
      if (!previous && replace) return { missing: true };
      let batch;
      if (previous) {
        // Keep an audit trail of the entire prior payroll before replacement.
        const before = { month, file_name: previous.file_name, rows: previous.rows.map(publicRow) };
        await tx.audit_logs.create({ data: {
          user_id, action: "PAYROLL_REPLACE", table_name: "payroll_months", record_id: previous.id,
          old_values: before, new_values: { month, file_name, count: rows.length },
        } });
        await tx.payroll_rows.deleteMany({ where: { month_id: previous.id } });
        batch = await tx.payroll_months.update({ where: { id: previous.id }, data: { file_name, updated_at: new Date() } });
      } else {
        batch = await tx.payroll_months.create({ data: { month_key: month, file_name, created_by: user_id } });
      }
      await tx.payroll_rows.createMany({ data: rows.map(row => ({ ...row, month_id: batch.id })) });
      return { count: rows.length };
    }, { timeout: 15000 });
    if (result.conflict) return res.status(409).json({ message: "هذا الشهر محفوظ مسبقًا. افتح الشهر ثم اختر تعديل الشهر إذا أردت استبداله." });
    if (result.missing) return res.status(404).json({ message: "الشهر غير موجود" });
    return res.status(replace ? 200 : 201).json({ success: true, month, count: result.count });
  } catch (error) {
    if (error.message?.includes("السطر") || error.message?.includes("العامل") || error.message?.includes("يجب إرسال") || error.message?.includes("المبلغ") || error.message?.includes("قيمة غير صحيحة")) {
      return res.status(400).json({ message: error.message });
    }
    if (error.code === "P2002") return res.status(409).json({ message: "الشهر أو العامل موجود مسبقًا" });
    console.error("Payroll save error:", error);
    return res.status(500).json({ message: "تعذر حفظ الرواتب. لم يتم حفظ جزء من الملف." });
  }
}
router.post("/months", (req, res) => saveMonth(req, res, false));
router.put("/months/:month", (req, res) => saveMonth(req, res, true));

module.exports = router;
module.exports._private = { parseRows, totals };
