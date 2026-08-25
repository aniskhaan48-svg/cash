"use client";

import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { apiFetch } from "../../lib/api";

export default function DashboardPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    apiFetch("/api/dashboard")
      .then((res) => res.json())
      .then((result) => setData(result))
      .catch((err) => console.error(err));
  }, []);

  if (!data) {
    return <div className="p-10 text-center">جاري تحميل البيانات...</div>;
  }

  return (
    <div className="flex" dir="rtl">
      <Sidebar />

      <main className="flex-1 min-h-screen bg-gray-100 p-8">

        <h1 className="text-4xl font-bold text-center mb-8">
          لوحة التحكم
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">

          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="text-xl mb-2">الرصيد الحالي</h2>
            <p className="text-3xl font-bold">
              {data.currentBalance}
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="text-xl mb-2">إجمالي الإيرادات</h2>
            <p className="text-3xl font-bold">
              {data.todayIncome}
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="text-xl mb-2">إجمالي المصروفات</h2>
            <p className="text-3xl font-bold">
              {data.todayExpense}
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="text-xl mb-2">عدد العمليات</h2>
            <p className="text-3xl font-bold">
              {data.todayTransactions}
            </p>
          </div>

        </div>

      </main>
    </div>
  );
}