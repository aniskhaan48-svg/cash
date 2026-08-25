"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Sidebar() {
  const [role, setRole] = useState("");
  const router = useRouter();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    setRole(user.role || "");
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  return (
    <aside
      dir="rtl"
      className="w-64 shrink-0 bg-white shadow min-h-screen p-4 border-l"
    >
      <h2 className="text-2xl font-bold mb-8">CashBox Cloud</h2>

      <nav className="space-y-3">
        <Link href="/dashboard" className="block p-3 rounded-lg hover:bg-gray-100">
          لوحة التحكم
        </Link>

        {(role === "CEO" || role === "MANAGER" || role === "ACCOUNTANT") && (
          <>
            <Link href="/transactions/list" className="block p-3 rounded-lg hover:bg-gray-100">
              العمليات المالية
            </Link>
            <Link href="/transactions" className="block p-3 rounded-lg hover:bg-gray-100">
              إضافة عملية
            </Link>
            <Link href="/reports" className="block p-3 rounded-lg hover:bg-gray-100">
              التقارير
            </Link>
            <Link href="/cashbox-statement" className="block p-3 rounded-lg hover:bg-gray-100">
              كشف حساب الصندوق
            </Link>
          </>
        )}

        {(role === "CEO" || role === "MANAGER") && (
          <>
            <Link href="/users" className="block p-3 rounded-lg hover:bg-gray-100">
              المستخدمون
            </Link>
            <Link href="/settings" className="block p-3 rounded-lg hover:bg-gray-100">
              الإعدادات
            </Link>
          </>
        )}

        {(role === "CEO" || role === "MANAGER" || role === "STORE_KEEPER") && (
          <>
            <Link href="/inventory" className="block p-3 rounded-lg hover:bg-gray-100">
              المخزون الحالي
            </Link>
            <Link href="/inventory/consumption" className="block p-3 rounded-lg hover:bg-gray-100">
              الاستهلاك اليومي
            </Link>
          </>
        )}

        <button
          onClick={logout}
          className="w-full text-right bg-red-600 text-white p-3 rounded-lg mt-6"
        >
          تسجيل الخروج
        </button>
      </nav>
    </aside>
  );
}
