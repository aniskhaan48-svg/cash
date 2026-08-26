const prisma = require("../config/prisma");
const {
  getDeletedTransactionIds,
  getOpeningBalance,
  isOnOrAfterOpening,
  toPlainJson,
  toDateOnly,
} = require("../services/cashboxLedger");

const serialize = (value) => toPlainJson(value);

const getStatement = async (req, res) => {
  try {
    const { cashboxId, from, to } = req.query;

    if (!cashboxId || !from || !to) {
      return res.status(400).json({ message: "cashboxId, from and to are required" });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(from)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(to)) || from > to) {
      return res.status(400).json({ message: "Invalid date range" });
    }

    const [cashbox, opening, deletedIds, transactions] = await Promise.all([
      prisma.cashboxes.findUnique({ where: { id: BigInt(cashboxId) } }),
      getOpeningBalance(cashboxId),
      getDeletedTransactionIds(),
      prisma.transactions.findMany({
        where: { cashbox_id: BigInt(cashboxId) },
        orderBy: [{ transaction_date: "asc" }, { id: "asc" }],
        include: { categories: true },
      }),
    ]);

    if (!cashbox) return res.status(404).json({ message: "Cashbox not found" });

    let running = opening.exists ? Number(opening.amount || 0) : 0;
    let periodOpeningBalance = running;
    let openingCaptured = false;
    const rows = [];

    const activeTransactions = transactions.filter(
      (transaction) =>
        !deletedIds.has(String(transaction.id)) &&
        isOnOrAfterOpening(transaction.transaction_date, opening)
    );

    for (const transaction of activeTransactions) {
      const txDate = toDateOnly(transaction.transaction_date);
      if (!txDate) continue;

      if (txDate >= from && !openingCaptured) {
        periodOpeningBalance = running;
        openingCaptured = true;
      }

      const amount = Number(transaction.amount || 0);
      running += transaction.type === "IN" ? amount : -amount;

      if (txDate >= from && txDate <= to) {
        rows.push({
          ...serialize(transaction),
          runningBalance: running,
          balance_after: running,
        });
      }

      if (txDate > to) break;
    }

    if (!openingCaptured) periodOpeningBalance = running;

    // If the requested period begins before the fixed opening date, the ledger
    // officially starts on the opening date. We expose that date so the UI can explain it.
    return res.json({
      cashbox: { id: Number(cashbox.id), name_ar: cashbox.name_ar },
      fixedOpeningBalance: opening.exists ? opening.amount : 0,
      fixedOpeningDate: opening.date,
      openingBalance: periodOpeningBalance,
      closingBalance: rows.length ? Number(rows[rows.length - 1].runningBalance) : periodOpeningBalance,
      transactions: rows,
    });
  } catch (error) {
    console.error("Statement Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = { getStatement };
