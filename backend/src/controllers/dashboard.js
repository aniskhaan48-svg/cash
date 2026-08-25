const prisma = require("../config/prisma");

const dashboard = async (req, res) => {
  try {
    const { cashboxId } = req.query;

    const selectedCashboxId =
      cashboxId && cashboxId !== "all"
        ? Number(cashboxId)
        : null;

    const transactionWhere = selectedCashboxId
      ? {
          cashbox_id: BigInt(selectedCashboxId),
        }
      : {};

    const cashboxWhere = selectedCashboxId
      ? {
          is_active: true,
          id: BigInt(selectedCashboxId),
        }
      : {
          is_active: true,
        };

    const transactions = await prisma.transactions.findMany({
      where: transactionWhere,
    });

    const cashboxes = await prisma.cashboxes.findMany({
      where: cashboxWhere,
    });

    const lastTransactions = await prisma.transactions.findMany({
      where: transactionWhere,
      include: {
        cashboxes: true,
      },
      orderBy: {
        id: "desc",
      },
      take: 10,
    });

    let income = 0;
    let expense = 0;

    const cashboxesMap = {};

    // إنشاء الصناديق المطلوبة حتى لو الرصيد صفر
    cashboxes.forEach((box) => {
      cashboxesMap[Number(box.id)] = {
        id: Number(box.id),
        name: box.name_ar,
        balance: 0,
      };
    });

    // حساب الإيرادات والمصروفات وأرصدة الصناديق
    transactions.forEach((t) => {
      const amount = Number(t.amount);
      const id = Number(t.cashbox_id);

      // سند قبض / إيراد = مدين
      if (t.type === "IN") {
        income += amount;

        if (cashboxesMap[id]) {
          cashboxesMap[id].balance += amount;
        }
      }

      // سند صرف / مصروف = دائن
      if (t.type === "OUT") {
        expense += amount;

        if (cashboxesMap[id]) {
          cashboxesMap[id].balance -= amount;
        }
      }
    });

    // تجهيز آخر 10 عمليات
    const transactionsData = lastTransactions.map((t) => {
      return {
        id: Number(t.id),
        date: t.transaction_date,
        cashbox: t.cashboxes?.name_ar || "-",
        description: t.description || "-",

        // سند القبض / الإيراد = مدين
        debit:
          t.type === "IN"
            ? Number(t.amount)
            : null,

        // سند الصرف / المصروف = دائن
        credit:
          t.type === "OUT"
            ? Number(t.amount)
            : null,
      };
    });

    return res.json({
      selectedCashboxId,

      currentBalance: income - expense,

      todayIncome: income,

      todayExpense: expense,

      todayTransactions: transactions.length,

      cashboxes: Object.values(cashboxesMap),

      lastTransactions: transactionsData,
    });
  } catch (error) {
    console.error("Dashboard Error:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

module.exports = dashboard;