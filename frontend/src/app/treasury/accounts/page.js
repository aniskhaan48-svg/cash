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
const entityName = (code) => (code === "ALMALQA" ? "الملقا" : "تولان");
const typeName = (type) => ({ BANK: "بنك", WALLET: "محفظة", OTHER: "حساب آخر" }[type] || type);

const emptyForm = () => ({
  entity_code: "TOLAN",
  name_ar: "",
  account_type: "BANK",
  opening_balance: "0",
  opening_date: todayKey(),
  is_active: true,
});

export default function TreasuryAccountsPage() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const canManage = role === "CEO" || role === "MANAGER";

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/api/treasury/accounts");
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "تعذر تحميل الحسابات");
      setAccounts(Array.isArray(result) ? result : []);
    } catch (error) {
      setMessage(error.message || "تعذر تحميل الحسابات");
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
    setRole(user.role || "");
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const reset = () => {
    setEditId(null);
    setForm(emptyForm());
  };

  const saveAccount = async (event) => {
    event.preventDefault();
    if (!canManage) return;
    setSaving(true);
    setMessage("");
    try {
      const payload = {
        ...form,
        opening_balance: Number(form.opening_balance || 0),
      };
      const response = await apiFetch(editId ? `/api/treasury/accounts/${editId}` : "/api/treasury/accounts", {
        method: editId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "تعذر حفظ الحساب");
      setMessage(editId ? "تم تحديث الحساب" : "تم إنشاء الحساب");
      reset();
      await loadAccounts();
    } catch (error) {
      setMessage(error.message || "تعذر حفظ الحساب");
    } finally {
      setSaving(false);
    }
  };

  const editAccount = (account) => {
    if (!canManage) return;
    setEditId(account.id);
    setForm({
      entity_code: account.entity_code,
      name_ar: account.name_ar,
      account_type: account.account_type,
      opening_balance: String(account.opening_balance || 0),
      opening_date: account.opening_date || todayKey(),
      is_active: Boolean(account.is_active),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const totals = accounts.reduce(
    (acc, account) => {
      if (!account.is_active) return acc;
      acc[account.entity_code] = (acc[account.entity_code] || 0) + Number(account.current_balance || 0);
      return acc;
    },
    { TOLAN: 0, ALMALQA: 0 }
  );

  return (
    <div className="cb-shell" dir="rtl">
      <Sidebar />
      <main className="cb-dashboard">
        <header className="cb-topbar">
          <div>
            <h1 className="cb-welcome-title">أرصدة البنوك والمحافظ</h1>
            <p className="cb-welcome-subtitle">تعريف حسابات تولان والملقا وتثبيت رصيد البداية ومتابعة الرصيد بعد آخر حركة</p>
          </div>
          <a href="/treasury" className="cb-outline-button">الإدخال اليومي</a>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <article className="cb-panel"><div className="cb-panel-body"><div className="text-sm text-gray-500">إجمالي أرصدة تولان</div><div className="text-3xl font-bold text-[#4b4a24] mt-2">{money(totals.TOLAN)} ر.س</div></div></article>
          <article className="cb-panel"><div className="cb-panel-body"><div className="text-sm text-gray-500">إجمالي أرصدة الملقا</div><div className="text-3xl font-bold text-[#4b4a24] mt-2">{money(totals.ALMALQA)} ر.س</div></div></article>
        </section>

        {canManage && (
          <section className="cb-panel mb-5">
            <div className="cb-panel-body">
              <div className="cb-panel-head">
                <div><h2 className="cb-panel-title">{editId ? "تعديل الحساب" : "إضافة حساب جديد"}</h2><p className="cb-panel-subtitle">ضع الرصيد الحقيقي في تاريخ البداية، وبعده يحسب البرنامج كل حركة تلقائيًا</p></div>
              </div>
              <form onSubmit={saveAccount} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3 items-end">
                <div>
                  <label className="block mb-2 text-sm font-bold">الجهة</label>
                  <select value={form.entity_code} onChange={(e) => setForm({ ...form, entity_code: e.target.value })} disabled={Boolean(editId)} className="w-full border rounded-lg p-3 disabled:bg-gray-100">
                    <option value="TOLAN">تولان</option><option value="ALMALQA">الملقا</option>
                  </select>
                </div>
                <div className="xl:col-span-2">
                  <label className="block mb-2 text-sm font-bold">اسم الحساب</label>
                  <input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} placeholder="مثال: محفظة هلا - تولان" className="w-full border rounded-lg p-3" required />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-bold">النوع</label>
                  <select value={form.account_type} onChange={(e) => setForm({ ...form, account_type: e.target.value })} className="w-full border rounded-lg p-3">
                    <option value="BANK">بنك</option><option value="WALLET">محفظة</option><option value="OTHER">حساب آخر</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-2 text-sm font-bold">رصيد البداية</label>
                  <input type="number" step="0.01" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} className="w-full border rounded-lg p-3" required />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-bold">تاريخ البداية</label>
                  <input type="date" value={form.opening_date} onChange={(e) => setForm({ ...form, opening_date: e.target.value })} className="w-full border rounded-lg p-3" required />
                </div>
                {editId && (
                  <label className="flex items-center gap-2 font-bold md:col-span-2 xl:col-span-1">
                    <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> فعال
                  </label>
                )}
                <div className="flex gap-2 md:col-span-2 xl:col-span-6">
                  <button type="submit" disabled={saving} className="px-7 py-3 rounded-lg bg-[#c28b2c] text-white font-bold disabled:bg-gray-400">{saving ? "جاري الحفظ..." : editId ? "حفظ التعديل" : "إضافة الحساب"}</button>
                  {editId && <button type="button" onClick={reset} className="px-7 py-3 rounded-lg border font-bold">إلغاء</button>}
                </div>
              </form>
              {message && <div className="mt-4 rounded-lg bg-[#f6f0e4] border border-[#e7d7b5] p-3 font-bold">{message}</div>}
            </div>
          </section>
        )}

        <section className="cb-panel">
          <div className="cb-panel-body">
            <div className="cb-panel-head"><div><h2 className="cb-panel-title">الحسابات الحالية</h2><p className="cb-panel-subtitle">الرصيد الظاهر هو الرصيد بعد آخر حركة محفوظة</p></div><button onClick={loadAccounts} className="cb-outline-button">تحديث</button></div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead><tr className="border-b bg-[#faf6ed]"><th className="p-3">الجهة</th><th className="p-3">الحساب</th><th className="p-3">النوع</th><th className="p-3">رصيد البداية</th><th className="p-3">تاريخ البداية</th><th className="p-3">الرصيد بعد آخر حركة</th><th className="p-3">الحالة</th><th className="p-3">الإجراء</th></tr></thead>
                <tbody>
                  {accounts.length === 0 ? <tr><td colSpan="8" className="p-8 text-center text-gray-500">{loading ? "جاري التحميل..." : "لا توجد حسابات"}</td></tr> : accounts.map((account) => (
                    <tr key={account.id} className="border-b">
                      <td className="p-3 font-bold">{entityName(account.entity_code)}</td>
                      <td className="p-3 font-bold">{account.name_ar}</td>
                      <td className="p-3">{typeName(account.account_type)}</td>
                      <td className="p-3">{money(account.opening_balance)} ر.س</td>
                      <td className="p-3">{account.opening_date}</td>
                      <td className="p-3 font-bold text-[#4b4a24]">{money(account.current_balance)} ر.س</td>
                      <td className="p-3"><span className={`px-3 py-1 rounded-full font-bold ${account.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>{account.is_active ? "فعال" : "متوقف"}</span></td>
                      <td className="p-3">{canManage ? <button onClick={() => editAccount(account)} className="px-3 py-2 rounded-lg border border-[#9a7a3c] font-bold">تعديل</button> : "عرض فقط"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
