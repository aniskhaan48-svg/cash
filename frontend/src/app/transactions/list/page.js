"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../../components/Sidebar";
import { apiFetch } from "../../../lib/api";

export default function TransactionsListPage() {
  const [transactions, setTransactions] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    apiFetch("/api/transactions")
      .then((res) => res.json())
      .then((data) => setTransactions(data))
      .catch((err) => console.error(err));
  }, []);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((item) => {
      const text = `
        ${item.id}
        ${item.type}
        ${item.amount}
        ${item.description || ""}
        ${item.cashbox || ""}
        ${item.category || ""}
        ${item.created_by || ""}
      `.toLowerCase();

      return text.includes(search.toLowerCase());
    });
  }, [transactions, search]);

  return (
    <div className="flex" dir="rtl">
      <Sidebar />

      <main className="flex-1 min-h-screen bg-gray-100 p-8">

        <h1 className="text-4xl font-bold text-center mb-8">
          العمليات المالية
        </h1>

        <div className="max-w-7xl mx-auto bg-white rounded-xl shadow p-6">

          <input
            type="text"
            placeholder="بحث..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border rounded-lg p-3 mb-6"
          />

          <table className="w-full border-collapse">

            <thead>
              <tr className="border-b bg-gray-100">
                <th className="p-3">ID</th>
                <th className="p-3">التاريخ</th>
                <th className="p-3">الصندوق</th>
                <th className="p-3">التصنيف</th>
                <th className="p-3">المستخدم</th>
                <th className="p-3">النوع</th>
                <th className="p-3">المبلغ</th>
                <th className="p-3">البيان</th>
              </tr>
            </thead>

            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-6 text-center text-gray-500">
                    لا توجد نتائج
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">

                    <td className="p-3">{item.id}</td>

                    <td className="p-3">
                      {item.transaction_date
                        ? new Date(item.transaction_date).toLocaleDateString("en-CA")
                        : "-"}
                    </td>

                    <td className="p-3">
                      {item.cashbox}
                    </td>

                    <td className="p-3">
                      {item.category}
                    </td>

                    <td className="p-3">
                      {item.created_by}
                    </td>

                    <td className="p-3">
                      <span
                        className={`px-3 py-1 rounded-full text-white ${
                          item.type === "IN"
                            ? "bg-green-600"
                            : "bg-red-600"
                        }`}
                      >
                        {item.type === "IN" ? "إيراد" : "مصروف"}
                      </span>
                    </td>

                    <td className="p-3 font-bold">
                      {Number(item.amount).toLocaleString()}
                    </td>

                    <td className="p-3">
                      {item.description}
                    </td>

                  </tr>
                ))
              )}
            </tbody>

          </table>

        </div>

      </main>
    </div>
  );
}