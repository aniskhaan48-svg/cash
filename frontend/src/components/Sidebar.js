"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const Icon = ({ name }) => {
  const common = {
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };

  const icons = {
    dashboard: <><path d="M3 12 12 4l9 8"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/></>,
    transactions: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h10M7 13h6M17 13h.01"/></>,
    add: <><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></>,
    reports: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
    statement: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.06.06-2.78 2.78-.06-.06A1.8 1.8 0 0 0 15 19.4a1.8 1.8 0 0 0-1 .6 1.8 1.8 0 0 0-.4 1.14V21H9.6v-.09A1.8 1.8 0 0 0 8.4 19.4a1.8 1.8 0 0 0-1.98.36l-.06.06-2.78-2.78.06-.06A1.8 1.8 0 0 0 4 15a1.8 1.8 0 0 0-.6-1 1.8 1.8 0 0 0-1.14-.4H2V9.6h.09A1.8 1.8 0 0 0 4 8.4a1.8 1.8 0 0 0-.36-1.98l-.06-.06 2.78-2.78.06.06A1.8 1.8 0 0 0 8.4 4a1.8 1.8 0 0 0 1-.6A1.8 1.8 0 0 0 9.8 2.26V2h4v.09A1.8 1.8 0 0 0 15 4a1.8 1.8 0 0 0 1.98-.36l.06-.06 2.78 2.78-.06.06A1.8 1.8 0 0 0 19.4 8.4a1.8 1.8 0 0 0 .6 1 1.8 1.8 0 0 0 1.14.4H21v4h-.09A1.8 1.8 0 0 0 19.4 15Z"/></>,
    inventory: <><path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="m3 8 9 5 9-5M3 8v8l9 5 9-5V8M12 13v8"/></>,
    consumption: <><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></>,
    stockin: <><path d="M12 21V7"/><path d="m7 12 5-5 5 5"/><path d="M5 3h14"/></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M21 19V5a2 2 0 0 0-2-2h-6"/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
    brand: <><path d="M7 17.5h9.5a4.5 4.5 0 0 0 .8-8.93A6 6 0 0 0 6 8.5 4.5 4.5 0 0 0 7 17.5Z"/><path d="M9.5 12.5h5M12 10v5"/></>,
  };

  return <svg {...common}>{icons[name]}</svg>;
};

export default function Sidebar() {
  const [role, setRole] = useState("");
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const nextRole = user.role || "";
    setRole(nextRole);

    if (
      nextRole === "STORE_KEEPER" &&
      pathname !== "/dashboard" &&
      !pathname.startsWith("/inventory")
    ) {
      router.replace("/dashboard");
    }
  }, [pathname, router]);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  const isStoreKeeper = role === "STORE_KEEPER";

  const isActive = (href) => pathname === href;

  const NavLink = ({ href, icon, children }) => (
    <Link href={href} className={`cb-nav-link ${isActive(href) ? "active" : ""}`}>
      <Icon name={icon} />
      <span>{children}</span>
    </Link>
  );

  return (
    <aside dir="rtl" className="cb-sidebar">
      <div className="cb-brand">
        <div className="cb-brand-mark"><Icon name="brand" /></div>
        <div>
          <h2 className="cb-brand-title">CashBox Cloud</h2>
          <div className="cb-brand-subtitle">{isStoreKeeper ? "إدارة المستودع والمخزون" : "إدارة مالية ذكية وآمنة"}</div>
        </div>
      </div>

      <nav className="cb-nav">
        <NavLink href="/dashboard" icon="dashboard">{isStoreKeeper ? "لوحة المستودع" : "لوحة التحكم"}</NavLink>

        {(role === "CEO" || role === "MANAGER" || role === "ACCOUNTANT") && (
          <>
            <NavLink href="/transactions/list" icon="transactions">العمليات المالية</NavLink>
            <NavLink href="/transactions" icon="add">إضافة عملية</NavLink>
            <NavLink href="/reports" icon="reports">التقارير</NavLink>
            <NavLink href="/cashbox-statement" icon="statement">كشف حساب الصندوق</NavLink>
            {(role === "CEO" || role === "MANAGER") && (
              <NavLink href="/opening-balance" icon="statement">الرصيد الافتتاحي</NavLink>
            )}
          </>
        )}

        {(role === "CEO" || role === "MANAGER") && (
          <>
            <div className="cb-nav-separator" />
            {role === "CEO" && <NavLink href="/users" icon="users">المستخدمون</NavLink>}
            <NavLink href="/settings" icon="settings">الإعدادات</NavLink>
          </>
        )}

        {(role === "CEO" || role === "MANAGER" || role === "STORE_KEEPER") && (
          <>
            <div className="cb-nav-separator" />
            <NavLink href="/inventory" icon="inventory">المخزون الحالي</NavLink>
            <NavLink href="/inventory/stock-in" icon="stockin">إدخال للمخزون</NavLink>
            <NavLink href="/inventory/consumption" icon="consumption">الاستهلاك اليومي</NavLink>
            <NavLink href="/inventory/reports" icon="reports">تقارير المخزون</NavLink>
          </>
        )}
      </nav>

      <div className="cb-security-card">
        <div className="cb-security-icon"><Icon name="shield" /></div>
        <div className="cb-security-title">{isStoreKeeper ? "مخزونك تحت السيطرة" : "صندوقك في أمان"}</div>
        <div className="cb-security-text">
          {isStoreKeeper
            ? "صلاحية مخصصة للمستودع لمتابعة الكروت والأساور والإدخال والاستهلاك فقط."
            : "هوية مالية احترافية مع صلاحيات دخول وحماية لبيانات الصندوق."}
        </div>
      </div>

      <button type="button" onClick={logout} className="cb-logout">
        <Icon name="logout" />
        <span>تسجيل الخروج</span>
      </button>
    </aside>
  );
}
