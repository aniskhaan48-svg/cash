"use client";

import { useEffect, useState } from "react";
import Sidebar from "../../../components/Sidebar";
import { apiFetch } from "../../../lib/api";

export default function ConsumptionPage() {
  const [items, setItems] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [movementDate, setMovementDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [saving, setSaving] = useState(false);

  const loadItems = () => {
    apiFetch("/api/inventory/stock")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setItems(data))
      .catch((err) => console.error("Inventory Error:", err));
  };

  useEffect(() => {
    loadItems();
  }, []);

  const saveConsumption = async () => {
    try {
      setSaving(true);

      const entries = items
        .map((item) => ({
          item,
          qty: Number(quantities[item.id] || 0),
        }))
        .filter(({ qty }) => qty > 0);

      if (entries.length === 0) {
        alert("أدخل كمية واحدة على الأقل");
        return;
      }

      for (const { item, qty } of entries) {
        const response = await apiFetch("/api/inventory/consumption", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            item_id: item.id,
            quantity: qty,
            movement_date: movementDate,
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message || "تعذر حفظ الاستهلاك");
        }
      }

      setQuantities({});
      loadItems();
      alert("تم حفظ الاستهلاك بنجاح");
    } catch (error) {
      console.error("Consumption Save Error:", error);
      alert(error.message || "حدث خطأ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex" dir="rtl">
      <Sidebar />

      <main className="flex-1 min-h-screen bg-gray-100 p-8">
        <h1 className="text-4xl font-bold text-center mb-8">الاستهلاك اليومي</h1>

        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow p-6">
          <div className="mb-6">
            <label className="block mb-2 font-bold">تاريخ الاستهلاك</label>
            <input
              type="date"
              value={movementDate}
              onChange={(e) => setMovementDate(e.target.value)}
              className="border p-3 rounded-lg w-full"
            />
          </div>

          {items.map((item) => (
            <div key={item.id} className="grid grid-cols-3 gap-4 mb-4 items-center">
              <div className="font-bold">{item.name}</div>
              <div className="text-gray-500">المتاح: {item.stock} {item.unit}</div>
              <input
                type="number"
                min="0"
                max={Math.max(0, item.stock)}
                value={quantities[item.id] || ""}
                className="border p-3 rounded-lg"
                placeholder="الكمية"
                onChange={(e) =>
                  setQuantities({
                    ...quantities,
                    [item.id]: e.target.value,
                  })
                }
              />
            </div>
          ))}

          <button
            onClick={saveConsumption}
            disabled={saving}
            className="bg-red-600 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg"
          >
            {saving ? "جاري الحفظ..." : "حفظ الاستهلاك"}
          </button>
        </div>
      </main>
    </div>
  );
}
