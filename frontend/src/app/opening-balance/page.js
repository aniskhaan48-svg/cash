"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../../components/Sidebar";
import { apiFetch } from "../../lib/api";

const localDate = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const money = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function OpeningBalancePage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [cashboxId, setCashboxId] = useState("");
  const [amount, setAmount] = useState("");
  const [openingDate, setOpeningDate] = useState(localDate());
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/api/opening-balances");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setRows(Array.isArray(data) ? data : []);
      const firstUnlocked = (Array.isArray(data) ? data : []).find((item) => !item.is_locked);
      if (firstUnlocked) setCashboxId(String(firstUnlocked.cashbox_id));
    } catch (err) {
      console.error(err);
      setError("تعذر تحميل بيانات الرصيد الافتتاحي");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let user = {};
    try {
      user = JSON.parse(localStorage.getItem("user") || "{}");
    } catch {}
    if (user.role !== "CEO" && user.role !== "MANAGER") {
      router.replace("/dashboard");
      return;
    }
    load();
  }, [router]);

  const selected = useMemo(
    () => rows.find((item) => String(item.cashbox_id) === String(cashboxId)),
    [rows, cashboxId]
  );

  const save = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!cashboxId || selected?.is_locked) {
      setError("اختر صندوقًا لم يتم تثبيت رصيده الافتتاحي");
      return;
    }

    if (!Number.isFinite(Number(amount)) || Number(amount) < 0) {
      setError("أدخل رصيدًا افتتاحيًا صحيحًا");
      return;
    }

    try {
      setSaving(true);
      const response = await apiFetch("/api/opening-balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cashbox_id: Number(cashboxId),
          amount: Number(amount),
          opening_date: openingDate,
          note,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "تعذر تثبيت الرصيد");

      setMessage("تم تثبيت الرصيد الافتتاحي بنجاح");
      setAmount("");
      setNote("");
      await load();
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cb-shell" dir="rtl">
      <Sidebar />
      <main className="cb-dashboard">
        <header className="cb-topbar">
          <div>
            <h1 className="cb-welcome-title">الرصيد الافتتاحي للصناديق</h1>
            <p className="cb-welcome-subtitle">تثبيت رصيد الجرد الأول لكل صندوق كنقطة بداية رسمية للحساب</p>
          </div>
        </header>

        <section className="cb-panel mb-5">
          <div className="cb-panel-body">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950 mb-5">
              <strong>مهم:</strong> الرصيد الافتتاحي يثبت مرة واحدة لكل صندوق. اختر تاريخ الجرد بدقة؛ الحركات السابقة لهذا التاريخ تبقى تاريخية ولا تدخل في الرصيد الحالي بعد التثبيت.
            </div>

            <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-2 font-bold">الصندوق</label>
                <select value={cashboxId} onChange={(e) => setCashboxId(e.target.value)} className="w-full border rounded-lg p-3" required>
                  <option value="">اختر الصندوق</option>
                  {rows.map((item) => (
                    <option key={item.cashbox_id} value={item.cashbox_id} disabled={item.is_locked}>
                      {item.cashbox_name}{item.is_locked ? " — مثبت" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-2 font-bold">تاريخ الجرد / بداية الرصيد</label>
                <input type="date" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} className="w-full border rounded-lg p-3" required />
              </div>

              <div>
                <label className="block mb-2 font-bold">الرصيد الافتتاحي</label>
                <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full border rounded-lg p-3" placeholder="0.00" required />
              </div>

              <div>
                <label className="block mb-2 font-bold">ملاحظة الجرد</label>
                <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full border rounded-lg p-3" placeholder="مثال: جرد الصندوق عند بدء النظام" />
              </div>

              <div className="md:col-span-2">
                <button type="submit" disabled={saving || selected?.is_locked} className="w-full rounded-lg bg-[#4b4a24] hover:bg-[#373719] disabled:bg-gray-400 text-white font-bold p-3">
                  {saving ? "جاري التثبيت..." : "تثبيت الرصيد الافتتاحي"}
                </button>
              </div>
            </form>

            {message && <div className="mt-4 rounded-lg bg-green-50 text-green-800 p-3 font-bold">{message}</div>}
            {error && <div className="mt-4 rounded-lg bg-red-50 text-red-800 p-3 font-bold">{error}</div>}
          </div>
        </section>

        <section className="cb-panel">
          <div className="cb-panel-body">
            <div className="cb-panel-head"><h2 className="cb-panel-title">حالة الأرصدة الافتتاحية</h2></div>
            {loading ? (
              <div className="py-8 text-center">جاري التحميل...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead><tr className="border-b bg-[#faf6ed]"><th className="p-3">الصندوق</th><th className="p-3">الرصيد الافتتاحي</th><th className="p-3">التاريخ</th><th className="p-3">ثبت بواسطة</th><th className="p-3">الملاحظة</th><th className="p-3">الحالة</th></tr></thead>
                  <tbody>
                    {rows.map((item) => (
                      <tr key={item.cashbox_id} className="border-b">
                        <td className="p-3 font-bold">{item.cashbox_name}</td>
                        <td className="p-3">{item.is_locked ? `${money(item.opening_balance)} ر.س` : "-"}</td>
                        <td className="p-3">{item.opening_date || "-"}</td>
                        <td className="p-3">{item.created_by_name || "-"}</td>
                        <td className="p-3">{item.note || "-"}</td>
                        <td className="p-3"><span className={`px-3 py-1 rounded-full text-sm font-bold ${item.is_locked ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>{item.is_locked ? "مثبت" : "بانتظار الجرد"}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
