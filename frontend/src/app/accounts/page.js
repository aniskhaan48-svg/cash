"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../../components/Sidebar";
import { apiFetch } from "../../lib/api";

const GROUPS = [
  { value: "EXPENSE", label: "المصروفات" },
  { value: "ASSET", label: "الأصول" },
  { value: "INCOME", label: "الإيرادات" },
];

const groupLabel = (value) => GROUPS.find((item) => item.value === value)?.label || value;

export default function AccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState([]);
  const [name, setName] = useState("");
  const [group, setGroup] = useState("EXPENSE");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("ALL");

  const load = async () => {
    const res = await apiFetch("/api/master-data/categories?all=1");
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "تعذر تحميل الحسابات");
    setAccounts(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    let user = {};
    try { user = JSON.parse(localStorage.getItem("user") || "{}"); } catch {}
    if (!["CEO", "MANAGER"].includes(user.role)) {
      router.replace("/dashboard");
      return;
    }
    load().catch((error) => setMessage(error.message));
  }, [router]);

  const visible = useMemo(
    () => filter === "ALL" ? accounts : accounts.filter((item) => item.account_group === filter),
    [accounts, filter]
  );

  const createAccount = async (event) => {
    event.preventDefault();
    if (!name.trim()) return setMessage("اكتب اسم الحساب");
    setSaving(true);
    setMessage("");
    try {
      const res = await apiFetch("/api/master-data/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name_ar: name.trim(), account_group: group }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "تعذر حفظ الحساب");
      setName("");
      setMessage("تم حفظ الحساب بنجاح");
      await load();
    } catch (error) {
      setMessage(error.message || "تعذر حفظ الحساب");
    } finally {
      setSaving(false);
    }
  };

  const toggleAccount = async (account) => {
    setMessage("");
    try {
      const res = await apiFetch(`/api/master-data/categories/${account.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !account.is_active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "تعذر تحديث الحساب");
      setMessage(account.is_active ? "تم إيقاف الحساب" : "تم تفعيل الحساب");
      await load();
    } catch (error) {
      setMessage(error.message || "تعذر تحديث الحساب");
    }
  };

  return (
    <div className="cb-shell" dir="rtl">
      <Sidebar />
      <main className="cb-dashboard">
        <header className="cb-topbar">
          <div>
            <h1 className="cb-welcome-title">دليل الحسابات</h1>
            <p className="cb-welcome-subtitle">أنشئ حسابات المصروفات والأصول والإيرادات ثم استخدمها عند تسجيل الحركات</p>
          </div>
        </header>

        <section className="cb-panel mb-5">
          <div className="cb-panel-body">
            <h2 className="cb-panel-title mb-4">إضافة حساب جديد</h2>
            <form onSubmit={createAccount} className="grid grid-cols-1 md:grid-cols-[220px_1fr_auto] gap-3 items-end">
              <div>
                <label className="block mb-2 font-bold">المجموعة</label>
                <select value={group} onChange={(e) => setGroup(e.target.value)} className="w-full border p-3 rounded-lg">
                  {GROUPS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block mb-2 font-bold">اسم الحساب</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: مصاريف النقليات" className="w-full border p-3 rounded-lg" />
              </div>
              <button disabled={saving} className="px-7 py-3 rounded-lg bg-[#4b4a24] text-white font-bold disabled:opacity-50">
                {saving ? "جاري الحفظ..." : "حفظ الحساب"}
              </button>
            </form>
            <div className="mt-3 text-sm text-gray-600">أمثلة: مصاريف النقليات، مصاريف الكهرباء، رسوم الشحن، ضيافة، أجهزة ومعدات، أثاث.</div>
          </div>
        </section>

        <section className="cb-panel">
          <div className="cb-panel-body">
            <div className="flex justify-between items-center gap-3 flex-wrap mb-4">
              <h2 className="cb-panel-title">الحسابات المسجلة</h2>
              <select value={filter} onChange={(e) => setFilter(e.target.value)} className="border p-2 rounded-lg">
                <option value="ALL">كل الحسابات</option>
                {GROUPS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>

            {message && <div className="mb-4 rounded-lg bg-[#f6f0e4] border border-[#e7d7b5] p-3 font-bold">{message}</div>}

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b bg-[#faf6ed]">
                    <th className="p-3 text-right">اسم الحساب</th>
                    <th className="p-3 text-right">المجموعة</th>
                    <th className="p-3 text-right">الحالة</th>
                    <th className="p-3 text-right">إدارة</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 ? (
                    <tr><td colSpan="4" className="p-8 text-center text-gray-500">لا توجد حسابات</td></tr>
                  ) : visible.map((account) => (
                    <tr key={account.id} className="border-b hover:bg-[#fffdf8]">
                      <td className="p-3 font-bold">{account.name_ar}</td>
                      <td className="p-3">{groupLabel(account.account_group)}</td>
                      <td className="p-3">
                        <span className={`px-3 py-1 rounded-full text-white ${account.is_active ? "bg-green-700" : "bg-gray-500"}`}>
                          {account.is_active ? "فعال" : "موقوف"}
                        </span>
                      </td>
                      <td className="p-3">
                        <button onClick={() => toggleAccount(account)} className="px-4 py-2 rounded-lg bg-[#64748B] text-white font-bold">
                          {account.is_active ? "إيقاف" : "تفعيل"}
                        </button>
                      </td>
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
