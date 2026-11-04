"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../../components/Sidebar";
import { apiFetch } from "../../lib/api";
import "./payroll.css";
import { autoMap, annualLayout, monthMap, bestPayrollSheet, sheetYear, buildImportedRows, readAnnualLeaveRows, amount, calculatedNet } from "./excelImport.mjs";

const yearNow = () => new Date().getFullYear();
const monthNow = () => `${yearNow()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
const money = n => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Keep the backend's optional columns in state so saved records are not changed
// by merely opening and re-editing them. Only the requested six columns are shown.
const fields = [
  ["employee_code", "بصمة"], ["employee_name", "اسم العامل"],
  ["base_salary", "الراتب"], ["overtime", "الإضافي"],
  ["bonuses", "حافز"], ["deductions", "خصومات"],
  ["net_salary", "الإجمالي"], ["allowances", "البدلات (إضافية)"],
  ["advances", "السلف (إضافية)"], ["notes", "ملاحظات"],
];
const displayFields = fields.filter(([k]) => ["employee_name", "base_salary", "overtime", "bonuses", "deductions", "net_salary"].includes(k));
const numericFields = ["base_salary", "overtime", "allowances", "bonuses", "deductions", "advances", "net_salary"];
const activeDisplayFields = rows => {
  const showAllowances = rows.some(r => Number(r.allowances) !== 0 && r.allowances !== "");
  const showAdvances = rows.some(r => Number(r.advances) !== 0 && r.advances !== "");
  return [...displayFields.slice(0, 4),
    ...(showAllowances ? [["allowances", "بدلات"]] : []),
    displayFields[4], ...(showAdvances ? [["advances", "السلف"]] : []), displayFields[5]];
};
const ArabicMonths = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const monthLabel = month => `${ArabicMonths[Number(month?.slice(5, 7)) - 1] || ""} ${month?.slice(0, 4) || ""}`;
const normalize = v => String(v ?? "").toLowerCase().replace(/[\s\u0640\-_()\/\\.]+/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/[ًٌٍَُِّْ]/g, "");
const parseAmount = amount;
const rowTotal = calculatedNet;
const blankRow = () => ({ employee_code: "", employee_name: "", base_salary: "", overtime: "", allowances: "", bonuses: "", deductions: "", advances: "", net_salary: "", notes: "" });
const topTotals = rows => Object.fromEntries(numericFields.map(k => [k, Math.round(rows.reduce((n, r) => n + (parseAmount(r[k]) || 0), 0) * 100) / 100]));

export default function PayrollPage() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [tab, setTab] = useState("import");
  const [month, setMonth] = useState(monthNow());
  const [year, setYear] = useState(String(yearNow()));
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerIndex, setHeaderIndex] = useState(0);
  const [mapping, setMapping] = useState({});
  const [preview, setPreview] = useState([]);
  const [months, setMonths] = useState([]);
  const [monthly, setMonthly] = useState(null);
  const [annual, setAnnual] = useState(null);
  const [leaveDrafts, setLeaveDrafts] = useState({});
  const [leavePreview, setLeavePreview] = useState([]);
  const [leaveFileName, setLeaveFileName] = useState("");
  const [leaveUnmatched, setLeaveUnmatched] = useState(0);
  const [showAnnualDetail, setShowAnnualDetail] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [replacing, setReplacing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canSave = ["CEO", "MANAGER"].includes(role);
  const sheet = sheets[sheetIndex];
  const header = sheet?.grid[headerIndex] || [];

  async function jsonFetch(path, options) {
    const response = await apiFetch(path, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "تعذر تنفيذ الطلب");
    return data;
  }
  async function loadMonths(nextYear = year) {
    const response = await jsonFetch(`/api/payroll/months?year=${nextYear}`);
    setMonths(response.months || []);
  }
  async function loadMonthly(chosen = selectedMonth) {
    if (!chosen) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const data = await jsonFetch(`/api/payroll/months/${chosen}`);
      setMonthly(data); setSelectedMonth(chosen); setTab("monthly");
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function loadAnnual(nextYear = year) {
    setBusy(true); setError(""); setMessage("");
    try {
      const data = await jsonFetch(`/api/payroll/annual?year=${nextYear}`);
      setAnnual(data);
      setLeaveDrafts(Object.fromEntries(data.employees.map(r => [r.employee_key, String(r.leave_allowance || 0)])));
      setLeavePreview([]);
      setLeaveUnmatched(0);
      setTab("annual");
    }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  useEffect(() => {
    let user = {};
    try { user = JSON.parse(localStorage.getItem("user") || "{}"); } catch {}
    if (!["CEO", "MANAGER", "ACCOUNTANT"].includes(user.role)) { router.replace("/dashboard"); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRole(user.role);
    loadMonths(String(yearNow())).catch(e => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Recognize the 12-month matrix, its two header rows, and ordinary Excel sheets.
  function selectSheet(index, chosenMonth) {
    const sheet = sheets[Number(index)];
    if (!sheet) return;
    try {
      const info = monthMap(sheet, chosenMonth);
      setSheetIndex(Number(index)); setHeaderIndex(info.headerIndex);
      setMapping(info.mapping); setPreview([]);
      setError("");
    } catch (e) {
      setError(e.message); setPreview([]);
    }
  }
  function changeMonth(nextMonth) {
    setMonth(nextMonth);
    setPreview([]);
    if (sheet) {
      try {
        const info = monthMap(sheet, nextMonth);
        setHeaderIndex(info.headerIndex); setMapping(info.mapping);
        const workbookYear = info.isAnnual ? info.workbookYear : "";
        setError(workbookYear && workbookYear !== nextMonth.slice(0, 4)
          ? `ملف Excel لسنة ${workbookYear}، لكنك اخترت سنة ${nextMonth.slice(0, 4)}. اختر سنة الملف.` : "");
      } catch (e) { setError(e.message); }
    }
  }
  async function openExcel(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(""); setMessage(""); setReplacing(false); setPreview([]);
    try {
      if (!/\.(xlsx|xls)$/i.test(file.name)) throw new Error("اختر ملف Excel بصيغة XLSX أو XLS");
      if (file.size > 8 * 1024 * 1024) throw new Error("حجم الملف أكبر من 8MB");
      const mod = await import("xlsx");
      const XLSX = mod.default || mod;
      const book = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
      const parsed = book.SheetNames.map(name => ({
        name,
        grid: XLSX.utils.sheet_to_json(book.Sheets[name], { header: 1, defval: "", raw: false, blankrows: false }),
      })).filter(item => item.grid.length);
      if (!parsed.length) throw new Error("ملف Excel فارغ");
      const active = bestPayrollSheet(parsed);
      const workbookYear = sheetYear(parsed[active]);
      const hasAnnualMatrix = Boolean(annualLayout(parsed[active].grid));
      // A 2025 annual file must never silently be saved as a 2026 payroll month.
      const chosenMonth = hasAnnualMatrix && workbookYear && workbookYear !== month.slice(0, 4)
        ? `${workbookYear}-01` : month;
      const info = monthMap(parsed[active], chosenMonth);
      setSheets(parsed); setSheetIndex(active); setHeaderIndex(info.headerIndex);
      setMapping(info.mapping); setMonth(chosenMonth);
      setFileName(file.name); setTab("import");
      setMessage(hasAnnualMatrix
        ? `تم التعرف على كشف السنة ${workbookYear || ""}. اختيرت ورقة ${parsed[active].name} وأعمدة ${monthLabel(chosenMonth)} تلقائيًا. اضغط معاينة البيانات.`
        : "تم فتح الملف وربط الأعمدة. راجع الربط واضغط معاينة البيانات.");
    } catch (e) { setError(e.message || "تعذر فتح الملف"); }
    event.target.value = "";
  }
  function changeSheet(index) {
    selectSheet(index, month);
  }
  function changeHeader(index) {
    const h = Number(index);
    setHeaderIndex(h); setMapping(autoMap(sheet.grid, h)); setPreview([]);
  }
  function buildPreview() {
    setError(""); setMessage(""); setReplacing(false);
    if (!sheet) return;
    const layout = annualLayout(sheet.grid);
    const workbookYear = layout ? sheetYear(sheet) : "";
    if (layout && workbookYear && month.slice(0, 4) !== workbookYear) {
      setError(`ملف الرواتب للسنة ${workbookYear}. اختر شهرًا من السنة الصحيحة قبل المعاينة.`);
      return;
    }
    try {
      const { rows, emptyRows } = buildImportedRows(sheet.grid, headerIndex, mapping);
      if (!rows.length) throw new Error("لم تظهر رواتب لهذا الشهر؛ راجع الشهر والورقة المختارة.");
      if (rows.length > 500) throw new Error("الحد الأقصى 500 عامل في الشهر الواحد");
      setPreview(rows);
      setMessage(`تمت معاينة ${rows.length} عامل لشهر ${monthLabel(month)}.${emptyRows ? ` تم تجاهل ${emptyRows} صفوف بلا رواتب لهذا الشهر.` : ""} راجع المبالغ قبل الحفظ.`);
    } catch (e) { setError(e.message); setPreview([]); }
  }
  const issues = useMemo(() => {
    const found = []; const seen = new Set();
    preview.forEach((r, i) => {
      if (!String(r.employee_name || "").trim()) found.push(`السطر ${i + 1}: اسم العامل مفقود`);
      const key = r.employee_code ? `C:${String(r.employee_code).trim().toUpperCase()}` : `N:${normalize(r.employee_name)}`;
      if (seen.has(key)) found.push(`السطر ${i + 1}: عامل مكرر`);
      seen.add(key);
      numericFields.forEach(k => { if (!Number.isFinite(parseAmount(r[k])) || parseAmount(r[k]) < 0) found.push(`السطر ${i + 1}: ${fields.find(f => f[0] === k)?.[1]} غير صحيح`); });
      if (rowTotal(r) < -0.005 && (r.net_salary === "" || r.net_salary == null)) found.push(`السطر ${i + 1}: الصافي المحسوب سالب`);
    });
    return found;
  }, [preview]);
  const mismatches = useMemo(() => preview.filter(r => numericFields.every(k => Number.isFinite(parseAmount(r[k]))) && Math.abs(rowTotal(r) - parseAmount(r.net_salary)) > 0.01).length, [preview]);
  const previewTotals = useMemo(() => topTotals(preview), [preview]);
  const updateRow = (index, key, value) => setPreview(previous => previous.map((r, i) => {
    if (i !== index) return r;
    const changed = { ...r, [key]: value };
    if (["base_salary", "overtime", "bonuses", "deductions", "allowances", "advances"].includes(key)) {
      const calculated = rowTotal(changed);
      changed.net_salary = Number.isFinite(calculated) ? String(Math.round(calculated * 100) / 100) : "";
    }
    return changed;
  }));

  async function save() {
    if (!canSave || !preview.length || issues.length || busy) return;
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) { setError("اختر الشهر الصحيح"); return; }
    if (sheet && annualLayout(sheet.grid) && sheetYear(sheet) && sheetYear(sheet) !== month.slice(0, 4)) {
      setError("سنة ملف Excel تختلف عن السنة المختارة، لم يتم الحفظ."); return;
    }
    if (mismatches) { setError(`الإجمالي لا يطابق الحساب لدى ${mismatches} عامل. صحّح قيم الرواتب قبل الحفظ.`); return; }
    if (replacing && !window.confirm(`تأكيد استبدال جميع رواتب ${monthLabel(month)}؟ سيتم تسجيل نسخة تدقيقية من البيانات القديمة.`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const payload = { month, file_name: fileName || "تعديل يدوي", rows: preview, ...(replacing ? { confirm_replace: true } : {}) };
      await jsonFetch(replacing ? `/api/payroll/months/${month}` : "/api/payroll/months", {
        method: replacing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setMessage(`تم حفظ رواتب ${monthLabel(month)} بنجاح.`);
      setPreview([]); setSheets([]); setReplacing(false);
      setYear(month.slice(0, 4));
      await loadMonths(month.slice(0, 4));
      const data = await jsonFetch(`/api/payroll/months/${month}`);
      setMonthly(data); setSelectedMonth(month); setTab("monthly");
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  function editMonthly() {
    if (!monthly || !canSave) return;
    setPreview(monthly.rows.map(({ id, employee_key, ...r }) => Object.fromEntries(fields.map(([k]) => [k, r[k] == null ? "" : String(r[k])]))));
    setMonth(monthly.month); setFileName(monthly.file_name || ""); setSheets([]); setReplacing(true); setError("");
    setMessage("يمكنك تعديل الرواتب ثم الضغط على تأكيد استبدال الشهر. سيتم الاحتفاظ بسجل للتعديلات.");
    setTab("import");
  }
  async function exportExcel(type) {
    const mod = await import("xlsx"); const XLSX = mod.default || mod;
    const wb = XLSX.utils.book_new();
    if (type === "monthly" && monthly) {
      const columns = activeDisplayFields(monthly.rows);
      const data = [["CashBox Cloud — رواتب العمال", monthLabel(monthly.month)],
        ["الملف", monthly.file_name || ""], [], columns.map(f => f[1])];
      monthly.rows.forEach(r => data.push(columns.map(([k]) => r[k])));
      data.push(columns.map(([k], i) => i === 0 ? "الإجمالي" : monthly.totals[k] ?? ""));
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws["!cols"] = columns.map(([k]) => ({ wch: k === "employee_name" ? 32 : 17 }));
      wb.Workbook = wb.Workbook || {}; wb.Workbook.Views = [{ RTL: true }];
      XLSX.utils.book_append_sheet(wb, ws, "رواتب الشهر");
      XLSX.writeFile(wb, `cashbox-payroll-${monthly.month}.xlsx`);
    } else if (type === "annual" && annual) {
      const monthsOfYear = Array.from({ length: 12 }, (_, i) => `${annual.year}-${String(i + 1).padStart(2, "0")}`);
      const data = [
        ["CashBox Cloud — كشف رواتب العمال السنوي", annual.year], [],
        ["بصمة", "اسم العامل", ...monthsOfYear.flatMap(m => [monthLabel(m), "", "", "", ""]), "إجمالي الخصومات", "بدل إجازة", "الإجمالي المستلم"],
        ["", "", ...monthsOfYear.flatMap(() => ["الراتب", "الإضافي", "الحافز/البدلات", "الخصومات", "الإجمالي"]), "", "", ""],
      ];
      annual.employees.forEach(r => data.push([
        r.employee_code, r.employee_name,
        ...monthsOfYear.flatMap(k => { const m=r.month_details?.[k]; return m ? [m.base_salary,m.overtime,m.bonuses,m.deductions,m.net_salary] : ["","","","",""]; }),
        r.deductions_total, r.leave_allowance, r.received_total,
      ]));
      data.push(["", "الإجمالي", ...monthsOfYear.flatMap(k=>{
        const m=annual.months.find(x=>x.month===k);return m ? [m.base_salary,m.overtime,Number(m.bonuses)+Number(m.allowances),Number(m.deductions)+Number(m.advances),m.net_salary] : ["","","","",""];
      }), annual.summary.deductions, annual.summary.leave_allowances_total, annual.summary.received_total]);
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws["!cols"] = [{ wch: 14 }, { wch: 34 }, ...monthsOfYear.flatMap(() => Array.from({length:5},()=>({wch:14}))), {wch:20},{wch:17},{wch:22}];
      ws["!merges"] = monthsOfYear.map((_,i)=>({s:{r:2,c:2+i*5},e:{r:2,c:6+i*5}}));
      wb.Workbook = wb.Workbook || {}; wb.Workbook.Views = [{ RTL: true }];
      XLSX.utils.book_append_sheet(wb, ws, "كشف السنة بالتفصيل");
      const compact = XLSX.utils.aoa_to_sheet([
        ["بصمة","اسم العامل", ...monthsOfYear.map(monthLabel), "إجمالي الخصومات", "بدل إجازة", "الإجمالي المستلم"],
        ...annual.employees.map(r=>[r.employee_code,r.employee_name,...monthsOfYear.map(m=>r.months[m]??""),r.deductions_total,r.leave_allowance,r.received_total])
      ]);
      compact["!cols"]=[{wch:14},{wch:34},...monthsOfYear.map(()=>({wch:15})),{wch:20},{wch:17},{wch:21}];
      XLSX.utils.book_append_sheet(wb, compact, "ملخص كل عامل");
      const summary = XLSX.utils.aoa_to_sheet([["الشهر", "عدد العمال", "الراتب", "الإضافي", "البدلات", "الحافز", "الخصومات", "السلف", "الصافي"], ...annual.months.map(m => [monthLabel(m.month), m.count, m.base_salary, m.overtime, m.allowances, m.bonuses, m.deductions, m.advances, m.net_salary])]);
      XLSX.utils.book_append_sheet(wb, summary, "الملخص الشهري");
      XLSX.writeFile(wb, `cashbox-payroll-annual-${annual.year}.xlsx`);
    }
  }
  async function readLeaveExcel(event) {
    const file=event.target.files?.[0];
    if(!file)return;
    setLeavePreview([]);setLeaveUnmatched(0);setError("");setMessage("");
    try {
      if(!annual||annual.year!==year)throw new Error("اعرض التقرير السنوي للسنة المختارة أولًا");
      if(!/\.(xlsx|xls)$/i.test(file.name)||file.size>8*1024*1024)throw new Error("اختر ملف Excel لا يتجاوز 8MB");
      const mod=await import("xlsx"), XLSX=mod.default||mod;
      const book=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:false});
      const sheets=book.SheetNames.map(name=>({name,grid:XLSX.utils.sheet_to_json(book.Sheets[name],{header:1,defval:"",raw:false,blankrows:false})})).filter(x=>x.grid.length);
      const selected=sheets[bestPayrollSheet(sheets)];
      if(!selected)throw new Error("ملف Excel فارغ");
      const parsed=readAnnualLeaveRows(selected);
      if(!parsed.year||parsed.year!==year)throw new Error(`كشف Excel لسنة ${parsed.year||"غير معروفة"}، والسنة المعروضة ${year}`);
      const known=new Set(annual.employees.map(r=>r.employee_key));
      const matched=parsed.rows.filter(r=>known.has(r.employee_key));
      const unmatched=parsed.rows.length-matched.length;
      setLeavePreview(matched);setLeaveUnmatched(unmatched);setLeaveFileName(file.name);
      setMessage(`تمت قراءة ${parsed.rows.length} قيمة بدل إجازة من Excel، منها ${matched.length} عامل محفوظ في رواتب ${year}. راجع المعاينة قبل الحفظ.`);
    }catch(e){setError(e.message||"تعذر قراءة بدل الإجازة");}
    event.target.value="";
  }
  async function saveLeaveImport() {
    if(!canSave||busy||!leavePreview.length||!annual)return;
    if(!window.confirm(`حفظ بدل الإجازة لـ ${leavePreview.length} عامل؟ لن تُستبدل المبالغ المحفوظة سابقًا، ولا رواتب الأشهر.`))return;
    setBusy(true);setError("");setMessage("");
    try {
      const result=await jsonFetch("/api/payroll/annual/leave-allowances",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({year:annual.year,mode:"import",source_file:leaveFileName,
          rows:leavePreview.map(r=>({employee_key:r.employee_key,amount:r.amount}))}),
      });
      await loadAnnual(annual.year);
      setMessage(`تم حفظ بدل الإجازة لـ ${result.saved} عامل. ${result.skipped} قيمة محفوظة سابقًا لم تتغير.`);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function saveManualLeave(employee) {
    if(!canSave||busy||!annual)return;
    const text=leaveDrafts[employee.employee_key]??String(employee.leave_allowance||0);
    const value=amount(text);
    if(!Number.isFinite(value)||value<0||value>999999999999.99){setError("أدخل بدل إجازة صحيحًا بقيمة صفر أو أكثر");return;}
    const valueRounded=Math.round(value*100)/100;
    if(Math.abs(valueRounded-employee.leave_allowance)<0.005){setMessage("بدل الإجازة محفوظ مسبقًا بنفس القيمة");return;}
    if(!window.confirm(`تأكيد تعديل بدل إجازة ${employee.employee_name} إلى ${money(valueRounded)} ريال؟`))return;
    setBusy(true);setError("");setMessage("");
    try{
      await jsonFetch("/api/payroll/annual/leave-allowances",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({year:annual.year,mode:"manual",rows:[{employee_key:employee.employee_key,amount:valueRounded}]})
      });
      await loadAnnual(annual.year);
      setMessage(`تم حفظ بدل إجازة العامل ${employee.employee_name} بنجاح.`);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  function print(mode) {
    document.body.classList.remove("payroll-print-summary", "payroll-print-detail");
    document.body.classList.add(mode === "summary" ? "payroll-print-summary" : "payroll-print-detail");
    const cleanup = () => { document.body.classList.remove("payroll-print-summary", "payroll-print-detail"); window.removeEventListener("afterprint", cleanup); };
    window.addEventListener("afterprint", cleanup);
    window.setTimeout(() => window.print(), 80);
  }
  const allMonths = Array.from({ length: 12 }, (_, i) => `${annual?.year || year}-${String(i + 1).padStart(2, "0")}`);
  return <div className="cb-shell" dir="rtl">
    <Sidebar />
    <main className="cb-main payroll-root">
      <div className="payroll-toolbar no-print">
        <div><h1>رواتب العمال</h1><p>استيراد الرواتب الشهرية وحفظها والتقارير السنوية — مستقل عن أرصدة الصندوق</p></div>
        <div className="payroll-toolbar-actions">
          <button className={tab === "import" ? "active" : ""} onClick={() => { setTab("import"); setError(""); }}>استيراد Excel</button>
          <button className={tab === "monthly" ? "active" : ""} onClick={() => { setTab("monthly"); setError(""); }}>التقرير الشهري</button>
          <button className={tab === "annual" ? "active" : ""} onClick={() => loadAnnual()}>التقرير السنوي</button>
        </div>
      </div>
      {error && <div className="payroll-alert error no-print" role="alert">{error}</div>}
      {message && <div className="payroll-alert success no-print" role="status">{message}</div>}
      {tab === "import" && <section className="payroll-card no-print">
        <div className="payroll-card-head"><h2>{replacing ? `تعديل رواتب ${monthLabel(month)}` : "رفع رواتب العمال"}</h2><span>الخطوة 1 — تحديد الشهر وملف Excel</span></div>
        <div className="payroll-input-grid">
          <label>شهر الرواتب<input type="month" value={month} onChange={e => { changeMonth(e.target.value); setReplacing(false); }} /></label>
          <label>ملف Excel<input type="file" accept=".xlsx,.xls" onChange={openExcel} /></label>
          {fileName && <div className="payroll-file">الملف: <strong>{fileName}</strong></div>}
        </div>
        {sheet && <div className="payroll-mapping">
          <div className="payroll-card-head"><h2>أعمدة رواتب {monthLabel(month)}</h2><span>الخطوة 2 — ربط تلقائي من ملف Excel</span></div>
          {annualLayout(sheet.grid) && <p className="payroll-hint">تم العثور على كشف سنوي من 12 شهرًا. ستُستورد أعمدة الشهر المختار فقط من ورقة «{sheet.name}»، واسم العامل والبصمة من بداية الجدول.</p>}
          <div className="payroll-input-grid">
            <label>ورقة Excel<select value={sheetIndex} onChange={e => changeSheet(e.target.value)}>{sheets.map((s, i) => <option key={i} value={i}>{s.name}</option>)}</select></label>
            {!annualLayout(sheet.grid) && <label>صف العناوين<select value={headerIndex} onChange={e => changeHeader(e.target.value)}>{sheet.grid.slice(0, 25).map((r, i) => <option key={i} value={i}>الصف {i + 1}: {r.filter(Boolean).slice(0, 3).join(" | ").slice(0, 90)}</option>)}</select></label>}
          </div>
          <div className="payroll-map-grid">{fields.filter(([k]) => !["allowances", "advances", "notes"].includes(k)).map(([k, label]) => <label key={k}>{label}{k === "employee_name" && <b> *</b>}
            <select value={mapping[k] ?? ""} onChange={e => { setMapping(p => ({ ...p, [k]: e.target.value })); setPreview([]); }}>
              <option value="">غير موجود</option>
              {header.map((h, i) => <option key={i} value={i}>{String.fromCharCode(65 + (i % 26))} — {String(h || `العمود ${i + 1}`).slice(0, 50)}</option>)}
            </select>
          </label>)}</div>
          <button className="payroll-primary" onClick={buildPreview}>معاينة البيانات</button>
          <p className="payroll-hint">الإجمالي = الراتب + الإضافي + الحافز − الخصومات. يعرض البرنامج إجمالي Excel ويتحقق من مطابقته للحساب، ويمكنك تصحيح المبالغ قبل الحفظ.</p>
        </div>}
        {preview.length > 0 && <div className="payroll-preview">
          <div className="payroll-card-head"><h2>مراجعة الرواتب ({preview.length} عامل)</h2><span>الخطوة 3 — عدّل القيم ثم احفظ</span></div>
          <div className="payroll-summary-strip"><span>الراتب <strong>{money(previewTotals.base_salary)} ر.س</strong></span><span>الإضافي <strong>{money(previewTotals.overtime)} ر.س</strong></span><span>الخصومات <strong>{money(previewTotals.deductions)} ر.س</strong></span><span>الإجمالي <strong>{money(previewTotals.net_salary)} ر.س</strong></span></div>
          {issues.length > 0 && <div className="payroll-alert error">{issues.slice(0, 10).join(" — ")}{issues.length > 10 ? ` (+${issues.length - 10} أخطاء)` : ""}</div>}
          {mismatches > 0 && <div className="payroll-alert warning">تنبيه: الإجمالي في {mismatches} صف لا يطابق الراتب + الإضافي + الحافز − الخصومات. لا يمكن الحفظ قبل التصحيح.</div>}
          <div className="payroll-scroll"><table className="payroll-table payroll-edit-table payroll-monthly-grid" dir="rtl">
            <thead><tr>{activeDisplayFields(preview).map(([k, l]) => <th key={k}>{l}</th>)}</tr></thead>
            <tbody>{preview.map((r, i) => <tr key={i}>{activeDisplayFields(preview).map(([k, label]) =>
              <td key={k} className={k === "employee_name" ? "payroll-worker-cell" : ""}>
                {k === "employee_name" ? <>
                  <input aria-label={`اسم العامل ${i + 1}`} value={r.employee_name || ""} onChange={e => updateRow(i, "employee_name", e.target.value)} />
                  <div className="payroll-worker-meta"><span>بصمة</span><input aria-label={`بصمة العامل ${i + 1}`} value={r.employee_code ?? ""} onChange={e => updateRow(i, "employee_code", e.target.value)} /><button className="payroll-mini-remove" onClick={() => setPreview(p => p.filter((_, j) => j !== i))}>حذف</button></div>
                </> : <input aria-label={`${label} للعامل ${i + 1}`} value={r[k] ?? ""} onChange={e => updateRow(i, k, e.target.value)} className="numeric" readOnly={k === "net_salary"} title={k === "net_salary" ? "الإجمالي محسوب تلقائيًا من بقية المبالغ" : undefined} />}
              </td>)}</tr>)}</tbody>
            <tfoot><tr>{activeDisplayFields(preview).map(([k], i) => <th key={k} className={i ? "number-cell" : ""}>{i ? money(previewTotals[k]) : "إجمالي العمال"}</th>)}</tr></tfoot>
          </table></div>
          <div className="payroll-actions"><button onClick={() => setPreview(p => [...p, blankRow()])}>+ إضافة عامل</button><button className="payroll-primary" disabled={!canSave || !!issues.length || !!mismatches || busy} onClick={save}>{busy ? "جارٍ الحفظ…" : replacing ? "تأكيد استبدال الشهر" : "حفظ رواتب الشهر"}</button></div>
          {!canSave && <p className="payroll-hint">صلاحيتك للعرض فقط. الحفظ والتعديل متاحان للمدير والرئيس التنفيذي.</p>}
        </div>}
        {!sheet && !preview.length && <div className="payroll-info">اختر ملف Excel، أو افتح شهرًا محفوظًا من «التقرير الشهري» لتعديله. لن يتغير رصيد أي صندوق عند حفظ الرواتب.</div>}
      </section>}
      {tab === "monthly" && <>
        <div className="payroll-card no-print payroll-filters"><label>السنة<select value={year} onChange={e => { setYear(e.target.value); loadMonths(e.target.value).catch(x => setError(x.message)); }}>{Array.from({ length: 8 }, (_, i) => String(yearNow() - 5 + i)).map(y => <option key={y}>{y}</option>)}</select></label><label>شهر الرواتب<select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}><option value="">اختر شهرًا محفوظًا</option>{months.map(m => <option key={m.month} value={m.month}>{monthLabel(m.month)}</option>)}</select></label><button className="payroll-primary" disabled={!selectedMonth || busy} onClick={() => loadMonthly()}>عرض الشهر</button></div>
        <div className="payroll-card no-print"><h2>الأشهر المحفوظة</h2><div className="payroll-month-list">{!months.length ? <p>لم تُحفظ رواتب لهذه السنة بعد.</p> : months.map(m => <button key={m.month} onClick={() => loadMonthly(m.month)}><strong>{monthLabel(m.month)}</strong><span>{m.totals.count} عامل</span><span>{money(m.totals.net_salary)} ر.س</span></button>)}</div></div>
        {monthly && <div className="payroll-report payroll-card" id="payroll-report">
          <div className="payroll-report-head"><div><h2>CashBox Cloud — تقرير رواتب العمال</h2><h3>{monthLabel(monthly.month)}</h3><p>الملف: {monthly.file_name || "إدخال يدوي"}</p></div><div className="payroll-report-buttons no-print">{canSave && <button onClick={editMonthly}>تعديل رواتب الشهر</button>}<button onClick={() => exportExcel("monthly")}>تصدير Excel</button><button onClick={() => print("summary")}>طباعة الملخص A4</button><button className="payroll-primary" onClick={() => print("detail")}>طباعة تفصيلية / PDF</button></div></div>
          <div className="payroll-summary-strip payroll-print-summary"><span>عدد العمال <strong>{monthly.totals.count}</strong></span><span>إجمالي الراتب <strong>{money(monthly.totals.base_salary)} ر.س</strong></span><span>إجمالي الإضافي <strong>{money(monthly.totals.overtime)} ر.س</strong></span><span>إجمالي الرواتب <strong>{money(monthly.totals.net_salary)} ر.س</strong></span></div>
          <div className="payroll-scroll payroll-detail-section"><table className="payroll-table payroll-monthly-grid" dir="rtl">
            <thead><tr>{activeDisplayFields(monthly.rows).map(([k, label]) => <th key={k}>{label}</th>)}</tr></thead>
            <tbody>{monthly.rows.map((r, i) => <tr key={r.id || i}>{activeDisplayFields(monthly.rows).map(([k]) =>
              <td key={k} className={numericFields.includes(k) ? "number-cell" : ""}>
                {k === "employee_name" ? <>{r.employee_name}<span className="payroll-worker-code">{r.employee_code ? `بصمة: ${r.employee_code}` : ""}</span></> : money(r[k])}
              </td>)}</tr>)}</tbody>
            <tfoot><tr>{activeDisplayFields(monthly.rows).map(([k], i) => <th key={k} className={i ? "number-cell" : ""}>{i ? money(monthly.totals[k]) : "إجمالي العمال"}</th>)}</tr></tfoot>
          </table></div>
        </div>}
      </>}
      {tab === "annual" && <>
        <div className="payroll-card no-print payroll-filters">
          <label>السنة<select value={year} onChange={e=>{setYear(e.target.value);setAnnual(null);setLeavePreview([]);}}>{Array.from({length:8},(_,i)=>String(yearNow()-5+i)).map(y=><option key={y}>{y}</option>)}</select></label>
          <button className="payroll-primary" disabled={busy} onClick={()=>loadAnnual()}>عرض التقرير السنوي</button>
        </div>
        {annual && <div className="payroll-report payroll-card" id="payroll-report">
          <div className="payroll-report-head"><div><h2>CashBox Cloud — التقرير السنوي لرواتب العمال</h2><h3>السنة المالية {annual.year}</h3></div>
            <div className="payroll-report-buttons no-print"><button onClick={()=>exportExcel("annual")}>تصدير Excel كامل</button><button onClick={()=>print("summary")}>طباعة الملخص A4</button><button className="payroll-primary" onClick={()=>print("detail")}>طباعة / PDF</button></div>
          </div>
          <div className="payroll-summary-strip payroll-print-summary">
            <span>الأشهر المحفوظة <strong>{annual.summary.months_count} / 12</strong></span>
            <span>إجمالي العمال <strong>{annual.summary.employees_count}</strong></span>
            <span>صافي رواتب السنة <strong>{money(annual.summary.net_salary)} ر.س</strong></span>
            <span>بدل الإجازة <strong>{money(annual.summary.leave_allowances_total)} ر.س</strong></span>
            <span>الإجمالي المستلم <strong>{money(annual.summary.received_total)} ر.س</strong></span>
          </div>
          {annual.summary.months_count<12 && <div className="payroll-alert warning no-print">التقرير يجمع فقط الأشهر التي تم حفظها بالفعل. احفظ بقية الأشهر لإكمال السنة.</div>}
          {canSave && <div className="payroll-leave-import no-print">
            <h4>استيراد بدل الإجازة من كشف Excel السنوي (مرة واحدة)</h4>
            <p className="payroll-hint">يمكنك رفع نفس ملف السنة الكامل. سيتم قراءة عمود «بدل إجازة» فقط. لن يُستبدل أي بدل محفوظ يدويًا أو سابقًا عند إعادة الاستيراد.</p>
            <input aria-label="ملف بدل الإجازة Excel" type="file" accept=".xlsx,.xls" onChange={readLeaveExcel}/>
            {leavePreview.length>0 && <>
              <p>المعاينة: {leavePreview.length} عامل، مجموع بدلات الإجازة {money(leavePreview.reduce((n,r)=>n+r.amount,0))} ريال.{leaveUnmatched>0?` يوجد ${leaveUnmatched} عامل غير محفوظ في الأشهر الحالية، لن يُستورد بدله.`:""}</p>
              <div className="payroll-scroll"><table className="payroll-table" dir="rtl"><thead><tr><th>اسم العامل</th><th>بصمة</th><th>بدل إجازة</th></tr></thead><tbody>{leavePreview.slice(0,20).map(r=><tr key={r.employee_key}><td>{r.employee_name}</td><td>{r.employee_code}</td><td>{money(r.amount)}</td></tr>)}</tbody></table></div>
              {leavePreview.length>20 && <p className="payroll-hint">المعروض أول 20 عاملًا للمراجعة فقط؛ سيُحفظ جميع العمال المطابقين.</p>}
              <button className="payroll-primary" disabled={busy} onClick={saveLeaveImport}>حفظ بدل الإجازة من Excel</button>
            </>}
            {!leavePreview.length&&leaveUnmatched>0&&<p className="payroll-alert warning">لا توجد بدلات لعامل محفوظ. احفظ رواتب أشهر العمال أولًا، ثم استورد بدل الإجازة.</p>}
          </div>}
          <h4 className="payroll-subtitle">ملخص الرواتب حسب الشهر</h4>
          <div className="payroll-scroll"><table className="payroll-table payroll-year-summary" dir="rtl"><thead><tr><th>الشهر</th><th>العمال</th><th>الراتب</th><th>الإضافي</th><th>البدلات</th><th>الحافز</th><th>الخصومات</th><th>السلف</th><th>الصافي</th></tr></thead>
          <tbody>{allMonths.map(m=>{const item=annual.months.find(x=>x.month===m);return <tr key={m}><td>{monthLabel(m)}</td><td>{item?.count??"—"}</td>{["base_salary","overtime","allowances","bonuses","deductions","advances","net_salary"].map(k=><td key={k} className="number-cell">{item?money(item[k]):"—"}</td>)}</tr>;})}</tbody>
          <tfoot><tr><th>الإجمالي</th><th>—</th>{["base_salary","overtime","allowances","bonuses","deductions","advances","net_salary"].map(k=><th key={k} className="number-cell">{money(annual.summary[k])}</th>)}</tr></tfoot></table></div>
          <div className="payroll-detail-section">
            <div className="payroll-report-head"><h4 className="payroll-subtitle">تفاصيل كل عامل — الأشهر وبدل الإجازة</h4><button className="no-print" onClick={()=>setShowAnnualDetail(v=>!v)}>{showAnnualDetail?"عرض ملخص الأشهر":"عرض تفصيل الراتب والإضافي والحافز لكل شهر"}</button></div>
            {!showAnnualDetail ? <div className="payroll-scroll"><table className="payroll-table payroll-annual-compact" dir="rtl"><thead><tr><th>بصمة</th><th>اسم العامل</th>{allMonths.map(m=><th key={m}>{ArabicMonths[Number(m.slice(5))-1]}</th>)}<th>إجمالي الخصومات</th><th>بدل إجازة</th><th>الإجمالي المستلم</th></tr></thead>
              <tbody>{annual.employees.map(r=>{const val=amount(leaveDrafts[r.employee_key]??String(r.leave_allowance));return <tr key={r.employee_key}><td>{r.employee_code||"—"}</td><td>{r.employee_name}</td>{allMonths.map(m=><td className="number-cell" key={m}>{r.months[m]==null?"—":money(r.months[m])}</td>)}<td className="number-cell">{money(r.deductions_total)}</td><td className="number-cell payroll-leave-cell"><span className="payroll-print-only">{money(r.leave_allowance)}</span><div className="no-print"><input aria-label={`بدل إجازة ${r.employee_name}`} type="text" inputMode="decimal" disabled={!canSave||busy} value={leaveDrafts[r.employee_key]??String(r.leave_allowance)} onChange={e=>setLeaveDrafts(old=>({...old,[r.employee_key]:e.target.value}))} /><button disabled={!canSave||busy||!Number.isFinite(val)||val<0} onClick={()=>saveManualLeave(r)}>حفظ</button></div></td><td className="number-cell"><strong>{money(r.received_total)}</strong></td></tr>;})}</tbody>
              <tfoot><tr><th colSpan={2}>الإجمالي</th>{allMonths.map(m=><th key={m} className="number-cell">{money(annual.months.find(x=>x.month===m)?.net_salary??0)}</th>)}<th className="number-cell">{money(annual.summary.deductions)}</th><th className="number-cell">{money(annual.summary.leave_allowances_total)}</th><th className="number-cell">{money(annual.summary.received_total)}</th></tr></tfoot></table></div>
            : <div className="payroll-scroll"><table className="payroll-table payroll-annual-detail" dir="rtl"><thead><tr><th rowSpan={2}>بصمة</th><th rowSpan={2}>اسم العامل</th>{allMonths.map(m=><th key={m} colSpan={5}>{ArabicMonths[Number(m.slice(5))-1]}</th>)}<th rowSpan={2}>إجمالي الخصومات</th><th rowSpan={2}>بدل إجازة</th><th rowSpan={2}>الإجمالي المستلم</th></tr><tr>{allMonths.flatMap(m=>["الراتب","الإضافي","الحافز/البدلات","الخصومات","الإجمالي"].map((label,i)=><th key={`${m}-${i}`}>{label}</th>))}</tr></thead>
              <tbody>{annual.employees.map(r=><tr key={r.employee_key}><td>{r.employee_code||"—"}</td><td>{r.employee_name}</td>{allMonths.flatMap(m=>["base_salary","overtime","bonuses","deductions","net_salary"].map(k=><td key={`${m}-${k}`} className="number-cell">{r.month_details?.[m]?money(r.month_details[m][k]):"—"}</td>))}<td>{money(r.deductions_total)}</td><td>{money(r.leave_allowance)}</td><td><strong>{money(r.received_total)}</strong></td></tr>)}</tbody></table></div>}
          </div>
        </div>}
      </>}

    </main>
  </div>;
}
