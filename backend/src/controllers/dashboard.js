const prisma = require("../config/prisma");
const {
  getDeletedTransactionIds,
  getOpeningBalance,
  isOnOrAfterOpening,
} = require("../services/cashboxLedger");

const dashboard = async (req, res) => {
  try {
    const { cashboxId } = req.query;

    const selectedCashboxId =
      cashboxId && cashboxId !== "all" ? Number(cashboxId) : null;

    const cashboxWhere = selectedCashboxId
      ? { is_active: true, id: BigInt(selectedCashboxId) }
      : { is_active: true };

    const [cashboxes, allTransactions, deletedIds] = await Promise.all([
      prisma.cashboxes.findMany({ where: cashboxWhere, orderBy: { id: "asc" } }),
      prisma.transactions.findMany({
        where: selectedCashboxId ? { cashbox_id: BigInt(selectedCashboxId) } : {},
        include: { cashboxes: true },
        orderBy: [{ transaction_date: "desc" }, { id: "desc" }],
      }),
      getDeletedTransactionIds(),
    ]);

    const openingByCashbox = new Map();
    const activeCashboxIds = new Set(cashboxes.map((box) => String(box.id)));
    await Promise.all(
      cashboxes.map(async (box) => {
        openingByCashbox.set(String(box.id), await getOpeningBalance(box.id));
      })
    );

    const activeTransactions = allTransactions.filter((transaction) => {
      if (!activeCashboxIds.has(String(transaction.cashbox_id))) return false;
      if (deletedIds.has(String(transaction.id))) return false;
      const opening = openingByCashbox.get(String(transaction.cashbox_id));
      return isOnOrAfterOpening(transaction.transaction_date, opening);
    });

    let income = 0;
    let expense = 0;
    let openingTotal = 0;
    const cashboxesMap = {};

    cashboxes.forEach((box) => {
      const opening = openingByCashbox.get(String(box.id));
      const openingAmount = opening?.exists ? Number(opening.amount || 0) : 0;
      openingTotal += openingAmount;
      cashboxesMap[Number(box.id)] = {
        id: Number(box.id),
        name: box.name_ar,
        openingBalance: openingAmount,
        openingDate: opening?.date || null,
        balance: openingAmount,
      };
    });

    activeTransactions.forEach((transaction) => {
      const amount = Number(transaction.amount || 0);
      const id = Number(transaction.cashbox_id);

      if (transaction.type === "IN") {
        income += amount;
        if (cashboxesMap[id]) cashboxesMap[id].balance += amount;
      } else if (transaction.type === "OUT") {
        expense += amount;
        if (cashboxesMap[id]) cashboxesMap[id].balance -= amount;
      }
    });

    const runningByCashbox = {};
    const balanceAfterMap = new Map();
    cashboxes.forEach((box) => {
      const opening = openingByCashbox.get(String(box.id));
      runningByCashbox[String(box.id)] = opening?.exists ? Number(opening.amount || 0) : 0;
    });

    [...activeTransactions]
      .sort((a, b) => {
        const dateDiff = new Date(a.transaction_date) - new Date(b.transaction_date);
        if (dateDiff !== 0) return dateDiff;
        return Number(a.id - b.id);
      })
      .forEach((transaction) => {
        const key = String(transaction.cashbox_id);
        const amount = Number(transaction.amount || 0);
        runningByCashbox[key] += transaction.type === "IN" ? amount : -amount;
        balanceAfterMap.set(String(transaction.id), runningByCashbox[key]);
      });

    const lastTransactions = activeTransactions.slice(0, 10).map((transaction) => ({
      id: Number(transaction.id),
      date: transaction.transaction_date,
      cashbox: transaction.cashboxes?.name_ar || "-",
      description: transaction.description || "-",
      debit: transaction.type === "IN" ? Number(transaction.amount) : null,
      credit: transaction.type === "OUT" ? Number(transaction.amount) : null,
      balanceAfter: Number(balanceAfterMap.get(String(transaction.id)) ?? transaction.balance_after ?? 0),
    }));

    return res.json({
      selectedCashboxId,
      openingBalance: openingTotal,
      currentBalance: openingTotal + income - expense,
      todayIncome: income,
      todayExpense: expense,
      todayTransactions: activeTransactions.length,
      cashboxes: Object.values(cashboxesMap),
      lastTransactions,
    });
  } catch (error) {
    console.error("Dashboard Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = dashboard;
