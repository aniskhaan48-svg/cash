"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";

function BrandIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17.5h9.5a4.5 4.5 0 0 0 .8-8.93A6 6 0 0 0 6 8.5 4.5 4.5 0 0 0 7 17.5Z" />
      <path d="M9.5 12.5h5M12 10v5" />
    </svg>
  );
}

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        router.push("/dashboard");
      } else {
        setMessage(data.message || "تعذر تسجيل الدخول");
      }
    } catch (error) {
      console.error("Login Error:", error);
      setMessage("خطأ في الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="cb-login-page" dir="rtl">
      <section className="cb-login-brand">
        <div className="cb-login-logo">
          <div className="cb-brand-mark"><BrandIcon /></div>
          <h1>CashBox Cloud</h1>
        </div>
        <p className="cb-login-tagline">إدارة مالية ذكية وآمنة لصندوق شركتك</p>
        <p className="cb-login-copy">
          تابع الإيرادات والمصروفات والأرصدة والتقارير من واجهة عربية واضحة بهوية مالية احترافية.
        </p>
      </section>

      <section className="cb-login-form-side">
        <div className="cb-login-card">
          <h2>تسجيل الدخول</h2>
          <p className="subtitle">أدخل بيانات حسابك للوصول إلى النظام</p>

          <form onSubmit={handleLogin}>
            <div className="cb-field">
              <label htmlFor="username">اسم المستخدم</label>
              <input
                id="username"
                type="text"
                placeholder="اسم المستخدم"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="cb-input"
                autoComplete="username"
                required
              />
            </div>

            <div className="cb-field">
              <label htmlFor="password">كلمة المرور</label>
              <input
                id="password"
                type="password"
                placeholder="كلمة المرور"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="cb-input"
                autoComplete="current-password"
                required
              />
            </div>

            <button type="submit" disabled={loading} className="cb-login-button">
              {loading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
            </button>

            {message && <p className="cb-login-error">{message}</p>}
          </form>

          <div className="cb-login-secure">🔒 اتصال آمن ببيانات CashBox Cloud</div>
        </div>
      </section>
    </main>
  );
}
