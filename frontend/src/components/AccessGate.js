"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const isAllowed = (role, pathname) => {
  if (pathname === "/" || pathname === "/login") return true;
  if (pathname === "/dashboard") return true;
  if (role === "CEO") return true;

  if (role === "MANAGER") {
    return !pathname.startsWith("/users");
  }

  if (role === "ACCOUNTANT") {
    return (
      pathname.startsWith("/transactions") ||
      pathname.startsWith("/reports") ||
      pathname.startsWith("/cashbox-statement")
    );
  }

  if (role === "STORE_KEEPER") {
    return pathname.startsWith("/inventory");
  }

  return false;
};

export default function AccessGate({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(pathname === "/login");

  useEffect(() => {
    if (pathname === "/login") {
      setReady(true);
      return;
    }

    if (pathname === "/") {
      setReady(true);
      return;
    }

    let user = {};
    try {
      user = JSON.parse(localStorage.getItem("user") || "{}");
    } catch {}
    const token = localStorage.getItem("token");

    if (!token || !user.role) {
      setReady(false);
      router.replace("/login");
      return;
    }

    if (!isAllowed(user.role, pathname)) {
      setReady(false);
      router.replace("/dashboard");
      return;
    }

    setReady(true);
  }, [pathname, router]);

  if (!ready) {
    return <div className="cb-loading">جاري التحقق من الصلاحية...</div>;
  }

  return children;
}
