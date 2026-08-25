"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../../components/Sidebar";
import { apiFetch } from "../../lib/api";

export default function UsersPage() {
  const [users, setUsers] = useState([]);

  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("ACCOUNTANT");
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

    apiFetch("/api/users")
      .then((res) => res.json())
      .then((data) => setUsers(data))
      .catch((err) => console.error(err));
  }, [router]);

  const createUser = async () => {
    try {
      const response = await apiFetch(
        "/api/users",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username,
            password,
            full_name: fullName,
            role,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setMessage("تم إنشاء المستخدم بنجاح");

        setUsername("");
        setFullName("");
        setPassword("");
        setRole("ACCOUNTANT");

        const usersResponse = await apiFetch(
          "/api/users"
        );

        const usersData = await usersResponse.json();
        setUsers(usersData);
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
        <h1 className="text-4xl font-bold text-center mb-8">
          إدارة المستخدمين
        </h1>

        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow p-6">
          <div className="grid grid-cols-4 gap-4 mb-6">

            <input
              type="text"
              placeholder="اسم المستخدم"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="border p-3 rounded-lg"
            />

            <input
              type="text"
              placeholder="الاسم الكامل"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="border p-3 rounded-lg"
            />

            <input
              type="password"
              placeholder="كلمة المرور"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border p-3 rounded-lg"
            />

            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="border p-3 rounded-lg"
            >
              <option value="CEO">CEO</option>
              <option value="MANAGER">MANAGER</option>
              <option value="ACCOUNTANT">ACCOUNTANT</option>
              <option value="STORE_KEEPER">STORE_KEEPER</option>
            </select>

          </div>

          <button
            onClick={createUser}
            className="mb-4 bg-green-600 text-white px-6 py-3 rounded-lg"
          >
            إضافة مستخدم
          </button>

          {message && (
            <p className="mb-4 font-bold">
              {message}
            </p>
          )}

          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="p-3">ID</th>
                <th className="p-3">اسم المستخدم</th>
                <th className="p-3">الاسم الكامل</th>
                <th className="p-3">الصلاحية</th>
                <th className="p-3">الحالة</th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b">
                  <td className="p-3">{user.id}</td>
                  <td className="p-3">{user.username}</td>
                  <td className="p-3">{user.full_name}</td>
                  <td className="p-3">{user.role}</td>
                  <td className="p-3">
                    {user.is_active ? "نشط" : "موقوف"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

        </div>
      </main>
    </div>
  );
}