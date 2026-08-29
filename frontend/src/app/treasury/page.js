"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../../components/Sidebar";
import { apiFetch } from "../../lib/api";

const todayKey = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const money = (value) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const entityName = (code) => (code === "ALMALQA" ? "الملقا" : "تولان");

const MOVEMENT_TYPES = [
  ["EXPENSE", "مصروف من بنك / محفظة"],
  ["SUPPLIER_PAYMENT", "سداد مورد"],
  ["ADVANCE", "صرف عهدة"],
  ["ADVANCE_RETURN", "استرداد عهدة"],
  ["ADVANCE_SETTLEMENT", "تسوية عهدة كمصروف"],
  ["TRANSFER", "تحويل بين الحسابات"],
  ["BANK_IN", "إيداع / حركة بنكية داخلة"],
  ["BANK_OUT", "سحب / حركة بنكية خارجة"],
  ["OTHER_IN", "حركة داخلة أخرى"],
  ["OTHER_OUT", "حركة خارجة أخرى"],
];

const TYPE_LABELS = Object.fromEntries(MOVEMENT_TYPES);
const SOURCE_TYPES = new Set(["EXPENSE", "SUPPLIER_PAYMENT", "ADVANCE", "BANK_OUT", "OTHER_OUT", "TRANSFER"]);
const DESTINATION_TYPES = new Set(["ADVANCE_RETURN", "BANK_IN", "OTHER_IN", "TRANSFER"]);

const emptyLine = (entity = "TOLAN") => ({
  entity_code: entity,
  source_account_id: "",
  destination_account_id: "",
  amount: "",
  note: "",
});

