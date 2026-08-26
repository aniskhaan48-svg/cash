const prisma = require("../config/prisma");

const toPlainJson = (value) =>
  JSON.parse(
    JSON.stringify(value, (_, item) => {
      if (typeof item === "bigint") return Number(item);
      if (item && typeof item === "object" && typeof item.toNumber === "function") {
        return item.toNumber();
      }
      return item;
    })
  );

const toDateOnly = (value) => {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

async function getDeletedTransactionIds() {
  const logs = await prisma.audit_logs.findMany({
    where: {
      table_name: "transactions",
      action: "DELETE",
    },
    select: { record_id: true },
  });

  return new Set(logs.map((log) => String(log.record_id)));
}

async function getOpeningBalance(cashboxId) {
  const log = await prisma.audit_logs.findFirst({
    where: {
      table_name: "cashboxes",
      record_id: BigInt(cashboxId),
      action: "OPENING_BALANCE_SET",
    },
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
  });

  if (!log) {
    return {
      exists: false,
      amount: 0,
      date: null,
      note: "",
      createdAt: null,
      createdBy: null,
      auditId: null,
    };
  }

  let values = log.new_values;
  if (typeof values === "string") {
    try { values = JSON.parse(values); } catch { values = {}; }
  }
  if (!values || typeof values !== "object") values = {};

  return {
    exists: true,
    amount: Number(values.amount || 0),
    date: toDateOnly(values.opening_date || values.date || log.created_at),
    note: String(values.note || ""),
    createdAt: log.created_at,
    createdBy: Number(log.user_id),
    auditId: Number(log.id),
  };
}

function isOnOrAfterOpening(transactionDate, opening) {
  if (!opening?.exists || !opening.date) return true;
  const txDate = toDateOnly(transactionDate);
  return Boolean(txDate && txDate >= opening.date);
}

async function writeAudit({ userId, action, tableName, recordId, oldValues = null, newValues = null }) {
  const data = {
    user_id: BigInt(userId),
    action,
    table_name: tableName,
    record_id: BigInt(recordId),
  };

  if (oldValues != null) data.old_values = toPlainJson(oldValues);
  if (newValues != null) data.new_values = toPlainJson(newValues);

  return prisma.audit_logs.create({ data });
}

async function recalculateCashboxBalances(cashboxId) {
  const [opening, deletedIds, transactions] = await Promise.all([
    getOpeningBalance(cashboxId),
    getDeletedTransactionIds(),
    prisma.transactions.findMany({
      where: { cashbox_id: BigInt(cashboxId) },
      orderBy: [{ transaction_date: "asc" }, { id: "asc" }],
    }),
  ]);

  let historicalRunning = 0;
  let liveRunning = opening.exists ? Number(opening.amount || 0) : 0;

  for (const transaction of transactions) {
    if (deletedIds.has(String(transaction.id))) continue;

    const amount = Number(transaction.amount || 0);
    const delta = transaction.type === "IN" ? amount : -amount;
    let nextBalance;

    if (opening.exists && !isOnOrAfterOpening(transaction.transaction_date, opening)) {
      // Historical movements keep their own running balance for audit/reporting,
      // but do not alter the live balance after the fixed opening count.
      historicalRunning += delta;
      nextBalance = historicalRunning;
    } else {
      liveRunning += delta;
      nextBalance = liveRunning;
    }

    if (Math.abs(Number(transaction.balance_after || 0) - nextBalance) > 0.004) {
      await prisma.transactions.update({
        where: { id: transaction.id },
        data: { balance_after: nextBalance },
      });
    }
  }

  return liveRunning;
}

async function getActiveTransactions({ cashboxId = null } = {}) {
  const [deletedIds, transactions] = await Promise.all([
    getDeletedTransactionIds(),
    prisma.transactions.findMany({
      where: cashboxId ? { cashbox_id: BigInt(cashboxId) } : {},
      orderBy: [{ transaction_date: "asc" }, { id: "asc" }],
    }),
  ]);

  return transactions.filter((transaction) => !deletedIds.has(String(transaction.id)));
}

module.exports = {
  getDeletedTransactionIds,
  getOpeningBalance,
  getActiveTransactions,
  isOnOrAfterOpening,
  recalculateCashboxBalances,
  toPlainJson,
  toDateOnly,
  writeAudit,
};
