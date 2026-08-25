"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../../components/Sidebar";
import { apiFetch } from "../../lib/api";

export default function SettingsPage() {
  const [companyNameAr, setCompanyNameAr] = useState("");
  const [companyNameEn, setCompanyNameEn] = useState("");
  const [currency, setCurrency] = useState("SAR");
  const [message, setMessage] = useState("");

  const router = useRouter();

  useEffect(() => {
    const user = JSON.parse(
      localStorage.getItem("user") || "{}"
    );

    if (
      user.role !== "CEO" &&
      user.role !== "MANAGER"
    ) {
      router.push("/dashboard");
      return;
    }

    apiFetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setCompanyNameAr(data.company_name_ar || "");
        setCompanyNameEn(data.company_name_en || "");
        setCurrency(data.currency || "SAR");
      })
      .catch((err) => console.error(err));
  }, [router]);

  const saveSettings = async () => {
    try {
      const response = await apiFetch(
        "/api/settings",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            company_name_ar: companyNameAr,
            company_name_en: companyNameEn,
            currency,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setMessage("تم حفظ الإعدادات بنجاح");
      } else {
        setMessage(data.message);
      }
    } catch (error) {
      console.error(error);
      setMessage("خطأ في الاتصال بالخادم");
    }
  };

  return (
    <div className="flex" dir="rtl">
      <Sidebar />

      <main className="flex-1 min-h-screen bg-gray-100 p-8">
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow">

          <h1 className="text-3xl font-bold mb-6 text-center">
            إعدادات النظام
          </h1>

          <div className="space-y-4">

            <input
              type="text"
              placeholder="اسم الشركة بالعربي"
              value={companyNameAr}
              onChange={(e) => setCompanyNameAr(e.target.value)}
              className="w-full border p-3 rounded-lg"
            />

            <input
              type="text"
              placeholder="Company Name"
              value={companyNameEn}
              onChange={(e) => setCompanyNameEn(e.target.value)}
              className="w-full border p-3 rounded-lg"
            />

            <input
              type="text"
              placeholder="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full border p-3 rounded-lg"
            />

            <button
              onClick={saveSettings}
              className="w-full bg-blue-600 text-white p-3 rounded-lg"
            >
              حفظ الإعدادات
            </button>

            {message && (
              <p className="text-center font-bold text-green-600">
                {message}
              </p>
            )}

          </div>

        </div>
      </main>
    </div>
  );
}