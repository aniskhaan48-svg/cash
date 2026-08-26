"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../../../components/Sidebar";
import { apiFetch } from "../../../lib/api";

const todayKey = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const qty = (value) => Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });

export default function InventoryReportsPage() {
  const router = useRouter();
  const [period, setPeriod] = useState("daily");
  const [date, setDate] = useState(todayKey());
  const [month, setMonth] = useState(todayKey().slice(0, 7));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadReport = async (nextPeriod = period) => {
    setLoading(true);
    setError("");
    try {
      const query = nextPeriod === "monthly"
        ? `period=monthly&month=${month}`
        : `period=daily&date=${date}`;
      const response = await apiFetch(`/api/inventory/report?${query}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "تعذر تحميل التقرير");
      setData(result);
    } catch (err) {
      console.error(err);
      setError(err.message || "تعذر تحميل تقرير المخزون");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let user = {};
    try { user = JSON.parse(localStorage.getItem("user") || "{}"); } catch {}
    if (!["CEO", "MANAGER", "STORE_KEEPER"].includes(user.role)) {
      router.replace("/dashboard");
      return;
    }
    loadReport("daily");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const itemById = useMemo(() => {
    const map = new Map();
    (data?.items || []).forEach((item) => map.set(String(item.id), item));
    return map;
  }, [data]);

  const exportExcel = async () => {
    if (!data) return;
    const XLSXModule = await import("xlsx");
    const XLSX = XLSXModule.default || XLSXModule;
    const rows = [
      [period === "daily" ? "التقرير اليومي للمخزون" : "التقرير الشهري للمخزون"],
      ["الفترة", `${data.from} إلى ${data.to}`],
      [],
      ["الصنف", "رصيد أول الفترة", "الإدخال", "الاستهلاك", "رصيد آخر الفترة"],
      ...(data.items || []).map((item) => [item.name, item.openingStock, item.totalIn, item.totalOut, item.closingStock]),
      [],
      ["تفاصيل الحركة"],
      ["التاريخ", "الصنف", "نوع الحركة", "الكمية", "الرصيد بعد الحركة"],
      ...(data.movements || []).map((movement) => [
        new Date(movement.date).toLocaleDateString("en-CA"),
        movement.itemName,
        movement.type === "IN" ? "إدخال" : "استهلاك",
        movement.quantity,
        movement.balanceAfter,
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "تقرير المخزون");
    XLSX.writeFile(wb, `inventory-${period}-${data.label}.xlsx`);
  };

  return (
    <div className="cb-shell" dir="rtl">
      <Sidebar />
      <main className="cb-dashboard cb-warehouse-dashboard">
        <header className="cb-topbar">
          <div>
            <h1 className="cb-welcome-title">تقارير المخزون</h1>
            <p className="cb-welcome-subtitle">التقرير اليومي والشهري للكروت والأساور وحركة الإدخال والاستهلاك</p>
          </div>
          <button onClick={exportExcel} disabled={!data} className="cb-outline-button">تصدير Excel</button>
        </header>

        <section className="cb-panel mb-5">
          <div className="cb-panel-body">
            <div className="flex gap-2 flex-wrap mb-4">
              <button type="button" onClick={() => setPeriod("daily")} className={`px-5 py-2 rounded-lg font-bold border ${period === "daily" ? "bg-[#4b4a24] text-white border-[#4b4a24]" : "bg-white border-[#d8c9aa]"}`}>تقرير يومي</button>
              <button type="button" onClick={() => setPeriod("monthly")} className={`px-5 py-2 rounded-lg font-bold border ${period === "monthly" ? "bg-[#4b4a24] text-white border-[#4b4a24]" : "bg-white border-[#d8c9aa]"}`}>تقرير شهري</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
              <div>
                <label className="block mb-2 font-bold">{period === "daily" ? "اليوم" : "الشهر"}</label>
                {period === "daily" ? (
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border rounded-lg p-3" />
                ) : (
                  <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-full border rounded-lg p-3" />
                )}
              </div>
              <button type="button" onClick={() => loadReport()} disabled={loading} className="rounded-lg bg-[#c28b2c] hover:bg-[#a87722] text-white font-bold px-8 py-3">{loading ? "جاري التحميل..." : "عرض التقرير"}</button>
            </div>
            {error && <div className="mt-4 rounded-lg bg-red-50 text-red-800 p-3 font-bold">{error}</div>}
          </div>
        </section>

        {data && (
          <>
            <section className="cb-warehouse-items mb-5">
              {(data.items || []).map((item) => (
                <article key={item.id} className="cb-warehouse-item-card">
                  <div className="cb-warehouse-item-top"><div><div className="cb-warehouse-item-label">{period === "daily" ? "ملخص اليوم" : "ملخص الشهر"}</div><h2>{item.name}</h2></div></div>
                  <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                    <div><span className="text-gray-500">أول الفترة</span><strong className="block text-xl">{qty(item.openingStock)}</strong></div>
                    <div><span className="text-gray-500">إدخال</span><strong className="block text-xl text-green-700">+{qty(item.totalIn)}</strong></div>
                    <div><span className="text-gray-500">استهلاك</span><strong className="block text-xl text-red-700">-{qty(item.totalOut)}</strong></div>
                    <div><span className="text-gray-500">آخر الفترة</span><strong className="block text-xl">{qty(item.closingStock)}</strong></div>
                  </div>
                </article>
              ))}
            </section>

            <section className="cb-panel">
              <div className="cb-panel-body">
                <div className="cb-panel-head">
                  <div><h2 className="cb-panel-title">حركة الفترة</h2><p className="cb-panel-subtitle">من {data.from} إلى {data.to}</p></div>
                  <div className="font-bold">عدد الحركات: {qty(data.totals?.movementCount)}</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead><tr className="border-b bg-[#faf6ed]"><th className="p-3">التاريخ</th><th className="p-3">الصنف</th><th className="p-3">الحركة</th><th className="p-3">الكمية</th><th className="p-3">الرصيد بعد الحركة</th></tr></thead>
                    <tbody>
                      {(data.movements || []).length === 0 ? (
                        <tr><td colSpan="5" className="p-8 text-center text-gray-500">لا توجد حركة في الفترة المحددة</td></tr>
                      ) : (data.movements || []).map((movement) => (
                        <tr key={movement.id} className="border-b">
                          <td className="p-3">{new Date(movement.date).toLocaleDateString("en-CA")}</td>
                          <td className="p-3 font-bold">{movement.itemName}</td>
                          <td className="p-3"><span className={`px-3 py-1 rounded-full font-bold ${movement.type === "IN" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{movement.type === "IN" ? "إدخال" : "استهلاك"}</span></td>
                          <td className="p-3 font-bold">{qty(movement.quantity)} {itemById.get(String(movement.itemId))?.unit || movement.unit}</td>
                          <td className="p-3 font-bold">{qty(movement.balanceAfter)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-5 rounded-xl bg-[#f6f0e4] border border-[#e7d7b5] p-4 flex justify-between gap-4 flex-wrap font-bold">
                  <span>إجمالي الإدخال: <strong className="text-green-700">+{qty(data.totals?.totalIn)}</strong></span>
                  <span>إجمالي الاستهلاك: <strong className="text-red-700">-{qty(data.totals?.totalOut)}</strong></span>
                  <span>إجمالي الرصيد آخر الفترة: <strong>{qty(data.totals?.closingStock)}</strong></span>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
