"use client";

import { useEffect, useRef, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { apiFetch } from "../../lib/api";

export default function ReportsPage() {
  const [data, setData] = useState(null);
  const [cashboxes, setCashboxes] = useState([]);
  const [selectedCashbox, setSelectedCashbox] = useState("all");
  const [loading, setLoading] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  const reportRef = useRef(null);

  useEffect(() => {
    loadCashboxes();
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [selectedCashbox]);

  const loadCashboxes = async () => {
    try {
      const res = await apiFetch(
        "/api/cashboxes"
      );

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }

      const result = await res.json();
      setCashboxes(result);
    } catch (error) {
      console.error("Cashboxes Error:", error);
    }
  };

  const loadDashboard = async () => {
    try {
      setLoading(true);

      const url =
        selectedCashbox === "all"
          ? "/api/dashboard"
          : `/api/dashboard?cashboxId=${selectedCashbox}`;

      const res = await apiFetch(url);

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }

      const result = await res.json();
      setData(result);
    } catch (error) {
      console.error("Dashboard Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const getSelectedCashboxName = () => {
    if (selectedCashbox === "all") {
      return "كل الصناديق";
    }

    const box = cashboxes.find(
      (item) =>
        String(item.id) === String(selectedCashbox)
    );

    return box ? box.name_ar : "الصندوق";
  };

  const getSafeFileName = () => {
    return getSelectedCashboxName().replace(
      /[\\/:*?"<>|]/g,
      "-"
    );
  };

  // ==================================
  // تصدير Excel
  // ==================================
  const exportExcel = async () => {
    if (!data) {
      alert("لا توجد بيانات للتصدير");
      return;
    }

    try {
      setExportingExcel(true);

      const XLSXModule = await import("xlsx");
      const XLSX = XLSXModule.default || XLSXModule;

      const cashboxName =
        getSelectedCashboxName();

      const rows = [
        ["التقرير المالي التنفيذي"],
        [],
        ["الصندوق", cashboxName],
        [
          "الرصيد الحالي",
          Number(data.currentBalance || 0),
        ],
        [
          "إجمالي الإيرادات",
          Number(data.todayIncome || 0),
        ],
        [
          "إجمالي المصروفات",
          Number(data.todayExpense || 0),
        ],
        [
          "عدد العمليات",
          Number(data.todayTransactions || 0),
        ],
        [],
        [
          "رقم العملية",
          "التاريخ",
          "الصندوق",
          "البيان",
          "مدين",
          "دائن",
        ],
      ];

      (data.lastTransactions || []).forEach(
        (t) => {
          rows.push([
            t.id,
            new Date(
              t.date
            ).toLocaleDateString("en-GB"),
            t.cashbox,
            t.description || "-",

            // الإيراد / سند القبض = مدين
            t.debit != null
              ? Number(t.debit)
              : "",

            // المصروف / سند الصرف = دائن
            t.credit != null
              ? Number(t.credit)
              : "",
          ]);
        }
      );

      const worksheet =
        XLSX.utils.aoa_to_sheet(rows);

      worksheet["!cols"] = [
        { wch: 18 },
        { wch: 18 },
        { wch: 20 },
        { wch: 45 },
        { wch: 18 },
        { wch: 18 },
      ];

      const workbook =
        XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "التقرير المالي"
      );

      XLSX.writeFile(
        workbook,
        `financial-report-${getSafeFileName()}.xlsx`
      );

      alert("تم تصدير ملف Excel بنجاح");
    } catch (error) {
      console.error(
        "Excel Export Error:",
        error
      );

      alert(
        "حدث خطأ أثناء تصدير Excel. افتح Console وأرسل الخطأ إذا تكرر."
      );
    } finally {
      setExportingExcel(false);
    }
  };

  // ==================================
  // تصدير PDF
  // ==================================
  const exportPDF = async () => {
    if (!data) {
      alert("لا توجد بيانات للتصدير");
      return;
    }

    if (!reportRef.current) {
      alert("تعذر العثور على التقرير");
      return;
    }

    try {
      setExportingPDF(true);

      const html2canvasModule =
        await import("html2canvas-pro");

      const jsPDFModule =
        await import("jspdf");

      const html2canvas =
        html2canvasModule.default ||
        html2canvasModule;

      const JsPDF =
        jsPDFModule.jsPDF ||
        jsPDFModule.default;

      const canvas = await html2canvas(
        reportRef.current,
        {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
        }
      );

      const imageData =
        canvas.toDataURL("image/png");

      const pdf = new JsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageWidth =
        pdf.internal.pageSize.getWidth();

      const pageHeight =
        pdf.internal.pageSize.getHeight();

      const margin = 5;

      const printableWidth =
        pageWidth - margin * 2;

      const printableHeight =
        pageHeight - margin * 2;

      const imageWidth =
        printableWidth;

      const imageHeight =
        (canvas.height * imageWidth) /
        canvas.width;

      let heightLeft = imageHeight;

      let position = margin;

      pdf.addImage(
        imageData,
        "PNG",
        margin,
        position,
        imageWidth,
        imageHeight
      );

      heightLeft -= printableHeight;

      while (heightLeft > 0) {
        position =
          margin -
          (imageHeight - heightLeft);

        pdf.addPage();

        pdf.addImage(
          imageData,
          "PNG",
          margin,
          position,
          imageWidth,
          imageHeight
        );

        heightLeft -=
          printableHeight;
      }

      pdf.save(
        `financial-report-${getSafeFileName()}.pdf`
      );

      alert("تم تصدير ملف PDF بنجاح");
    } catch (error) {
      console.error(
        "PDF Export Error:",
        error
      );

      alert(
        "حدث خطأ أثناء تصدير PDF. افتح Console وأرسل الخطأ إذا تكرر."
      );
    } finally {
      setExportingPDF(false);
    }
  };

  if (!data) {
    return (
      <div className="p-10 text-center">
        جاري تحميل التقرير...
      </div>
    );
  }

  return (
    <div className="flex" dir="rtl">
      <Sidebar />

      <main className="flex-1 min-h-screen bg-gray-100 p-8">

        <h1 className="text-4xl font-bold text-center mb-8">
          التقرير المالي التنفيذي
        </h1>

        {/* اختيار الصندوق */}
        <div className="bg-white rounded-xl shadow p-6 mb-6">

          <label className="block mb-3 font-bold text-lg">
            اختر الصندوق
          </label>

          <select
            value={selectedCashbox}
            onChange={(e) =>
              setSelectedCashbox(
                e.target.value
              )
            }
            className="w-full border rounded-lg p-4 text-lg"
          >
            <option value="all">
              كل الصناديق
            </option>

            {cashboxes.map((box) => (
              <option
                key={box.id}
                value={box.id}
              >
                {box.name_ar}
              </option>
            ))}
          </select>

          {loading && (
            <p className="mt-3 text-sm text-gray-500">
              جاري تحديث التقرير...
            </p>
          )}

        </div>

        {/* ===================================
            منطقة التصدير - كبيرة وواضحة
        ==================================== */}
        <div className="bg-white rounded-xl shadow p-10 mb-8">

          <h2 className="text-2xl font-bold text-center mb-8">
            تصدير التقرير
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">

            {/* Excel */}
            <button
              type="button"
              onClick={exportExcel}
              disabled={
                loading ||
                exportingExcel ||
                exportingPDF
              }
              className="cb-export-btn cb-export-excel w-full min-h-28 text-white rounded-2xl px-10 py-7 transition"
            >
              <div className="text-3xl font-bold mb-2">
                Excel
              </div>

              <div className="text-lg">
                {exportingExcel
                  ? "جاري إنشاء الملف..."
                  : "تصدير التقرير إلى Excel"}
              </div>
            </button>

            {/* PDF */}
            <button
              type="button"
              onClick={exportPDF}
              disabled={
                loading ||
                exportingExcel ||
                exportingPDF
              }
              className="cb-export-btn cb-export-pdf w-full min-h-28 text-white rounded-2xl px-10 py-7 transition"
            >
              <div className="text-3xl font-bold mb-2">
                PDF
              </div>

              <div className="text-lg">
                {exportingPDF
                  ? "جاري إنشاء الملف..."
                  : "تصدير التقرير إلى PDF"}
              </div>
            </button>

          </div>

          <p className="text-center text-gray-500 mt-6">
            سيتم تصدير بيانات:{" "}
            <strong>
              {getSelectedCashboxName()}
            </strong>
          </p>

        </div>

        {/* الجزء الذي سيتم تحويله إلى PDF */}
        <div
          ref={reportRef}
          className="bg-gray-100 p-2"
        >

          <div className="bg-white rounded-xl shadow p-6 mb-8">

            <h2 className="text-2xl font-bold text-center">
              تقرير الصندوق:{" "}
              {getSelectedCashboxName()}
            </h2>

          </div>

          {/* البطاقات الرئيسية */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

            <div className="bg-white rounded-xl shadow p-6">

              <h2 className="text-lg mb-2">
                الرصيد الحالي
              </h2>

              <p className="text-4xl font-bold">
                {Number(
                  data.currentBalance
                ).toLocaleString()}{" "}
                ريال
              </p>

            </div>

            <div className="bg-white rounded-xl shadow p-6">

              <h2 className="text-lg mb-2">
                إجمالي الإيرادات
              </h2>

              <p className="text-4xl font-bold text-green-600">
                {Number(
                  data.todayIncome
                ).toLocaleString()}{" "}
                ريال
              </p>

            </div>

            <div className="bg-white rounded-xl shadow p-6">

              <h2 className="text-lg mb-2">
                إجمالي المصروفات
              </h2>

              <p className="text-4xl font-bold text-red-600">
                {Number(
                  data.todayExpense
                ).toLocaleString()}{" "}
                ريال
              </p>

            </div>

            <div className="bg-white rounded-xl shadow p-6">

              <h2 className="text-lg mb-2">
                عدد العمليات
              </h2>

              <p className="text-4xl font-bold">
                {data.todayTransactions}
              </p>

            </div>

          </div>

          {/* الرصيد حسب الصناديق */}
          <div className="mt-10">

            <h2 className="text-2xl font-bold mb-6">
              الرصيد حسب الصناديق
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

              {(data.cashboxes || []).map(
                (cashbox) => (
                  <div
                    key={cashbox.id}
                    className="bg-white rounded-xl shadow p-6"
                  >
                    <h3 className="text-xl font-bold mb-4">
                      🏦 {cashbox.name}
                    </h3>

                    <p className="text-gray-500 mb-2">
                      الرصيد الحالي
                    </p>

                    <p className="text-3xl font-bold text-green-600">
                      {Number(
                        cashbox.balance
                      ).toLocaleString()}{" "}
                      ريال
                    </p>
                  </div>
                )
              )}

            </div>

          </div>

          {/* آخر 10 عمليات */}
          <div className="mt-10 bg-white rounded-xl shadow p-8">

            <h2 className="text-2xl font-bold mb-6">
              آخر 10 عمليات مالية
            </h2>

            <div className="overflow-x-auto">

              <table className="w-full border-collapse">

                <thead>
                  <tr className="border-b bg-gray-100">

                    <th className="p-3 text-right">
                      رقم العملية
                    </th>

                    <th className="p-3 text-right">
                      التاريخ
                    </th>

                    <th className="p-3 text-right">
                      الصندوق
                    </th>

                    <th className="p-3 text-right">
                      البيان
                    </th>

                    <th className="p-3 text-center">
                      مدين
                    </th>

                    <th className="p-3 text-center">
                      دائن
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {(data.lastTransactions || []).map(
                    (t) => (
                      <tr
                        key={t.id}
                        className="border-b hover:bg-gray-50"
                      >

                        <td className="p-3">
                          {t.id}
                        </td>

                        <td className="p-3">
                          {new Date(
                            t.date
                          ).toLocaleDateString(
                            "en-GB"
                          )}
                        </td>

                        <td className="p-3">
                          {t.cashbox}
                        </td>

                        <td className="p-3">
                          {t.description || "-"}
                        </td>

                        {/* الإيراد = مدين */}
                        <td className="p-3 text-center font-bold text-green-600">
                          {t.debit != null
                            ? Number(
                                t.debit
                              ).toLocaleString()
                            : "-"}
                        </td>

                        {/* المصروف = دائن */}
                        <td className="p-3 text-center font-bold text-red-600">
                          {t.credit != null
                            ? Number(
                                t.credit
                              ).toLocaleString()
                            : "-"}
                        </td>

                      </tr>
                    )
                  )}

                </tbody>

              </table>

            </div>

            {(data.lastTransactions || [])
              .length === 0 && (
              <div className="text-center py-8 text-gray-500">
                لا توجد عمليات لهذا الصندوق
              </div>
            )}

          </div>

          {/* ملخص الإدارة */}
          <div className="mt-10 bg-white rounded-xl shadow p-8">

            <h2 className="text-2xl font-bold mb-4">
              ملخص الإدارة التنفيذية
            </h2>

            <ul className="space-y-3 text-lg">

              <li>
                الصندوق:{" "}
                <strong>
                  {getSelectedCashboxName()}
                </strong>
              </li>

              <li>
                عدد العمليات:{" "}
                {data.todayTransactions}
              </li>

              <li>
                إجمالي الإيرادات:{" "}
                <span className="font-bold text-green-600">
                  {Number(
                    data.todayIncome
                  ).toLocaleString()}{" "}
                  ريال
                </span>
              </li>

              <li>
                إجمالي المصروفات:{" "}
                <span className="font-bold text-red-600">
                  {Number(
                    data.todayExpense
                  ).toLocaleString()}{" "}
                  ريال
                </span>
              </li>

              <li>
                الرصيد الحالي:{" "}
                <span className="font-bold">
                  {Number(
                    data.currentBalance
                  ).toLocaleString()}{" "}
                  ريال
                </span>
              </li>

            </ul>

          </div>

        </div>

      </main>
    </div>
  );
}