"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../../../components/Sidebar";
import { apiFetch } from "../../../lib/api";

const dateKey = (value) => {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-CA");
};

export default function TransactionsListPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [cashboxes, setCashboxes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const canManage = role === "CEO" || role === "MANAGER";

  const loadTransactions = async () => {
    const res = await apiFetch("/api/transactions");
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
    setTransactions(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    let user = {};
    try { user = JSON.parse(localStorage.getItem("user") || "{}"); } catch {}
    if (!["CEO", "MANAGER", "ACCOUNTANT"].includes(user.role)) {
      router.replace("/dashboard");
      return;
    }
    setRole(user.role || "");

    loadTransactions().catch((err) => {
      console.error(err);
      setMessage("تعذر تحميل العمليات المالية");
    });

    if (user.role === "CEO" || user.role === "MANAGER") {
      Promise.all([
        apiFetch("/api/master-data/cashboxes").then((res) => res.json()),
        apiFetch("/api/master-data/categories").then((res) => res.json()),
      ]).then(([cashboxData, categoryData]) => {
        setCashboxes(Array.isArray(cashboxData) ? cashboxData : []);
        setCategories(Array.isArray(categoryData) ? categoryData : []);
      }).catch(console.error);
    }
  }, [router]);

  const filteredTransactions = useMemo(() => {
    const needle = search.toLowerCase();
    return transactions.filter((item) => {
      const text = `${item.id} ${item.type} ${item.amount} ${item.description || ""} ${item.cashbox || ""} ${item.category || ""} ${item.created_by || ""} ${item.balance_after || ""}`.toLowerCase();
      return text.includes(needle);
    });
  }, [transactions, search]);

  const editCategories = useMemo(() => {
    if (!editing) return [];
    return categories.filter((category) =>
      editing.type === "IN" ? category.type === "INCOME" : category.type === "EXPENSE"
    );
  }, [editing, categories]);

  const beginEdit = (item) => {
    setMessage("");
    setEditing({
      id: item.id,
      type: item.type,
      amount: String(item.amount),
      description: item.description || "",
      transaction_date: dateKey(item.transaction_date),
      cashbox_id: String(item.cashbox_id),
      category_id: String(item.category_id),
    });
  };

  const changeEditType = (nextType) => {
    const firstCategory = categories.find((category) =>
      nextType === "IN" ? category.type === "INCOME" : category.type === "EXPENSE"
    );
    setEditing((current) => ({
      ...current,
      type: nextType,
      category_id: firstCategory ? String(firstCategory.id) : "",
    }));
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await apiFetch(`/api/transactions/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: editing.type,
          amount: Number(editing.amount),
          description: editing.description,
          cashbox_id: Number(editing.cashbox_id),
          category_id: Number(editing.category_id),
          transaction_date: editing.transaction_date,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "تعذر تعديل الحركة");
      setEditing(null);
      setMessage("تم تعديل الحركة وإعادة احتساب الرصيد بنجاح");
      await loadTransactions();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء التعديل");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    if (!confirm(`هل تريد حذف الحركة رقم ${item.id}؟\nسيتم الاحتفاظ بها في سجل المراجعة.`)) return;
    setMessage("");
    try {
      const response = await apiFetch(`/api/transactions/${item.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "تعذر حذف الحركة");
      setMessage("تم حذف الحركة وإعادة احتساب الرصيد مع الاحتفاظ بسجل المراجعة");
      await loadTransactions();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء الحذف");
    }
  };

  return (
    <div className="cb-shell" dir="rtl">
      <Sidebar />
      <main className="cb-dashboard">
        <header className="cb-topbar">
          <div>
            <h1 className="cb-welcome-title">العمليات المالية</h1>
            <p className="cb-welcome-subtitle">عرض الحركات والرصيد بعد كل عملية</p>
          </div>
        </header>

        {canManage && editing && (
          <section className="cb-panel mb-5">
            <div className="cb-panel-body">
              <div className="cb-panel-head"><h2 className="cb-panel-title">تعديل الحركة رقم {editing.id}</h2></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className="block mb-2 font-bold">نوع العملية</label><select value={editing.type} onChange={(e) => changeEditType(e.target.value)} className="w-full border p-3 rounded-lg"><option value="IN">إيراد / قبض</option><option value="OUT">مصروف / صرف</option></select></div>
                <div><label className="block mb-2 font-bold">التاريخ</label><input type="date" value={editing.transaction_date} onChange={(e) => setEditing({ ...editing, transaction_date: e.target.value })} className="w-full border p-3 rounded-lg" /></div>
                <div><label className="block mb-2 font-bold">المبلغ</label><input type="number" min="0.01" step="0.01" value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: e.target.value })} className="w-full border p-3 rounded-lg" /></div>
                <div><label className="block mb-2 font-bold">الصندوق</label><select value={editing.cashbox_id} onChange={(e) => setEditing({ ...editing, cashbox_id: e.target.value })} className="w-full border p-3 rounded-lg">{cashboxes.map((box) => <option key={box.id} value={box.id}>{box.name_ar}</option>)}</select></div>
                <div><label className="block mb-2 font-bold">التصنيف</label><select value={editing.category_id} onChange={(e) => setEditing({ ...editing, category_id: e.target.value })} className="w-full border p-3 rounded-lg">{editCategories.map((category) => <option key={category.id} value={category.id}>{category.name_ar}</option>)}</select></div>
                <div><label className="block mb-2 font-bold">البيان</label><input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="w-full border p-3 rounded-lg" /></div>
              </div>
              <div className="flex gap-3 mt-5">
                <button type="button" onClick={saveEdit} disabled={saving} className="bg-[#4b4a24] text-white px-6 py-3 rounded-lg font-bold">{saving ? "جاري الحفظ..." : "حفظ التعديل"}</button>
                <button type="button" onClick={() => setEditing(null)} className="border px-6 py-3 rounded-lg font-bold">إلغاء</button>
              </div>
            </div>
          </section>
        )}

        <section className="cb-panel">
          <div className="cb-panel-body">
            <input type="text" placeholder="بحث برقم الحركة أو الصندوق أو البيان..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full border rounded-lg p-3 mb-5" />
            {message && <div className="mb-4 rounded-lg bg-[#f6f0e4] border border-[#e7d7b5] p-3 font-bold">{message}</div>}

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead><tr className="border-b bg-[#faf6ed]"><th className="p-3">ID</th><th className="p-3">التاريخ</th><th className="p-3">الصندوق</th><th className="p-3">التصنيف</th><th className="p-3">المستخدم</th><th className="p-3">النوع</th><th className="p-3">المبلغ</th><th className="p-3">البيان</th><th className="p-3">الرصيد بعد العملية</th>{canManage && <th className="p-3">إدارة</th>}</tr></thead>
                <tbody>
                  {filteredTransactions.length === 0 ? (
                    <tr><td colSpan={canManage ? 10 : 9} className="p-8 text-center text-gray-500">لا توجد نتائج</td></tr>
                  ) : filteredTransactions.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-[#fffdf8]">
                      <td className="p-3">{item.id}</td>
                      <td className="p-3">{dateKey(item.transaction_date) || "-"}</td>
                      <td className="p-3">{item.cashbox}</td>
                      <td className="p-3">{item.category}</td>
                      <td className="p-3">{item.created_by}</td>
                      <td className="p-3"><span className={`px-3 py-1 rounded-full text-white ${item.type === "IN" ? "bg-green-700" : "bg-red-700"}`}>{item.type === "IN" ? "إيراد" : "مصروف"}</span></td>
                      <td className="p-3 font-bold">{Number(item.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                      <td className="p-3">{item.description || "-"}</td>
                      <td className="p-3 font-bold text-[#4b4a24]">{Number(item.balance_after || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س</td>
                      {canManage && <td className="p-3"><div className="flex gap-2"><button onClick={() => beginEdit(item)} className="px-3 py-2 rounded-lg bg-[#64748B] text-white font-bold">تعديل</button><button onClick={() => remove(item)} className="px-3 py-2 rounded-lg bg-red-700 text-white font-bold">حذف</button></div></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredTransactions.length > 0 && (
              <div className="mt-5 rounded-xl bg-[#f4ead6] border border-[#d7b36c] p-4 flex justify-between items-center gap-3 flex-wrap">
                <strong>الرصيد بعد آخر حركة ظاهرة</strong>
                <strong className="text-2xl text-[#4b4a24]">{Number(filteredTransactions[0]?.balance_after || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س</strong>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
