"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { apiFetch } from "../../lib/api";

const SvgIcon = ({ type }) => {
  const common = {
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    width: 22,
    height: 22,
    "aria-hidden": "true",
  };

  const icons = {
    wallet: <><path d="M4 7h14a2 2 0 0 1 2 2v9H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h11"/><path d="M15 11h6v4h-6a2 2 0 0 1 0-4Z"/></>,
    up: <><path d="m6 15 6-6 6 6"/><path d="M12 9v10"/></>,
    down: <><path d="m6 9 6 6 6-6"/><path d="M12 5v10"/></>,
    count: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 20a6 6 0 0 1 12 0M14 15a5 5 0 0 1 7 5"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    arrowUp: <><path d="M12 19V5M7 10l5-5 5 5"/></>,
    arrowDown: <><path d="M12 5v14M7 14l5 5 5-5"/></>,
  };

  return <svg {...common}>{icons[type]}</svg>;
};

const formatMoney = (value) => Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [user, setUser] = useState({});

  useEffect(() => {
    try {
      setUser(JSON.parse(localStorage.getItem("user") || "{}"));
    } catch {
      setUser({});
    }

    apiFetch("/api/dashboard")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((result) => setData(result))
      .catch((err) => console.error("Dashboard Error:", err));
  }, []);

  const performance = useMemo(() => {
    if (!data) return { income: 0, expense: 0 };
    const income = Math.max(0, Number(data.todayIncome || 0));
    const expense = Math.max(0, Number(data.todayExpense || 0));
    const max = Math.max(income, expense, 1);
    return {
      income: Math.max(3, (income / max) * 100),
      expense: Math.max(3, (expense / max) * 100),
    };
  }, [data]);

  if (!data) {
    return <div className="cb-loading">جاري تحميل بيانات الصندوق...</div>;
  }

  const displayName = user.full_name || user.fullName || user.username || "المدير";
  const initial = String(displayName).trim().charAt(0) || "م";
  const roleLabel = user.role === "CEO" ? "المالك" : user.role === "MANAGER" ? "مدير النظام" : user.role === "ACCOUNTANT" ? "محاسب" : "مستخدم";
  const recent = (data.lastTransactions || []).slice(0, 5);

  return (
    <div className="cb-shell" dir="rtl">
      <Sidebar />

      <main className="cb-dashboard">
        <header className="cb-topbar">
          <div>
            <h1 className="cb-welcome-title"><span aria-hidden="true">👋</span> مرحباً {displayName}</h1>
            <p className="cb-welcome-subtitle">إليك نظرة عامة على أداء الصندوق والحركة المالية</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="cb-period-chip"><SvgIcon type="calendar" /> هذا الشهر</div>
            <div className="cb-user-chip">
              <div className="cb-user-avatar">{initial}</div>
              <div>
                <div className="cb-user-name">{displayName}</div>
                <div className="cb-user-role">{roleLabel}</div>
              </div>
            </div>
          </div>
        </header>

        <section className="cb-kpis" aria-label="المؤشرات الرئيسية">
          <article className="cb-kpi">
            <div className="cb-kpi-head">
              <div>
                <div className="cb-kpi-label">الرصيد الحالي</div>
                <div className="cb-kpi-value">{formatMoney(data.currentBalance)}</div>
              </div>
              <div className="cb-kpi-icon balance"><SvgIcon type="wallet" /></div>
            </div>
            <div className="cb-kpi-meta"><span>ريال سعودي</span><span className="cb-kpi-positive">محدث الآن</span></div>
          </article>

          <article className="cb-kpi">
            <div className="cb-kpi-head">
              <div>
                <div className="cb-kpi-label">إجمالي الإيرادات</div>
                <div className="cb-kpi-value">{formatMoney(data.todayIncome)}</div>
              </div>
              <div className="cb-kpi-icon income"><SvgIcon type="up" /></div>
            </div>
            <div className="cb-kpi-meta"><span>ريال سعودي</span><span className="cb-kpi-positive">إيرادات الصندوق</span></div>
          </article>

          <article className="cb-kpi">
            <div className="cb-kpi-head">
              <div>
                <div className="cb-kpi-label">إجمالي المصروفات</div>
                <div className="cb-kpi-value">{formatMoney(data.todayExpense)}</div>
              </div>
              <div className="cb-kpi-icon expense"><SvgIcon type="down" /></div>
            </div>
            <div className="cb-kpi-meta"><span>ريال سعودي</span><span className="cb-kpi-negative">مصروفات الصندوق</span></div>
          </article>

          <article className="cb-kpi">
            <div className="cb-kpi-head">
              <div>
                <div className="cb-kpi-label">عدد العمليات</div>
                <div className="cb-kpi-value">{Number(data.todayTransactions || 0).toLocaleString("en-US")}</div>
              </div>
              <div className="cb-kpi-icon count"><SvgIcon type="count" /></div>
            </div>
            <div className="cb-kpi-meta"><span>عملية مسجلة</span><span className="cb-kpi-positive">إجمالي الحركة</span></div>
          </article>
        </section>

        <section className="cb-dashboard-grid">
          <article className="cb-panel">
            <div className="cb-panel-body">
              <div className="cb-panel-head">
                <div>
                  <h2 className="cb-panel-title">نظرة عامة على الأداء</h2>
                  <p className="cb-panel-subtitle">مقارنة مباشرة بين الإيرادات والمصروفات المسجلة</p>
                </div>
                <Link href="/reports" className="cb-outline-button">التقرير المالي</Link>
              </div>

              <div className="cb-performance">
                <div className="cb-performance-item">
                  <div className="cb-performance-labels">
                    <span>إجمالي الإيرادات</span>
                    <span className="cb-performance-value">{formatMoney(data.todayIncome)} ر.س</span>
                  </div>
                  <div className="cb-track"><div className="cb-fill income" style={{ width: `${performance.income}%` }} /></div>
                </div>

                <div className="cb-performance-item">
                  <div className="cb-performance-labels">
                    <span>إجمالي المصروفات</span>
                    <span className="cb-performance-value">{formatMoney(data.todayExpense)} ر.س</span>
                  </div>
                  <div className="cb-track"><div className="cb-fill expense" style={{ width: `${performance.expense}%` }} /></div>
                </div>
              </div>

              <div className="cb-balance-highlight">
                <div className="cb-safe" aria-hidden="true" />
                <div>
                  <div className="cb-balance-caption">صافي الرصيد الحالي لجميع الصناديق</div>
                  <div className="cb-balance-number">{formatMoney(data.currentBalance)} ر.س</div>
                </div>
              </div>
            </div>
          </article>

          <article className="cb-panel">
            <div className="cb-panel-body">
              <div className="cb-panel-head">
                <div>
                  <h2 className="cb-panel-title">آخر العمليات</h2>
                  <p className="cb-panel-subtitle">أحدث حركات القبض والصرف</p>
                </div>
                <Link href="/transactions/list" className="cb-outline-button">عرض الكل</Link>
              </div>

              <div className="cb-transaction-list">
                {recent.length === 0 ? (
                  <div className="py-8 text-center text-sm text-[#8c8171]">لا توجد عمليات حتى الآن</div>
                ) : recent.map((t) => {
                  const isIncome = t.debit != null;
                  const amount = isIncome ? t.debit : t.credit;
                  return (
                    <div key={t.id} className="cb-transaction-row">
                      <div className={`cb-transaction-icon ${isIncome ? "income" : "expense"}`}>
                        <SvgIcon type={isIncome ? "arrowUp" : "arrowDown"} />
                      </div>
                      <div className="min-w-0">
                        <div className="cb-transaction-desc">{isIncome ? "إيراد" : "مصروف"} - {t.description || "عملية مالية"}</div>
                        <div className="cb-transaction-date">
                          {t.cashbox || "الصندوق"} · {t.date ? new Date(t.date).toLocaleDateString("ar-SA") : "-"}
                        </div>
                      </div>
                      <div className={`cb-transaction-amount ${isIncome ? "income" : "expense"}`}>
                        {isIncome ? "+" : "-"}{formatMoney(amount)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </article>
        </section>

        <section className="cb-bottom-grid">
          <article className="cb-panel">
            <div className="cb-panel-body">
              <div className="cb-panel-head">
                <div>
                  <h2 className="cb-panel-title">الصناديق</h2>
                  <p className="cb-panel-subtitle">الرصيد الحالي لكل صندوق نشط</p>
                </div>
              </div>
              <div className="cb-cashboxes">
                {(data.cashboxes || []).length === 0 ? (
                  <div className="text-sm text-[#8c8171]">لا توجد صناديق نشطة</div>
                ) : (data.cashboxes || []).map((box) => (
                  <div key={box.id} className="cb-cashbox-card">
                    <div className="cb-cashbox-name">{box.name}</div>
                    <div className="cb-cashbox-balance">{formatMoney(box.balance)} ر.س</div>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="cb-panel">
            <div className="cb-panel-body">
              <div className="cb-panel-head">
                <div>
                  <h2 className="cb-panel-title">ملخص الصندوق</h2>
                  <p className="cb-panel-subtitle">ملخص مالي سريع من البيانات الفعلية</p>
                </div>
              </div>
              <div className="cb-summary-list">
                <div className="cb-summary-row income"><span>إجمالي الإيرادات</span><strong>{formatMoney(data.todayIncome)} ر.س</strong></div>
                <div className="cb-summary-row expense"><span>إجمالي المصروفات</span><strong>{formatMoney(data.todayExpense)} ر.س</strong></div>
                <div className="cb-summary-row"><span>عدد العمليات</span><strong>{Number(data.todayTransactions || 0).toLocaleString("en-US")}</strong></div>
                <div className="cb-summary-row"><span>الرصيد الحالي</span><strong>{formatMoney(data.currentBalance)} ر.س</strong></div>
              </div>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
