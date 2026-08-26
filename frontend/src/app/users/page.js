"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../../components/Sidebar";
import { apiFetch } from "../../lib/api";

const roleLabels = {
  CEO: "المالك / الإدارة العليا",
  MANAGER: "المدير المالي",
  ACCOUNTANT: "المحاسب",
  STORE_KEEPER: "أمين المستودع",
};

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("ACCOUNTANT");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(null);
  const [passwordUser, setPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");

  const loadUsers = async () => {
    const response = await apiFetch("/api/users");
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "تعذر تحميل المستخدمين");
    setUsers(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    let user = {};
    try { user = JSON.parse(localStorage.getItem("user") || "{}"); } catch {}
    if (user.role !== "CEO") {
      router.replace("/dashboard");
      return;
    }
    loadUsers().catch((err) => setMessage(err.message));
  }, [router]);

  const createUser = async () => {
    setMessage("");
    try {
      const response = await apiFetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, full_name: fullName, role }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "تعذر إنشاء المستخدم");
      setMessage("تم إنشاء المستخدم بنجاح");
      setUsername("");
      setFullName("");
      setPassword("");
      setRole("ACCOUNTANT");
      await loadUsers();
    } catch (err) {
      setMessage(err.message || "خطأ في الاتصال بالخادم");
    }
  };

  const saveUser = async () => {
    if (!editing) return;
    setMessage("");
    try {
      const response = await apiFetch(`/api/users/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: editing.full_name,
          role: editing.role,
          is_active: Boolean(editing.is_active),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "تعذر تعديل المستخدم");
      setEditing(null);
      setMessage("تم تحديث المستخدم بنجاح");
      await loadUsers();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء التحديث");
    }
  };

  const changePassword = async () => {
    if (!passwordUser) return;
    setMessage("");
    try {
      const response = await apiFetch(`/api/users/${passwordUser.id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "تعذر تغيير كلمة المرور");
      setPasswordUser(null);
      setNewPassword("");
      setMessage(`تم تغيير كلمة مرور المستخدم ${passwordUser.username} بنجاح`);
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء تغيير كلمة المرور");
    }
  };

  return (
    <div className="cb-shell" dir="rtl">
      <Sidebar />
      <main className="cb-dashboard">
        <header className="cb-topbar">
          <div>
            <h1 className="cb-welcome-title">إدارة المستخدمين</h1>
            <p className="cb-welcome-subtitle">صلاحية المالك لإضافة المستخدمين وتعديل الصلاحيات وتغيير كلمات المرور</p>
          </div>
        </header>

        <section className="cb-panel mb-5">
          <div className="cb-panel-body">
            <div className="cb-panel-head"><h2 className="cb-panel-title">إضافة مستخدم جديد</h2></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <input type="text" placeholder="اسم المستخدم" value={username} onChange={(e) => setUsername(e.target.value)} className="border p-3 rounded-lg" />
              <input type="text" placeholder="الاسم الكامل" value={fullName} onChange={(e) => setFullName(e.target.value)} className="border p-3 rounded-lg" />
              <input type="password" placeholder="كلمة المرور - 8 أحرف على الأقل" value={password} onChange={(e) => setPassword(e.target.value)} className="border p-3 rounded-lg" />
              <select value={role} onChange={(e) => setRole(e.target.value)} className="border p-3 rounded-lg">
                {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <button onClick={createUser} className="bg-[#4b4a24] hover:bg-[#373719] text-white px-6 py-3 rounded-lg font-bold">إضافة مستخدم</button>
            {message && <div className="mt-4 rounded-lg bg-[#f6f0e4] border border-[#e7d7b5] p-3 font-bold">{message}</div>}
          </div>
        </section>

        {editing && (
          <section className="cb-panel mb-5">
            <div className="cb-panel-body">
              <div className="cb-panel-head"><h2 className="cb-panel-title">تعديل المستخدم: {editing.username}</h2></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className="block mb-2 font-bold">الاسم الكامل</label><input value={editing.full_name} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} className="w-full border p-3 rounded-lg" /></div>
                <div><label className="block mb-2 font-bold">الصلاحية</label><select value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })} className="w-full border p-3 rounded-lg">{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                <div><label className="block mb-2 font-bold">الحالة</label><select value={editing.is_active ? "1" : "0"} onChange={(e) => setEditing({ ...editing, is_active: e.target.value === "1" })} className="w-full border p-3 rounded-lg"><option value="1">نشط</option><option value="0">موقوف</option></select></div>
              </div>
              <div className="flex gap-3 mt-5"><button onClick={saveUser} className="bg-[#4b4a24] text-white px-6 py-3 rounded-lg font-bold">حفظ التعديل</button><button onClick={() => setEditing(null)} className="border px-6 py-3 rounded-lg font-bold">إلغاء</button></div>
            </div>
          </section>
        )}

        {passwordUser && (
          <section className="cb-panel mb-5">
            <div className="cb-panel-body">
              <div className="cb-panel-head"><h2 className="cb-panel-title">تغيير كلمة مرور: {passwordUser.username}</h2></div>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
                <div><label className="block mb-2 font-bold">كلمة المرور الجديدة</label><input type="password" minLength="8" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full border p-3 rounded-lg" placeholder="8 أحرف على الأقل" /></div>
                <div className="flex gap-2"><button onClick={changePassword} className="bg-[#64748B] text-white px-6 py-3 rounded-lg font-bold">تغيير كلمة المرور</button><button onClick={() => { setPasswordUser(null); setNewPassword(""); }} className="border px-5 py-3 rounded-lg font-bold">إلغاء</button></div>
              </div>
            </div>
          </section>
        )}

        <section className="cb-panel">
          <div className="cb-panel-body overflow-x-auto">
            <table className="w-full border-collapse">
              <thead><tr className="border-b bg-[#faf6ed]"><th className="p-3">ID</th><th className="p-3">اسم المستخدم</th><th className="p-3">الاسم الكامل</th><th className="p-3">الصلاحية</th><th className="p-3">الحالة</th><th className="p-3">الإدارة</th></tr></thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b">
                    <td className="p-3">{user.id}</td>
                    <td className="p-3 font-bold">{user.username}</td>
                    <td className="p-3">{user.full_name}</td>
                    <td className="p-3">{roleLabels[user.role] || user.role}</td>
                    <td className="p-3"><span className={`px-3 py-1 rounded-full font-bold ${user.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{user.is_active ? "نشط" : "موقوف"}</span></td>
                    <td className="p-3"><div className="flex gap-2 flex-wrap"><button onClick={() => setEditing({ ...user })} className="px-3 py-2 rounded-lg bg-[#4b4a24] text-white font-bold">تعديل</button><button onClick={() => { setPasswordUser(user); setNewPassword(""); }} className="px-3 py-2 rounded-lg bg-[#64748B] text-white font-bold">كلمة المرور</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
