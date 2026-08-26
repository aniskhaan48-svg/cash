"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { apiFetch } from "../../lib/api";

const formatQty = (value) => Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });

function InventoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m21 8-9-5-9 5 9 5 9-5Z" />
      <path d="m3 8 9 5 9-5M3 8v8l9 5 9-5V8M12 13v8" />
    </svg>
  );
}

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadItems = () => {
    setLoading(true);
    setError("");
    apiFetch("/api/inventory/stock")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch((err) => {
        console.error("Inventory Error:", err);
        setError("تعذر تحميل بيانات المخزون");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadItems();
  }, []);

  return (
    <div className="cb-shell" dir="rtl">
      <Sidebar />

      <main className="cb-dashboard cb-warehouse-dashboard">
        <header className="cb-topbar">
          <div>
            <h1 className="cb-welcome-title"><span aria-hidden="true">📦</span> المخزون الحالي</h1>
            <p className="cb-welcome-subtitle">الرصيد الفعلي للكروت والأساور حسب حركة المستودع</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href="/inventory/stock-in" className="cb-outline-button">إدخال للمخزون</Link>
            <Link href="/inventory/consumption" className="cb-outline-button">الاستهلاك اليومي</Link>
            <Link href="/inventory/reports" className="cb-outline-button">تقارير المخزون</Link>
          </div>
        </header>

        {loading ? (
          <div className="cb-panel"><div className="cb-panel-body text-center">جاري تحميل المخزون...</div></div>
        ) : error ? (
          <div className="cb-panel"><div className="cb-panel-body text-center text-red-700">{error}</div></div>
        ) : (
          <section className="cb-warehouse-items cb-inventory-page-grid">
            {items.map((item) => (
              <article key={item.id} className="cb-warehouse-item-card cb-current-stock-card">
                <div className="cb-warehouse-item-top">
                  <div>
                    <div className="cb-warehouse-item-label">الصنف</div>
                    <h2>{item.name}</h2>
                  </div>
                  <div className="cb-warehouse-item-icon"><InventoryIcon /></div>
                </div>
                <div className="cb-warehouse-stock-number">{formatQty(item.stock)} <small>{item.unit}</small></div>
                <div className="cb-current-stock-caption">الرصيد المتاح الآن</div>
              </article>
            ))}
            {items.length === 0 && (
              <div className="cb-panel"><div className="cb-panel-body text-center">لا توجد أصناف مسجلة في المستودع</div></div>
            )}
          </section>
        )}

        <section className="cb-warehouse-actions cb-inventory-actions">
          <Link href="/inventory/stock-in" className="cb-warehouse-action in">
            <span className="cb-warehouse-action-icon">＋</span>
            <span><strong>إدخال للمخزون</strong><small>إضافة كروت أو أساور جديدة</small></span>
          </Link>
          <Link href="/inventory/consumption" className="cb-warehouse-action out">
            <span className="cb-warehouse-action-icon">−</span>
            <span><strong>الاستهلاك اليومي</strong><small>تسجيل الكمية المصروفة</small></span>
          </Link>
          <Link href="/inventory/reports" className="cb-warehouse-action neutral">
            <span className="cb-warehouse-action-icon">▤</span>
            <span><strong>التقارير</strong><small>التقرير اليومي والشهري</small></span>
          </Link>
        </section>
      </main>
    </div>
  );
}
