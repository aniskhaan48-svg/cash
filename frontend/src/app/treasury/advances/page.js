"use client";

import { useEffect, useState } from "react";
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
const money = (value) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export default function TreasuryAdvancesPage() {
  const router = useRouter();
  const [to, setTo] = useState(todayKey());
  const [entity, setEntity] = useState("ALL");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await apiFetch(`/api/treasury/advances?to=${to}&entity=${entity}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "تعذر تحميل العهد");
      setData(result);
    } catch (error) {
      setMessage(error.message || "تعذر تحميل العهد");
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
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  return (
    <div className="cb-shell" dir="rtl">
      <Sidebar />
      <main className="cb-dashboard">
        <header className="cb-topbar"><div><h1 className="cb-welcome-title">العهد</h1><p className="cb-welcome-subtitle">العهد المصروفة والمستردة والمسواة والرصيد القائم لكل مندوب حسب تولان والملقا</p></div><a href="/treasury" className="cb-outline-button">إدخال حركة عهدة</a></header>

        <section className="cb-panel mb-5"><div className="cb-panel-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div><label className="block mb-2 font-bold">حتى تاريخ</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full border rounded-lg p-3" /></div>
            <div><label className="block mb-2 font-bold">الجهة</label><select value={entity} onChange={(e) => setEntity(e.target.value)} className="w-full border rounded-lg p-3"><option value="ALL">تولان + الملقا</option><option value="TOLAN">تولان</option><option value="ALMALQA">الملقا</option></select></div>
            <button onClick={load} disabled={loading} className="rounded-lg bg-[#c28b2c] text-white font-bold px-7 py-3">{loading ? "جاري التحميل..." : "عرض"}</button>
          </div>
          {message && <div className="mt-4 rounded-lg bg-red-50 text-red-700 p-3 font-bold">{message}</div>}
        </div></section>

        {data && (
          <>
            <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
              <article className="cb-panel"><div className="cb-panel-body"><div className="text-sm text-gray-500">إجمالي العهد المصروفة</div><div className="text-2xl font-bold mt-2">{money(data.totals.issued)} ر.س</div></div></article>
              <article className="cb-panel"><div className="cb-panel-body"><div className="text-sm text-gray-500">المسترد</div><div className="text-2xl font-bold mt-2 text-green-700">{money(data.totals.returned)} ر.س</div></div></article>
              <article className="cb-panel"><div className="cb-panel-body"><div className="text-sm text-gray-500">المسوى كمصروف</div><div className="text-2xl font-bold mt-2">{money(data.totals.settled)} ر.س</div></div></article>
              <article className="cb-panel"><div className="cb-panel-body"><div className="text-sm text-gray-500">العهد القائمة</div><div className="text-2xl font-bold mt-2 text-[#a46e10]">{money(data.totals.outstanding)} ر.س</div></div></article>
            </section>
            <section className="cb-panel"><div className="cb-panel-body">
              <div className="cb-panel-head"><div><h2 className="cb-panel-title">العهد حسب المندوب والجهة</h2><p className="cb-panel-subtitle">حتى {data.to}</p></div></div>
              <div className="overflow-x-auto"><table className="w-full border-collapse"><thead><tr className="border-b bg-[#faf6ed]"><th className="p-3">المندوب / الموظف</th><th className="p-3">الجهة</th><th className="p-3">مصروف عهدة</th><th className="p-3">مسترد</th><th className="p-3">مسوى</th><th className="p-3">الرصيد القائم</th></tr></thead><tbody>
                {(data.rows || []).length === 0 ? <tr><td colSpan="6" className="p-8 text-center text-gray-500">لا توجد عهد</td></tr> : data.rows.map((row, index) => <tr key={`${row.beneficiary}-${row.entity_code}-${index}`} className="border-b"><td className="p-3 font-bold">{row.beneficiary}</td><td className="p-3">{row.entity_name}</td><td className="p-3">{money(row.issued)}</td><td className="p-3">{money(row.returned)}</td><td className="p-3">{money(row.settled)}</td><td className={`p-3 font-bold ${row.outstanding > 0 ? "text-[#a46e10]" : "text-green-700"}`}>{money(row.outstanding)} ر.س</td></tr>)}
              </tbody></table></div>
            </div></section>
          </>
        )}
      </main>
    </div>
  );
}
