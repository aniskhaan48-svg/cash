"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../../../components/Sidebar";
import { apiFetch } from "../../../lib/api";

const dateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};
const todayKey = () => dateKey(new Date());
const money = (value) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const movementName = (type) => ({
  CASH_IN: "إيراد صندوق",
  CASH_OUT: "مصروف صندوق",
  EXPENSE: "مصروف بنك/محفظة",
  SUPPLIER_PAYMENT: "سداد مورد",
  ADVANCE: "صرف عهدة",
  ADVANCE_RETURN: "استرداد عهدة",
  ADVANCE_SETTLEMENT: "تسوية عهدة",
  TRANSFER: "تحويل داخلي",
  BANK_IN: "حركة بنكية داخلة",
  BANK_OUT: "حركة بنكية خارجة",
  OTHER_IN: "حركة داخلة أخرى",
  OTHER_OUT: "حركة خارجة أخرى",
}[type] || type);

export default function TreasuryReportsPage() {
  const router = useRouter();
  const [from, setFrom] = useState(todayKey());
  const [to, setTo] = useState(todayKey());
  const [entity, setEntity] = useState("ALL");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadReport = async (override = null) => {
    const nextFrom = override?.from || from;
    const nextTo = override?.to || to;
    const nextEntity = override?.entity || entity;
    setLoading(true);
    setMessage("");
    try {
      const response = await apiFetch(`/api/treasury/report?from=${nextFrom}&to=${nextTo}&entity=${nextEntity}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "تعذر تحميل التقرير");
      setData(result);
    } catch (error) {
      setMessage(error.message || "تعذر تحميل التقرير");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let user = {};
    try { user = JSON.parse(localStorage.getItem("user") || "{}"); } catch {}
    if (!["CEO", "MANAGER", "ACCOUNTANT"].includes(user.role)) {
      router.replace("/dashboard");
      return;
    }
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const quickPeriod = (period) => {
    const now = new Date();
    let start = new Date(now);
    if (period === "3days") start.setDate(now.getDate() - 2);
    if (period === "week") start.setDate(now.getDate() - ((now.getDay() + 1) % 7));
    if (period === "month") start = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextFrom = dateKey(start);
    const nextTo = dateKey(now);
    setFrom(nextFrom);
    setTo(nextTo);
    loadReport({ from: nextFrom, to: nextTo, entity });
  };

  const exportExcel = async () => {
    if (!data) return;
    const XLSXModule = await import("xlsx");
    const XLSX = XLSXModule.default || XLSXModule;
    const rows = [
      ["CashBox Cloud - التقرير المالي الشامل"],
      ["الفترة", `${data.from} إلى ${data.to}`],
      ["الجهة", data.entity_name],
      [],
      ["ملخص التقرير"],
      ["إجمالي الإيرادات", data.summary.totalIncome],
      ["إجمالي المصروفات", data.summary.totalExpense],
      ["صافي الإيرادات والمصروفات", data.summary.netIncomeExpense],
      ["العهد المصروفة", data.summary.advancesIssued],
      ["العهد المستردة", data.summary.advancesReturned],
      ["العهد المسواة", data.summary.advancesSettled],
      ["العهد القائمة", data.summary.outstandingAdvances],
      ["سداد الموردين", data.summary.supplierPayments],
      ["حركات بنكية خارجة غير مصنفة كمصروف", data.summary.bankOut],
      ["تحويلات صادرة", data.summary.transfersOut],
      ["تحويلات واردة", data.summary.transfersIn],
      ["رصيد الصناديق", data.summary.cashboxClosing],
      ["رصيد البنوك والمحافظ", data.summary.bankWalletClosing],
      ["إجمالي السيولة", data.summary.totalLiquidity],
      [],
      ["اليوم", "الإيرادات", "المصروفات", "العهد", "بنكي داخل", "بنكي خارج", "عدد الحركات"],
      ...(data.daily || []).map((day) => [day.date, day.income, day.expense, day.advances, day.bankIn, day.bankOut, day.count]),
      [],
      ["المصروفات حسب الحساب"],
      ["الحساب", "المبلغ"],
      ...(data.expenseByAccount || []).map((row) => [row.name, row.amount]),
      [],
      ["الإيرادات حسب الحساب"],
      ["الحساب", "المبلغ"],
      ...(data.incomeByAccount || []).map((row) => [row.name, row.amount]),
      [],
      ["أرصدة البنوك والمحافظ"],
      ["الجهة", "الحساب", "رصيد البداية", "الرصيد بعد آخر حركة"],
      ...(data.accounts || []).map((account) => [account.entity_name, account.name_ar, account.opening_balance, account.current_balance]),
      [],
      ["تفاصيل الحركات"],
      ["التاريخ", "الجهة", "النوع", "من الحساب", "إلى الحساب", "المستفيد", "البيان", "المبلغ"],
      ...(data.movements || []).map((row) => [row.date, row.entity_name, movementName(row.movement_type), row.from_account, row.to_account, row.beneficiary, row.description, row.amount]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 15 }, { wch: 18 }, { wch: 24 }, { wch: 28 }, { wch: 28 }, { wch: 24 }, { wch: 44 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "التقرير الشامل");
    XLSX.writeFile(wb, `cashbox-report-${data.from}-${data.to}.xlsx`);
  };

  return (
    <div className="cb-shell" dir="rtl">
      <Sidebar />
      <main className="cb-dashboard">
        <header className="cb-topbar">
          <div><h1 className="cb-welcome-title">التقرير المالي الشامل</h1><p className="cb-welcome-subtitle">اختر أي فترة: يوم، 3 أيام، أسبوع، شهر أو فترة مخصصة — تولان أو الملقا أو الجميع</p></div>
          <div className="flex gap-2 flex-wrap"><button onClick={exportExcel} disabled={!data} className="cb-outline-button">Excel</button><button onClick={() => window.print()} disabled={!data} className="cb-outline-button">PDF / طباعة</button></div>
        </header>

        <section className="cb-panel mb-5 print:hidden"><div className="cb-panel-body">
          <div className="flex gap-2 flex-wrap mb-4">
            <button onClick={() => quickPeriod("today")} className="px-4 py-2 rounded-lg border font-bold bg-white">اليوم</button>
            <button onClick={() => quickPeriod("3days")} className="px-4 py-2 rounded-lg border font-bold bg-white">آخر 3 أيام</button>
            <button onClick={() => quickPeriod("week")} className="px-4 py-2 rounded-lg border font-bold bg-white">هذا الأسبوع</button>
            <button onClick={() => quickPeriod("month")} className="px-4 py-2 rounded-lg border font-bold bg-white">هذا الشهر</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div><label className="block mb-2 font-bold">من</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full border rounded-lg p-3" /></div>
            <div><label className="block mb-2 font-bold">إلى</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full border rounded-lg p-3" /></div>
            <div><label className="block mb-2 font-bold">الجهة</label><select value={entity} onChange={(e) => setEntity(e.target.value)} className="w-full border rounded-lg p-3"><option value="ALL">تولان + الملقا</option><option value="TOLAN">تولان فقط</option><option value="ALMALQA">الملقا فقط</option></select></div>
            <button onClick={() => loadReport()} disabled={loading} className="rounded-lg bg-[#c28b2c] text-white font-bold px-8 py-3">{loading ? "جاري التجهيز..." : "إنشاء التقرير"}</button>
          </div>
          {message && <div className="mt-4 rounded-lg bg-red-50 text-red-700 p-3 font-bold">{message}</div>}
        </div></section>

        {data && (
          <div id="executive-report">
            <section className="cb-panel mb-5"><div className="cb-panel-body">
              <div className="flex justify-between gap-4 flex-wrap border-b border-[#e5dcc9] pb-4 mb-4"><div><div className="text-sm text-gray-500">CashBox Cloud</div><h2 className="text-2xl font-bold text-[#4b4a24]">التقرير المالي للفترة</h2></div><div className="text-left"><div className="font-bold">{data.entity_name}</div><div>{data.from} — {data.to}</div></div></div>
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
                <div className="rounded-xl bg-[#f7f3e9] p-4"><div className="text-xs text-gray-500">الإيرادات</div><strong className="block text-xl mt-1 text-green-700">{money(data.summary.totalIncome)}</strong></div>
                <div className="rounded-xl bg-[#f7f3e9] p-4"><div className="text-xs text-gray-500">المصروفات</div><strong className="block text-xl mt-1 text-red-700">{money(data.summary.totalExpense)}</strong></div>
                <div className="rounded-xl bg-[#f7f3e9] p-4"><div className="text-xs text-gray-500">الصافي</div><strong className="block text-xl mt-1">{money(data.summary.netIncomeExpense)}</strong></div>
                <div className="rounded-xl bg-[#f7f3e9] p-4"><div className="text-xs text-gray-500">العهد المصروفة</div><strong className="block text-xl mt-1">{money(data.summary.advancesIssued)}</strong></div>
                <div className="rounded-xl bg-[#f7f3e9] p-4"><div className="text-xs text-gray-500">العهد القائمة</div><strong className="block text-xl mt-1 text-[#a46e10]">{money(data.summary.outstandingAdvances)}</strong></div>
                <div className="rounded-xl bg-[#f7f3e9] p-4"><div className="text-xs text-gray-500">رصيد الصناديق</div><strong className="block text-xl mt-1">{money(data.summary.cashboxClosing)}</strong></div>
                <div className="rounded-xl bg-[#f7f3e9] p-4"><div className="text-xs text-gray-500">البنوك والمحافظ</div><strong className="block text-xl mt-1">{money(data.summary.bankWalletClosing)}</strong></div>
                <div className="rounded-xl bg-[#4b4a24] text-white p-4"><div className="text-xs opacity-75">إجمالي السيولة</div><strong className="block text-xl mt-1">{money(data.summary.totalLiquidity)}</strong></div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-4 text-sm">
                <div className="rounded-lg border border-[#e7dcc5] p-3"><span className="text-gray-500">سداد موردين</span><strong className="block mt-1">{money(data.summary.supplierPayments)} ر.س</strong></div>
                <div className="rounded-lg border border-[#e7dcc5] p-3"><span className="text-gray-500">عهد مستردة</span><strong className="block mt-1">{money(data.summary.advancesReturned)} ر.س</strong></div>
                <div className="rounded-lg border border-[#e7dcc5] p-3"><span className="text-gray-500">عهد مسواة</span><strong className="block mt-1">{money(data.summary.advancesSettled)} ر.س</strong></div>
                <div className="rounded-lg border border-[#e7dcc5] p-3"><span className="text-gray-500">تحويلات صادرة / واردة</span><strong className="block mt-1">{money(data.summary.transfersOut)} / {money(data.summary.transfersIn)}</strong></div>
                <div className="rounded-lg border border-[#e7dcc5] p-3"><span className="text-gray-500">حركات بنكية خارجة</span><strong className="block mt-1">{money(data.summary.bankOut)} ر.س</strong></div>
              </div>
            </div></section>

            <section className="cb-panel mb-5"><div className="cb-panel-body">
              <div className="cb-panel-head"><div><h2 className="cb-panel-title">الملخص اليومي</h2><p className="cb-panel-subtitle">يظهر كل يوم تمت فيه حركة خلال الفترة</p></div></div>
              <div className="overflow-x-auto"><table className="w-full border-collapse"><thead><tr className="border-b bg-[#faf6ed]"><th className="p-3">اليوم</th><th className="p-3">الإيرادات</th><th className="p-3">المصروفات</th><th className="p-3">العهد</th><th className="p-3">بنكي داخل</th><th className="p-3">بنكي خارج</th><th className="p-3">عدد الحركات</th></tr></thead><tbody>
                {(data.daily || []).length === 0 ? <tr><td colSpan="7" className="p-8 text-center text-gray-500">لا توجد حركة في الفترة</td></tr> : data.daily.map((day) => <tr key={day.date} className="border-b"><td className="p-3 font-bold">{day.date}</td><td className="p-3 text-green-700 font-bold">{money(day.income)}</td><td className="p-3 text-red-700 font-bold">{money(day.expense)}</td><td className="p-3">{money(day.advances)}</td><td className="p-3">{money(day.bankIn)}</td><td className="p-3">{money(day.bankOut)}</td><td className="p-3">{day.count}</td></tr>)}
              </tbody></table></div>
            </div></section>

            <section className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-5">
              <article className="cb-panel"><div className="cb-panel-body"><div className="cb-panel-head"><div><h2 className="cb-panel-title">المصروفات حسب الحساب</h2><p className="cb-panel-subtitle">كهرباء، نقل، شحن، ضيافة وغيرها حسب دليل الحسابات</p></div></div><div className="space-y-2">{(data.expenseByAccount || []).length === 0 ? <div className="text-gray-500">لا توجد مصروفات في الفترة</div> : data.expenseByAccount.map((row) => <div key={row.name} className="flex justify-between gap-3 rounded-lg bg-[#f7f3e9] p-3"><span className="font-bold">{row.name}</span><strong>{money(row.amount)} ر.س</strong></div>)}</div></div></article>
              <article className="cb-panel"><div className="cb-panel-body"><div className="cb-panel-head"><div><h2 className="cb-panel-title">الإيرادات حسب الحساب</h2></div></div><div className="space-y-2">{(data.incomeByAccount || []).length === 0 ? <div className="text-gray-500">لا توجد إيرادات في الفترة</div> : data.incomeByAccount.map((row) => <div key={row.name} className="flex justify-between gap-3 rounded-lg bg-[#f7f3e9] p-3"><span className="font-bold">{row.name}</span><strong>{money(row.amount)} ر.س</strong></div>)}</div></div></article>
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-5">
              <article className="cb-panel"><div className="cb-panel-body"><div className="cb-panel-head"><div><h2 className="cb-panel-title">رصيد الصناديق حتى آخر يوم</h2></div></div><div className="space-y-2">{(data.cashboxes || []).map((box) => <div key={box.id} className="flex justify-between gap-3 rounded-lg bg-[#f7f3e9] p-3"><span><strong>{box.name}</strong> — {box.entity_name}</span><strong>{money(box.balance)} ر.س</strong></div>)}</div></div></article>
              <article className="cb-panel"><div className="cb-panel-body"><div className="cb-panel-head"><div><h2 className="cb-panel-title">البنوك والمحافظ — الرصيد بعد آخر حركة</h2></div></div><div className="space-y-2">{(data.accounts || []).map((account) => <div key={account.id} className="flex justify-between gap-3 rounded-lg bg-[#f7f3e9] p-3"><span><strong>{account.name_ar}</strong> — {account.entity_name}</span><strong>{money(account.current_balance)} ر.س</strong></div>)}</div></div></article>
            </section>

            <section className="cb-panel mb-5"><div className="cb-panel-body">
              <div className="cb-panel-head"><div><h2 className="cb-panel-title">العهد القائمة حتى نهاية الفترة</h2></div></div>
              <div className="overflow-x-auto"><table className="w-full border-collapse"><thead><tr className="border-b bg-[#faf6ed]"><th className="p-3">المندوب</th><th className="p-3">الجهة</th><th className="p-3">مصروف</th><th className="p-3">مسترد</th><th className="p-3">مسوى</th><th className="p-3">القائم</th></tr></thead><tbody>{(data.advances || []).length === 0 ? <tr><td colSpan="6" className="p-6 text-center text-gray-500">لا توجد عهد</td></tr> : data.advances.map((row, index) => <tr key={`${row.beneficiary}-${row.entity_code}-${index}`} className="border-b"><td className="p-3 font-bold">{row.beneficiary}</td><td className="p-3">{row.entity_name}</td><td className="p-3">{money(row.issued)}</td><td className="p-3">{money(row.returned)}</td><td className="p-3">{money(row.settled)}</td><td className="p-3 font-bold text-[#a46e10]">{money(row.outstanding)}</td></tr>)}</tbody></table></div>
            </div></section>

            <section className="cb-panel mb-5"><div className="cb-panel-body">
              <div className="cb-panel-head"><div><h2 className="cb-panel-title">تفاصيل الحركات</h2><p className="cb-panel-subtitle">الصندوق + البنوك + المحافظ + العهد + الموردين + التحويلات</p></div><div className="font-bold">{data.summary.movementCount} حركة</div></div>
              <div className="overflow-x-auto"><table className="w-full border-collapse text-sm"><thead><tr className="border-b bg-[#faf6ed]"><th className="p-3">التاريخ</th><th className="p-3">الجهة</th><th className="p-3">النوع</th><th className="p-3">الحساب</th><th className="p-3">من</th><th className="p-3">إلى</th><th className="p-3">المستفيد</th><th className="p-3">البيان</th><th className="p-3">المبلغ</th><th className="p-3">الرصيد بعد الحركة</th></tr></thead><tbody>
                {(data.movements || []).length === 0 ? <tr><td colSpan="10" className="p-8 text-center text-gray-500">لا توجد حركة</td></tr> : data.movements.map((row, index) => <tr key={`${row.source}-${row.id}-${row.line_id || index}`} className="border-b"><td className="p-3 whitespace-nowrap">{row.date}</td><td className="p-3 font-bold">{row.entity_name}</td><td className="p-3">{movementName(row.movement_type)}</td><td className="p-3">{row.account || "—"}</td><td className="p-3">{row.from_account || "—"}</td><td className="p-3">{row.to_account || "—"}</td><td className="p-3">{row.beneficiary || "—"}</td><td className="p-3 min-w-[220px]">{row.description || "—"}</td><td className="p-3 font-bold whitespace-nowrap">{money(row.amount)} ر.س</td><td className="p-3 font-bold whitespace-nowrap">{row.balance_after == null ? "—" : `${money(row.balance_after)} ر.س`}</td></tr>)}
              </tbody></table></div>
            </div></section>

            <section className="cb-panel"><div className="cb-panel-body"><div className="cb-panel-head"><div><h2 className="cb-panel-title">ملخص المخزون حتى نهاية الفترة</h2><p className="cb-panel-subtitle">الكروت والأساور حسب الحركات المسجلة في المستودع</p></div></div><div className="grid grid-cols-1 md:grid-cols-3 gap-3">{(data.inventory || []).map((item) => <div key={item.id} className="rounded-xl bg-[#f7f3e9] p-4"><div className="text-sm text-gray-500">{item.name}</div><div className="text-2xl font-bold mt-1">{Number(item.closingStock || 0).toLocaleString("en-US")} {item.unit}</div></div>)}</div></div></section>
          </div>
        )}
      </main>
    </div>
  );
}
