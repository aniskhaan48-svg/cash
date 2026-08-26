"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { apiFetch } from "../../lib/api";

const GROUP_LABELS = {
  INCOME: "الإيرادات",
  EXPENSE: "المصروفات",
  ASSET: "الأصول",
};

export default function TransactionsPage() {
  const [role, setRole] = useState("");
  const [type, setType] = useState("IN");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [cashboxes, setCashboxes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cashboxId, setCashboxId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountGroup, setNewAccountGroup] = useState("INCOME");
  const [savingAccount, setSavingAccount] = useState(false);

  const canManageAccounts = role === "CEO" || role === "MANAGER";

  const loadCategories = async () => {
    const res = await apiFetch("/api/master-data/categories");
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "تعذر تحميل الحسابات");
    setCategories(Array.isArray(data) ? data : []);
    return Array.isArray(data) ? data : [];
  };

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      setRole(user.role || "");
    } catch {}

    Promise.all([
      apiFetch("/api/master-data/cashboxes").then((res) => res.json()),
      apiFetch("/api/master-data/categories").then((res) => res.json()),
    ])
      .then(([cashboxData, categoryData]) => {
        setCashboxes(Array.isArray(cashboxData) ? cashboxData : []);
        setCategories(Array.isArray(categoryData) ? categoryData : []);
        if (cashboxData.length > 0) setCashboxId(String(cashboxData[0].id));
      })
      .catch((error) => {
        console.error("Master data error:", error);
        setMessage("تعذر تحميل الصناديق أو الحسابات");
      });
  }, []);

  const filteredCategories = useMemo(
    () =>
      categories.filter((category) =>
        type === "IN" ? category.type === "INCOME" : category.type === "EXPENSE"
      ),
    [type, categories]
  );

  const groupedCategories = useMemo(() => {
    const result = [];
    const groups = type === "IN" ? ["INCOME"] : ["EXPENSE", "ASSET"];
    for (const group of groups) {
      const items = filteredCategories.filter(
        (category) =>
          (category.account_group || (category.type === "INCOME" ? "INCOME" : "EXPENSE")) === group
      );
      if (items.length) result.push({ group, items });
    }
    return result;
  }, [filteredCategories, type]);

  useEffect(() => {
    setCategoryId(filteredCategories.length ? String(filteredCategories[0].id) : "");
    setNewAccountGroup(type === "IN" ? "INCOME" : "EXPENSE");
  }, [type, categories]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setSaving(true);

    try {
      const response = await apiFetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cashbox_id: Number(cashboxId),
          category_id: Number(categoryId),
          type,
          amount: Number(amount),
          description,
          transaction_date: transactionDate,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage(`تم حفظ العملية بنجاح — الرصيد بعد العملية: ${Number(data.transaction?.balance_after || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`);
        setAmount("");
        setDescription("");
      } else {
        setMessage(data.message || "حدث خطأ أثناء حفظ العملية");
      }
    } catch (error) {
      console.error("Save transaction error:", error);
      setMessage("خطأ في الاتصال بالخادم");
    } finally {
      setSaving(false);
    }
  };

  const saveNewAccount = async () => {
    const name = newAccountName.trim();
    if (!name) {
      setMessage("اكتب اسم الحساب أولًا");
      return;
    }

    setSavingAccount(true);
    setMessage("");
    try {
      const response = await apiFetch("/api/master-data/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name_ar: name,
          account_group: newAccountGroup,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "تعذر حفظ الحساب");

      const list = await loadCategories();
      const createdId = data.category?.id;
      if (createdId && list.some((item) => item.id === createdId)) {
        setCategoryId(String(createdId));
      }
      setNewAccountName("");
      setShowNewAccount(false);
      setMessage(`تم إنشاء الحساب: ${name}`);
    } catch (error) {
      setMessage(error.message || "تعذر حفظ الحساب");
    } finally {
      setSavingAccount(false);
    }
  };

  return (
    <div className="cb-shell" dir="rtl">
      <Sidebar />

      <main className="cb-dashboard">
        <header className="cb-topbar">
          <div>
            <h1 className="cb-welcome-title">إضافة عملية مالية</h1>
            <p className="cb-welcome-subtitle">اختر الحساب ثم أدخل المبلغ والبيان واحفظ الحركة</p>
          </div>
        </header>

        <section className="cb-panel max-w-2xl mx-auto">
          <div className="cb-panel-body">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block mb-2 font-bold">نوع العملية</label>
                <select value={type} onChange={(e) => setType(e.target.value)} className="w-full border p-3 rounded-lg">
                  <option value="IN">إيراد / سند قبض</option>
                  <option value="OUT">مصروف / سند صرف</option>
                </select>
              </div>

              <div>
                <label className="block mb-2 font-bold">تاريخ العملية</label>
                <input type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} className="w-full border p-3 rounded-lg" required />
              </div>

              <div>
                <label className="block mb-2 font-bold">الصندوق</label>
                <select value={cashboxId} onChange={(e) => setCashboxId(e.target.value)} className="w-full border p-3 rounded-lg" required>
                  {cashboxes.map((cashbox) => <option key={cashbox.id} value={cashbox.id}>{cashbox.name_ar}</option>)}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <label className="font-bold">الحساب</label>
                  {canManageAccounts && (
                    <button
                      type="button"
                      onClick={() => setShowNewAccount((value) => !value)}
                      className="text-sm font-bold px-3 py-2 rounded-lg border border-[#b88a36] text-[#66501f] bg-[#fffaf0]"
                    >
                      {showNewAccount ? "إلغاء" : "+ حساب جديد"}
                    </button>
                  )}
                </div>

                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full border p-3 rounded-lg" required>
                  {groupedCategories.length === 0 && <option value="">لا توجد حسابات متاحة</option>}
                  {groupedCategories.map(({ group, items }) => (
                    <optgroup key={group} label={GROUP_LABELS[group]}>
                      {items.map((category) => <option key={category.id} value={category.id}>{category.name_ar}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>

              {canManageAccounts && showNewAccount && (
                <div className="rounded-xl border border-[#d7b36c] bg-[#fffaf0] p-4 space-y-3">
                  <div className="font-bold text-[#4b4a24]">إضافة حساب جديد إلى دليل الحسابات</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block mb-2 text-sm font-bold">مجموعة الحساب</label>
                      <select value={newAccountGroup} onChange={(e) => setNewAccountGroup(e.target.value)} className="w-full border p-3 rounded-lg">
                        {type === "IN" ? (
                          <option value="INCOME">الإيرادات</option>
                        ) : (
                          <>
                            <option value="EXPENSE">المصروفات</option>
                            <option value="ASSET">الأصول</option>
                          </>
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="block mb-2 text-sm font-bold">اسم الحساب</label>
                      <input
                        type="text"
                        value={newAccountName}
                        onChange={(e) => setNewAccountName(e.target.value)}
                        placeholder="مثال: مصاريف النقليات"
                        className="w-full border p-3 rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="text-xs text-gray-600">أمثلة: مصاريف الكهرباء، رسوم الشحن، ضيافة، أجهزة ومعدات، أثاث.</div>
                  <button type="button" onClick={saveNewAccount} disabled={savingAccount} className="px-5 py-3 rounded-lg bg-[#4b4a24] text-white font-bold disabled:opacity-50">
                    {savingAccount ? "جاري الحفظ..." : "حفظ الحساب واختياره"}
                  </button>
                </div>
              )}

              <div>
                <label className="block mb-2 font-bold">المبلغ</label>
                <input type="number" placeholder="أدخل المبلغ" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full border p-3 rounded-lg" min="0.01" step="0.01" required />
              </div>

              <div>
                <label className="block mb-2 font-bold">البيان</label>
                <input type="text" placeholder="مثال: فاتورة كهرباء شهر أغسطس" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border p-3 rounded-lg" />
              </div>

              <button type="submit" disabled={saving || !cashboxId || !categoryId} className="w-full bg-[#4b4a24] disabled:bg-gray-400 text-white p-3 rounded-lg font-bold">
                {saving ? "جاري الحفظ..." : "حفظ العملية"}
              </button>

              {message && <p className="text-center font-bold rounded-lg bg-[#f6f0e4] border border-[#e7d7b5] p-3">{message}</p>}
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
