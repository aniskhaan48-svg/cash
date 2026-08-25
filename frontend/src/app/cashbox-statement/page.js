"use client";

import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { apiFetch } from "../../lib/api";

export default function CashboxStatementPage() {
  const [cashboxes, setCashboxes] = useState([]);
  const [cashboxId, setCashboxId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [statement, setStatement] = useState([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    loadCashboxes();
  }, []);

  const loadCashboxes = async () => {
    try {
      const res = await apiFetch(
        "/api/cashboxes"
      );

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }

      const data = await res.json();
      setCashboxes(data);
    } catch (error) {
      console.error("Cashboxes Error:", error);
    }
  };

  const getPreviousDate = (dateString) => {
    const date = new Date(`${dateString}T00:00:00`);

    date.setDate(date.getDate() - 1);

    const year = date.getFullYear();
    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  // الرصيد = القبض - الصرف
  const calculateBalance = (transactions) => {
    return transactions.reduce(
      (balance, transaction) => {
        const amount = Number(transaction.amount);

        // سند قبض = مدين = يزيد الرصيد
        if (transaction.type === "IN") {
          return balance + amount;
        }

        // سند صرف = دائن = ينقص الرصيد
        if (transaction.type === "OUT") {
          return balance - amount;
        }

        return balance;
      },
      0
    );
  };

  const loadStatement = async () => {
    if (!cashboxId) {
      alert("يرجى اختيار الصندوق");
      return;
    }

    if (!fromDate || !toDate) {
      alert("يرجى اختيار الفترة");
      return;
    }

    if (fromDate > toDate) {
      alert(
        "تاريخ البداية يجب أن يكون قبل تاريخ النهاية"
      );
      return;
    }

    try {
      setLoading(true);
      setSearched(false);

      // ----------------------------
      // الرصيد الافتتاحي
      // ----------------------------

      const previousDate =
        getPreviousDate(fromDate);

      const openingRes = await apiFetch(
        `/api/statement?cashboxId=${cashboxId}&from=2000-01-01&to=${previousDate}`
      );

      if (!openingRes.ok) {
        throw new Error(
          `Opening Balance HTTP Error ${openingRes.status}`
        );
      }

      const previousTransactions =
        await openingRes.json();

      const opening = calculateBalance(
        previousTransactions
      );

      setOpeningBalance(opening);

      // ----------------------------
      // عمليات الفترة
      // ----------------------------

      const statementRes = await apiFetch(
        `/api/statement?cashboxId=${cashboxId}&from=${fromDate}&to=${toDate}`
      );

      if (!statementRes.ok) {
        throw new Error(
          `Statement HTTP Error ${statementRes.status}`
        );
      }

      const data = await statementRes.json();

      // ----------------------------
      // الرصيد بعد كل عملية
      // ----------------------------

      let runningBalance = opening;

      const transactionsWithBalance =
        data.map((transaction) => {
          const amount = Number(
            transaction.amount
          );

          // سند قبض = مدين
          if (transaction.type === "IN") {
            runningBalance += amount;
          }

          // سند صرف = دائن
          if (transaction.type === "OUT") {
            runningBalance -= amount;
          }

          return {
            ...transaction,
            runningBalance,
          };
        });

      setStatement(
        transactionsWithBalance
      );

      setSearched(true);
    } catch (error) {
      console.error(
        "Statement Error:",
        error
      );

      alert(
        "حدث خطأ أثناء تحميل كشف الحساب"
      );
    } finally {
      setLoading(false);
    }
  };

  const selectedCashbox =
    cashboxes.find(
      (box) =>
        String(box.id) === String(cashboxId)
    );

  // سند القبض = مدين
  const totalDebit = statement.reduce(
    (total, transaction) =>
      transaction.type === "IN"
        ? total + Number(transaction.amount)
        : total,
    0
  );

  // سند الصرف = دائن
  const totalCredit = statement.reduce(
    (total, transaction) =>
      transaction.type === "OUT"
        ? total + Number(transaction.amount)
        : total,
    0
  );

  const closingBalance =
    statement.length > 0
      ? statement[
          statement.length - 1
        ].runningBalance
      : openingBalance;

  const formatNumber = (value) => {
    return Number(
      value || 0
    ).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (value) => {
    if (!value) {
      return "-";
    }

    return new Date(
      value
    ).toLocaleDateString("en-GB");
  };

  return (
    <div
      className="flex"
      dir="rtl"
    >
      <Sidebar />

      <main className="flex-1 min-h-screen bg-gray-100 p-8">

        <h1 className="text-4xl font-bold text-center mb-8">
          كشف حساب الصندوق
        </h1>

        {/* البحث */}
        <div className="bg-white rounded-xl shadow p-6">

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

            <div>
              <label className="block mb-2 font-semibold">
                الصندوق
              </label>

              <select
                value={cashboxId}
                onChange={(e) =>
                  setCashboxId(
                    e.target.value
                  )
                }
                className="w-full border rounded-lg p-3"
              >
                <option value="">
                  اختر الصندوق
                </option>

                {cashboxes.map(
                  (box) => (
                    <option
                      key={box.id}
                      value={box.id}
                    >
                      {box.name_ar}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="block mb-2 font-semibold">
                من تاريخ
              </label>

              <input
                type="date"
                value={fromDate}
                onChange={(e) =>
                  setFromDate(
                    e.target.value
                  )
                }
                className="w-full border rounded-lg p-3"
              />
            </div>

            <div>
              <label className="block mb-2 font-semibold">
                إلى تاريخ
              </label>

              <input
                type="date"
                value={toDate}
                onChange={(e) =>
                  setToDate(
                    e.target.value
                  )
                }
                className="w-full border rounded-lg p-3"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={loadStatement}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg p-3 font-bold"
              >
                {loading
                  ? "جاري التحميل..."
                  : "عرض كشف الحساب"}
              </button>
            </div>

          </div>
        </div>

        {searched && (
          <div className="mt-8 bg-white rounded-xl shadow p-6">

            {/* رأس كشف الحساب */}
            <div className="text-center mb-8">

              <h2 className="text-2xl font-bold">
                كشف حساب
              </h2>

              <p className="text-xl font-bold mt-2">
                {selectedCashbox?.name_ar ||
                  "-"}
              </p>

              <p className="mt-2 text-gray-600">
                من {fromDate} إلى {toDate}
              </p>

            </div>

            {/* الملخص */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">

              <div className="border rounded-xl p-4">
                <p className="text-gray-500">
                  الرصيد الافتتاحي
                </p>

                <p className="text-2xl font-bold mt-2">
                  {formatNumber(
                    openingBalance
                  )}{" "}
                  ريال
                </p>
              </div>

              <div className="border rounded-xl p-4">
                <p className="text-gray-500">
                  إجمالي المدين
                </p>

                <p className="text-2xl font-bold text-green-600 mt-2">
                  {formatNumber(
                    totalDebit
                  )}{" "}
                  ريال
                </p>
              </div>

              <div className="border rounded-xl p-4">
                <p className="text-gray-500">
                  إجمالي الدائن
                </p>

                <p className="text-2xl font-bold text-red-600 mt-2">
                  {formatNumber(
                    totalCredit
                  )}{" "}
                  ريال
                </p>
              </div>

              <div className="border rounded-xl p-4">
                <p className="text-gray-500">
                  الرصيد الختامي
                </p>

                <p className="text-2xl font-bold mt-2">
                  {formatNumber(
                    closingBalance
                  )}{" "}
                  ريال
                </p>
              </div>

            </div>

            {/* الجدول */}
            <div className="overflow-x-auto">

              <table className="w-full border-collapse border">

                <thead>
                  <tr className="bg-gray-100">

                    <th className="border p-3">
                      التاريخ
                    </th>

                    <th className="border p-3">
                      نوع المستند
                    </th>

                    <th className="border p-3">
                      رقم المستند
                    </th>

                    <th className="border p-3">
                      البيان
                    </th>

                    <th className="border p-3">
                      التصنيف
                    </th>

                    <th className="border p-3">
                      مدين
                    </th>

                    <th className="border p-3">
                      دائن
                    </th>

                    <th className="border p-3">
                      الرصيد
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {/* الرصيد الافتتاحي */}
                  <tr className="bg-yellow-50">

                    <td className="border p-3">
                      {fromDate}
                    </td>

                    <td className="border p-3">
                      -
                    </td>

                    <td className="border p-3">
                      -
                    </td>

                    <td className="border p-3 font-bold">
                      الرصيد الافتتاحي
                    </td>

                    <td className="border p-3">
                      -
                    </td>

                    <td className="border p-3 text-center">
                      -
                    </td>

                    <td className="border p-3 text-center">
                      -
                    </td>

                    <td className="border p-3 font-bold text-center">
                      {formatNumber(
                        openingBalance
                      )}
                    </td>

                  </tr>

                  {statement.map(
                    (transaction) => (
                      <tr
                        key={
                          transaction.id
                        }
                        className="hover:bg-gray-50"
                      >

                        <td className="border p-3">
                          {formatDate(
                            transaction.transaction_date
                          )}
                        </td>

                        <td className="border p-3">
                          {transaction.type ===
                          "IN"
                            ? "سند قبض نقدي"
                            : "سند صرف نقدي"}
                        </td>

                        <td className="border p-3 text-center">
                          {transaction.id}
                        </td>

                        <td className="border p-3">
                          {transaction.description ||
                            "-"}
                        </td>

                        <td className="border p-3">
                          {transaction
                            .categories
                            ?.name_ar ||
                            "-"}
                        </td>

                        {/* مدين = سند قبض */}
                        <td className="border p-3 text-center font-bold text-green-600">
                          {transaction.type ===
                          "IN"
                            ? formatNumber(
                                transaction.amount
                              )
                            : "-"}
                        </td>

                        {/* دائن = سند صرف */}
                        <td className="border p-3 text-center font-bold text-red-600">
                          {transaction.type ===
                          "OUT"
                            ? formatNumber(
                                transaction.amount
                              )
                            : "-"}
                        </td>

                        <td className="border p-3 text-center font-bold">
                          {formatNumber(
                            transaction.runningBalance
                          )}
                        </td>

                      </tr>
                    )
                  )}

                </tbody>

              </table>

            </div>

            {statement.length === 0 && (
              <div className="text-center p-8 text-gray-500">
                لا توجد عمليات في الفترة المحددة
              </div>
            )}

          </div>
        )}

      </main>
    </div>
  );
}