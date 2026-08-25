"use client";

import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { apiFetch } from "../../lib/api";

export default function InventoryPage() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    apiFetch("/api/inventory/stock")
      .then((res) => res.json())
      .then((data) => setItems(data))
      .catch((err) => console.error(err));
  }, []);

  return (
    <div className="flex" dir="rtl">
      <Sidebar />

      <main className="flex-1 min-h-screen bg-gray-100 p-8">
        <h1 className="text-4xl font-bold text-center mb-8">
          Inventory Stock
        </h1>

        <div className="max-w-5xl mx-auto bg-white rounded-xl shadow p-6">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="p-3">ID</th>
                <th className="p-3">Item</th>
                <th className="p-3">Unit</th>
                <th className="p-3">Stock</th>
              </tr>
            </thead>

            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="p-3">{item.id}</td>
                  <td className="p-3">{item.name}</td>
                  <td className="p-3">{item.unit}</td>
                  <td className="p-3 font-bold">{item.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}