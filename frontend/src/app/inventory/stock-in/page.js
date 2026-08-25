"use client";

import { useEffect, useState } from "react";
import Sidebar from "../../../components/Sidebar";
import { apiFetch } from "../../../lib/api";

const localDate = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export default function StockInPage() {
  const [items, setItems] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [movementDate, setMovementDate] = useState(localDate());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadItems = () => {
    apiFetch("/api/inventory/stock")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch((err) => {
        console.error("Inventory Error:", err);
        setError("تعذر تحميل أصناف المستودع");
      });
  };

  useEffect(() => {
    loadItems();
  }, []);

  const saveStockIn = async () => {
    setMessage("");
    setError("");

    const entries = items
      .map((item) => ({ item, qty: Number(quantities[item.id] || 0) }))
      .filter(({ qty }) => qty > 0);

    if (entries.length === 0) {
      setError("أدخل كمية واحدة على الأقل");
      return;
    }

    if (entries.some(({ qty }) => !Number.isInteger(qty))) {
      setError("الكمية يجب أن تكون رقمًا صحيحًا");
      return;
    }

    try {
      setSaving(true);
      for (const { item, qty } of entries) {
        const response = await apiFetch("/api/inventory/stock-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_id: item.id, quantity: qty, movement_date: movementDate }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "تعذر حفظ الإدخال");
      }

      setQuantities({});
      setMessage("تم تسجيل إدخال المخزون بنجاح");
      loadItems();
    } catch (err) {
      console.error("Stock In Save Error:", err);
      setError(err.message || "حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cb-shell" dir="rtl">
      <Sidebar />
      <main className="cb-dashboard cb-warehouse-dashboard">
        <header className="cb-topbar">
          <div>
            <h1 className="cb-welcome-title"><span aria-hidden="true">⬆️</span> إدخال للمخزون</h1>
            <p className="cb-welcome-subtitle">تسجيل الكروت أو الأساور التي دخلت إلى المستودع</p>
          </div>
        </header>

        <section className="cb-panel cb-inventory-form-panel">
          <div className="cb-panel-body">
            <div className="cb-inventory-date-field">
              <label htmlFor="stock-in-date">تاريخ الإدخال</label>
              <input id="stock-in-date" type="date" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} />
            </div>

            <div className="cb-inventory-entry-list">
              {items.map((item) => (
                <div key={item.id} className="cb-inventory-entry-row">
                  <div>
                    <strong>{item.name}</strong>
                    <small>المتوفر حاليًا: {Number(item.stock || 0).toLocaleString("en-US")} {item.unit}</small>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={quantities[item.id] || ""}
                    placeholder="الكمية الداخلة"
                    onChange={(e) => setQuantities((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            {message && <div className="cb-form-message success">{message}</div>}
            {error && <div className="cb-form-message error">{error}</div>}

            <button type="button" onClick={saveStockIn} disabled={saving} className="cb-inventory-submit in">
              {saving ? "جاري الحفظ..." : "حفظ إدخال المخزون"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
