"use client";

import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { apiFetch } from "../../lib/api";

export default function TransactionsPage() {
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

  useEffect(() => {
    Promise.all([
      apiFetch("/api/master-data/cashboxes").then((res) => res.json()),
      apiFetch("/api/master-data/categories").then((res) => res.json()),
    ])
      .then(([cashboxData, categoryData]) => {
        setCashboxes(cashboxData);
        setCategories(categoryData);
        if (cashboxData.length > 0) {
          setCashboxId(String(cashboxData[0].id));
        }
      })
      .catch((error) => {
        console.error("Master data error:", error);
        setMessage("تعذر تحميل الصناديق أو التصنيفات");
      });
  }, []);

  const filteredCategories = categories.filter((category) =>
    type === "IN"
      ? category.type === "INCOME"
      : category.type === "EXPENSE"
  );

  useEffect(() => {
    setCategoryId(
      filteredCategories.length > 0
        ? String(filteredCategories[0].id)
        : ""
    );
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
        setMessage("تم حفظ العملية بنجاح");
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

  return (
    <div className="flex" dir="rtl">
      <Sidebar />

      <main className="flex-1 min-h-screen bg-gray-100 p-8">
        <div className="max-w-xl mx-auto bg-white p-8 rounded-xl shadow">
          <h1 className="text-3xl font-bold mb-6 text-center">
            إضافة عملية مالية
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block mb-2 font-bold">نوع العملية</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full border p-3 rounded-lg"
              >
                <option value="IN">إيراد / سند قبض</option>
                <option value="OUT">مصروف / سند صرف</option>
              </select>
            </div>

            <div>
              <label className="block mb-2 font-bold">تاريخ العملية</label>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full border p-3 rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block mb-2 font-bold">الصندوق</label>
              <select
                value={cashboxId}
                onChange={(e) => setCashboxId(e.target.value)}
                className="w-full border p-3 rounded-lg"
                required
              >
                {cashboxes.map((cashbox) => (
                  <option key={cashbox.id} value={cashbox.id}>
                    {cashbox.name_ar}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-2 font-bold">التصنيف</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full border p-3 rounded-lg"
                required
              >
                {filteredCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name_ar}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-2 font-bold">المبلغ</label>
              <input
                type="number"
                placeholder="أدخل المبلغ"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full border p-3 rounded-lg"
                min="0.01"
                step="0.01"
                required
              />
            </div>

            <div>
              <label className="block mb-2 font-bold">البيان</label>
              <input
                type="text"
                placeholder="أدخل البيان"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border p-3 rounded-lg"
              />
            </div>

            <button
              type="submit"
              disabled={saving || !cashboxId || !categoryId}
              className="w-full bg-blue-600 disabled:bg-gray-400 text-white p-3 rounded-lg"
            >
              {saving ? "جاري الحفظ..." : "حفظ العملية"}
            </button>

            {message && (
              <p className="text-center font-bold">{message}</p>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