export default function TreasuryDailyPage() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [entries, setEntries] = useState([]);
  const [entryDate, setEntryDate] = useState(todayKey());
  const [movementType, setMovementType] = useState("EXPENSE");
  const [categoryId, setCategoryId] = useState("");
  const [beneficiary, setBeneficiary] = useState("");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState([emptyLine()]);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const canEdit = role === "CEO" || role === "MANAGER";
  const needsSource = SOURCE_TYPES.has(movementType);
  const needsDestination = DESTINATION_TYPES.has(movementType);
  const isSettlement = movementType === "ADVANCE_SETTLEMENT";
  const needsBeneficiary = movementType.startsWith("ADVANCE") || movementType === "SUPPLIER_PAYMENT";
  const isExpenseCategory = ["EXPENSE", "SUPPLIER_PAYMENT", "ADVANCE_SETTLEMENT"].includes(movementType);
  const isIncomeCategory = ["BANK_IN", "OTHER_IN"].includes(movementType);
  const needsCategory = isExpenseCategory || isIncomeCategory;
  const filteredCategories = categories.filter((category) => isIncomeCategory ? category.type === "INCOME" : category.type === "EXPENSE");

  const loadData = async () => {
    setLoading(true);
    setMessage("");
    try {
      const [accountsRes, categoriesRes, entriesRes] = await Promise.all([
        apiFetch("/api/treasury/accounts"),
        apiFetch("/api/master-data/categories"),
        apiFetch("/api/treasury/entries?limit=120"),
      ]);
      const [accountData, categoryData, entryData] = await Promise.all([accountsRes.json(), categoriesRes.json(), entriesRes.json()]);
      if (!accountsRes.ok) throw new Error(accountData.message || "تعذر تحميل الحسابات");
      if (!categoriesRes.ok) throw new Error(categoryData.message || "تعذر تحميل دليل الحسابات");
      if (!entriesRes.ok) throw new Error(entryData.message || "تعذر تحميل الحركات");
      setAccounts(Array.isArray(accountData) ? accountData : []);
      const safeCategories = Array.isArray(categoryData) ? categoryData : [];
      setCategories(safeCategories);
      setCategoryId((current) => current || String(safeCategories.find((category) => category.type === "EXPENSE")?.id || ""));
      setEntries(Array.isArray(entryData) ? entryData : []);
    } catch (error) {
      console.error(error);
      setMessage(error.message || "تعذر تحميل بيانات الخزينة");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let user = {};
    try { user = JSON.parse(localStorage.getItem("user") || "{}"); } catch {}
    if (!["CEO", "MANAGER", "ACCOUNTANT"].includes(user.role)) {
      router.replace("/dashboard");
      return;
    }
    setRole(user.role || "");
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const totalAmount = useMemo(
    () => lines.reduce((sum, line) => sum + Number(line.amount || 0), 0),
    [lines]
  );

  const activeAccounts = accounts.filter((account) => account.is_active);
  const accountsForEntity = (entity) => activeAccounts.filter((account) => account.entity_code === entity);

  const changeMovementType = (value) => {
    setMovementType(value);
    setLines((current) => current.map((line) => ({ ...line, source_account_id: "", destination_account_id: "" })));
    const wantsIncome = ["BANK_IN", "OTHER_IN"].includes(value);
    const wantsExpense = ["EXPENSE", "SUPPLIER_PAYMENT", "ADVANCE_SETTLEMENT"].includes(value);
    if (wantsIncome || wantsExpense) {
      const first = categories.find((category) => wantsIncome ? category.type === "INCOME" : category.type === "EXPENSE");
      setCategoryId(first ? String(first.id) : "");
    } else {
      setCategoryId("");
    }
  };

  const updateLine = (index, field, value) => {
    setLines((current) => current.map((line, idx) => {
      if (idx !== index) return line;
      if (field === "entity_code") {
        return { ...line, entity_code: value, source_account_id: "", destination_account_id: "" };
      }
      return { ...line, [field]: value };
    }));
  };

  const addLine = () => {
    const nextEntity = lines.some((line) => line.entity_code === "ALMALQA") ? "TOLAN" : "ALMALQA";
    setLines((current) => [...current, emptyLine(nextEntity)]);
  };

  const removeLine = (index) => {
    if (lines.length === 1) return;
    setLines((current) => current.filter((_, idx) => idx !== index));
  };

  const resetForm = () => {
    setEditId(null);
    setEntryDate(todayKey());
    setMovementType("EXPENSE");
    const firstExpense = categories.find((category) => category.type === "EXPENSE");
    setCategoryId(firstExpense ? String(firstExpense.id) : "");
    setBeneficiary("");
    setDescription("");
    setLines([emptyLine()]);
  };

  const saveEntry = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const payload = {
        entry_date: entryDate,
        movement_type: movementType,
        category_id: categoryId ? Number(categoryId) : null,
        beneficiary,
        description,
        lines: lines.map((line) => ({
          entity_code: line.entity_code,
          source_account_id: line.source_account_id ? Number(line.source_account_id) : null,
          destination_account_id: line.destination_account_id ? Number(line.destination_account_id) : null,
          amount: Number(line.amount),
          note: line.note,
        })),
      };

      const response = await apiFetch(editId ? `/api/treasury/entries/${editId}` : "/api/treasury/entries", {
        method: editId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "تعذر حفظ الحركة");

      setMessage(editId ? "تم تعديل الحركة بنجاح" : "تم حفظ الحركة بنجاح");
      resetForm();
      await loadData();
    } catch (error) {
      console.error(error);
      setMessage(error.message || "تعذر حفظ الحركة");
    } finally {
      setSaving(false);
    }
  };

  const editEntry = (entry) => {
    if (!canEdit) return;
    setEditId(entry.id);
    setEntryDate(entry.entry_date);
    setMovementType(entry.movement_type);
    setCategoryId(entry.category_id ? String(entry.category_id) : "");
    setBeneficiary(entry.beneficiary || "");
    setDescription(entry.description || "");
    setLines(entry.lines.map((line) => ({
      entity_code: line.entity_code,
      source_account_id: line.source_account_id ? String(line.source_account_id) : "",
      destination_account_id: line.destination_account_id ? String(line.destination_account_id) : "",
      amount: String(line.amount || ""),
      note: line.note || "",
    })));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteEntry = async (entry) => {
    if (!canEdit || !window.confirm(`حذف الحركة رقم ${entry.id}؟ سيتم الاحتفاظ بسجل المراجعة.`)) return;
    try {
      const response = await apiFetch(`/api/treasury/entries/${entry.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "تعذر حذف الحركة");
      setMessage("تم حذف الحركة");
      if (editId === entry.id) resetForm();
      await loadData();
    } catch (error) {
      setMessage(error.message || "تعذر حذف الحركة");
    }
  };

  return (
    <div className="cb-shell" dir="rtl">
      <Sidebar />
      <main className="cb-dashboard">
        <header className="cb-topbar">
          <div>
            <h1 className="cb-welcome-title">الإدخال اليومي — الخزينة والتحويلات</h1>
            <p className="cb-welcome-subtitle">للبنوك والمحافظ والعهد والتحويلات والمصروفات خارج الصندوق مع توزيع تولان / الملقا</p>
          </div>
          <a href="/treasury/reports" className="cb-outline-button">التقرير الشامل</a>
        </header>

        <section className="cb-panel mb-5">
          <div className="cb-panel-body">
            <div className="rounded-xl border border-[#d7b36c] bg-[#fffaf0] p-4 mb-5 text-sm leading-7">
              <strong>مهم:</strong> حركات الصندوق النقدي تبقى من صفحة <strong>إضافة عملية</strong>. هذه الشاشة للحركات التي لا تمر عبر الصندوق مثل هلا والبنوك والعهد والتحويلات وسداد الموردين.
            </div>

            <form onSubmit={saveEntry} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block mb-2 font-bold">التاريخ</label>
                  <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="w-full border rounded-lg p-3" required />
                </div>
                <div>
                  <label className="block mb-2 font-bold">نوع الحركة</label>
                  <select value={movementType} onChange={(e) => changeMovementType(e.target.value)} className="w-full border rounded-lg p-3">
                    {MOVEMENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block mb-2 font-bold">المستفيد / صاحب العهدة {needsBeneficiary ? "*" : ""}</label>
                  <input value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)} placeholder="مثال: أنيس الرحمن / اسم المورد" className="w-full border rounded-lg p-3" required={needsBeneficiary} />
                </div>
              </div>

              {needsCategory && (
                <div>
                  <label className="block mb-2 font-bold">{isIncomeCategory ? "حساب الإيراد" : "حساب المصروف"}</label>
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full border rounded-lg p-3" required>
                    <option value="">اختر الحساب</option>
                    {filteredCategories.map((category) => <option key={category.id} value={category.id}>{category.name_ar}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block mb-2 font-bold">البيان</label>
                <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="شرح مختصر للحركة" className="w-full border rounded-lg p-3" />
              </div>

              <div className="rounded-2xl border border-[#ded1b7] overflow-hidden">
                <div className="bg-[#f6f0e4] px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="font-bold text-lg">توزيع الحركة</h2>
                    <p className="text-sm text-gray-600">يمكن تقسيم نفس الحركة بين تولان والملقا</p>
                  </div>
                  <button type="button" onClick={addLine} className="px-4 py-2 rounded-lg bg-white border border-[#b88a36] font-bold text-[#66501f]">+ إضافة توزيع</button>
                </div>

                <div className="p-4 space-y-4">
                  {lines.map((line, index) => {
                    const entityAccounts = accountsForEntity(line.entity_code);
                    const destinationAccounts = movementType === "TRANSFER" ? activeAccounts : entityAccounts;
                    return (
                      <div key={index} className="rounded-xl border border-[#e7dcc5] p-4 bg-white">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 items-end">
                          <div>
                            <label className="block mb-2 text-sm font-bold">الجهة</label>
                            <select value={line.entity_code} onChange={(e) => updateLine(index, "entity_code", e.target.value)} className="w-full border rounded-lg p-3">
                              <option value="TOLAN">تولان</option>
                              <option value="ALMALQA">الملقا</option>
                            </select>
                          </div>

                          {needsSource && !isSettlement && (
                            <div>
                              <label className="block mb-2 text-sm font-bold">من الحساب</label>
                              <select value={line.source_account_id} onChange={(e) => updateLine(index, "source_account_id", e.target.value)} className="w-full border rounded-lg p-3" required>
                                <option value="">اختر الحساب</option>
                                {entityAccounts.map((account) => <option key={account.id} value={account.id}>{account.name_ar}</option>)}
                              </select>
                            </div>
                          )}

                          {needsDestination && !isSettlement && (
                            <div>
                              <label className="block mb-2 text-sm font-bold">إلى الحساب</label>
                              <select value={line.destination_account_id} onChange={(e) => updateLine(index, "destination_account_id", e.target.value)} className="w-full border rounded-lg p-3" required>
                                <option value="">اختر الحساب</option>
                                {destinationAccounts.filter((account) => String(account.id) !== String(line.source_account_id)).map((account) => (
                                  <option key={account.id} value={account.id}>{account.name_ar} ({entityName(account.entity_code)})</option>
                                ))}
                              </select>
                            </div>
                          )}

                          <div>
                            <label className="block mb-2 text-sm font-bold">المبلغ</label>
                            <input type="number" min="0.01" step="0.01" value={line.amount} onChange={(e) => updateLine(index, "amount", e.target.value)} className="w-full border rounded-lg p-3" required />
                          </div>

                          <div>
                            <label className="block mb-2 text-sm font-bold">ملاحظة للسطر</label>
                            <input value={line.note} onChange={(e) => updateLine(index, "note", e.target.value)} placeholder="اختياري" className="w-full border rounded-lg p-3" />
                          </div>
                        </div>
                        {lines.length > 1 && (
                          <div className="mt-3 text-left">
                            <button type="button" onClick={() => removeLine(index)} className="text-sm text-red-700 font-bold">حذف هذا التوزيع</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="bg-[#4b4a24] text-white px-5 py-4 flex justify-between gap-3 flex-wrap font-bold">
                  <span>عدد التوزيعات: {lines.length}</span>
                  <span>إجمالي الحركة: {money(totalAmount)} ر.س</span>
                </div>
              </div>

              <div className="flex gap-3 flex-wrap">
                <button type="submit" disabled={saving || activeAccounts.length === 0} className="px-8 py-3 rounded-lg bg-[#c28b2c] hover:bg-[#a87722] disabled:bg-gray-400 text-white font-bold">
                  {saving ? "جاري الحفظ..." : editId ? "حفظ التعديل" : "حفظ الحركة"}
                </button>
                {editId && <button type="button" onClick={resetForm} className="px-8 py-3 rounded-lg border border-[#8f8a72] font-bold">إلغاء التعديل</button>}
              </div>
              {activeAccounts.length === 0 && <div className="rounded-lg bg-amber-50 border border-amber-300 p-3 font-bold">لا توجد حسابات فعالة. أضف حسابًا بنكيًا أو محفظة من صفحة الحسابات والأرصدة.</div>}
              {message && <div className="rounded-lg bg-[#f6f0e4] border border-[#e7d7b5] p-3 font-bold">{message}</div>}
            </form>
          </div>
        </section>

        <section className="cb-panel">
          <div className="cb-panel-body">
            <div className="cb-panel-head">
              <div><h2 className="cb-panel-title">آخر الحركات المحفوظة</h2><p className="cb-panel-subtitle">الحفظ دائم، والتعديل والحذف متاحان للمالك والمدير المالي</p></div>
              <button type="button" onClick={loadData} className="cb-outline-button">تحديث</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead><tr className="border-b bg-[#faf6ed]"><th className="p-3">التاريخ</th><th className="p-3">النوع</th><th className="p-3">الحساب</th><th className="p-3">المستفيد</th><th className="p-3">التوزيع</th><th className="p-3">الإجمالي</th><th className="p-3">البيان</th><th className="p-3">الإجراء</th></tr></thead>
                <tbody>
                  {entries.length === 0 ? (
                    <tr><td colSpan="8" className="p-8 text-center text-gray-500">{loading ? "جاري التحميل..." : "لا توجد حركات حتى الآن"}</td></tr>
                  ) : entries.map((entry) => (
                    <tr key={entry.id} className="border-b align-top">
                      <td className="p-3 whitespace-nowrap">{entry.entry_date}</td>
                      <td className="p-3 font-bold">{TYPE_LABELS[entry.movement_type] || entry.movement_type}</td>
                      <td className="p-3">{entry.category_name || "—"}</td>
                      <td className="p-3">{entry.beneficiary || "—"}</td>
                      <td className="p-3 min-w-[260px]">
                        <div className="space-y-1">
                          {entry.lines.map((line) => (
                            <div key={line.id} className="rounded bg-[#f7f3e9] px-2 py-1">
                              <strong>{line.entity_name}</strong>: {line.source_account || "—"}{line.destination_account ? ` ← ${line.destination_account}` : ""} — {money(line.amount)} ر.س
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 font-bold whitespace-nowrap">{money(entry.total_amount)} ر.س</td>
                      <td className="p-3">{entry.description || "—"}</td>
                      <td className="p-3 whitespace-nowrap">
                        {canEdit ? (
                          <div className="flex gap-2">
                            <button type="button" onClick={() => editEntry(entry)} className="px-3 py-2 rounded-lg border border-[#9a7a3c] font-bold">تعديل</button>
                            <button type="button" onClick={() => deleteEntry(entry)} className="px-3 py-2 rounded-lg border border-red-300 text-red-700 font-bold">حذف</button>
                          </div>
                        ) : <span className="text-gray-500">عرض فقط</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
