const prisma = require("../config/prisma");
const {
  getDeletedTransactionIds,
  recalculateCashboxBalances,
  toPlainJson,
  writeAudit,
} = require("../services/cashboxLedger");

async function validateTransactionInput(payload) {
  const {
    type,
    amount,
    description,
    cashbox_id,
    category_id,
    transaction_date,
  } = payload;

  const numericAmount = Number(amount);

  if (
    !["IN", "OUT"].includes(type) ||
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0 ||
    !cashbox_id ||
    !category_id
  ) {
    return { error: "بيانات العملية غير مكتملة أو غير صحيحة" };
  }

  const [cashbox, category] = await Promise.all([
    prisma.cashboxes.findUnique({ where: { id: BigInt(cashbox_id) } }),
    prisma.categories.findUnique({ where: { id: BigInt(category_id) } }),
  ]);

  if (!cashbox || cashbox.is_active === false) return { error: "الصندوق غير صالح" };
  if (!category || category.is_active === false) return { error: "التصنيف غير صالح" };

  const expectedCategoryType = type === "IN" ? "INCOME" : "EXPENSE";
  if (category.type !== expectedCategoryType) {
    return { error: "التصنيف لا يتوافق مع نوع العملية" };
  }

  const txDate = transaction_date
    ? new Date(`${transaction_date}T00:00:00`)
    : new Date();

  if (Number.isNaN(txDate.getTime())) return { error: "تاريخ العملية غير صحيح" };

  return {
    data: {
      cashbox_id: BigInt(cashbox_id),
      category_id: BigInt(category_id),
      type,
      amount: numericAmount,
      description: description ? String(description).trim() : null,
      transaction_date: txDate,
    },
  };
}

const createTransaction = async (req, res) => {
  try {
    const validated = await validateTransactionInput(req.body);
    if (validated.error) return res.status(400).json({ message: validated.error });

    const transaction = await prisma.transactions.create({
      data: {
        ...validated.data,
        created_by: BigInt(req.user.id),
      },
    });

    await writeAudit({
      userId: req.user.id,
      action: "CREATE",
      tableName: "transactions",
      recordId: transaction.id,
      newValues: toPlainJson(transaction),
    });

    await recalculateCashboxBalances(transaction.cashbox_id);
    const saved = await prisma.transactions.findUnique({ where: { id: transaction.id } });

    return res.status(201).json({
      message: "Transaction created",
      transaction: {
        id: Number(saved.id),
        type: saved.type,
        amount: Number(saved.amount),
        description: saved.description,
        transaction_date: saved.transaction_date,
        cashbox_id: Number(saved.cashbox_id),
        category_id: Number(saved.category_id),
        balance_after: Number(saved.balance_after || 0),
      },
    });
  } catch (error) {
    console.error("Create Transaction Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const getTransactions = async (req, res) => {
  try {
    // Recalculate stored running balances so old and back-dated movements also
    // show the correct balance_after value in the operations list.
    const activeCashboxes = await prisma.cashboxes.findMany({
      where: { is_active: true },
      select: { id: true },
    });
    await Promise.all(activeCashboxes.map((box) => recalculateCashboxBalances(box.id)));

    const [transactions, deletedIds] = await Promise.all([
      prisma.transactions.findMany({
        include: { cashboxes: true, categories: true, users: true },
        orderBy: [{ transaction_date: "desc" }, { id: "desc" }],
      }),
      getDeletedTransactionIds(),
    ]);

    return res.json(
      transactions
        .filter((t) => !deletedIds.has(String(t.id)))
        .map((t) => ({
          id: Number(t.id),
          type: t.type,
          amount: Number(t.amount),
          description: t.description,
          transaction_date: t.transaction_date,
          cashbox_id: Number(t.cashbox_id),
          category_id: Number(t.category_id),
          cashbox: t.cashboxes.name_ar,
          category: t.categories.name_ar,
          created_by: t.users.full_name,
          balance_after: Number(t.balance_after || 0),
        }))
    );
  } catch (error) {
    console.error("Get Transactions Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const updateTransaction = async (req, res) => {
  try {
    const id = BigInt(req.params.id);
    const deletedIds = await getDeletedTransactionIds();
    if (deletedIds.has(String(id))) {
      return res.status(404).json({ message: "الحركة محذوفة" });
    }

    const existing = await prisma.transactions.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "الحركة غير موجودة" });

    const validated = await validateTransactionInput(req.body);
    if (validated.error) return res.status(400).json({ message: validated.error });

    const oldCashboxId = existing.cashbox_id;
    const updated = await prisma.transactions.update({
      where: { id },
      data: validated.data,
    });

    await writeAudit({
      userId: req.user.id,
      action: "UPDATE",
      tableName: "transactions",
      recordId: id,
      oldValues: toPlainJson(existing),
      newValues: toPlainJson(updated),
    });

    await recalculateCashboxBalances(oldCashboxId);
    if (String(oldCashboxId) !== String(updated.cashbox_id)) {
      await recalculateCashboxBalances(updated.cashbox_id);
    }

    const refreshed = await prisma.transactions.findUnique({ where: { id } });
    return res.json({
      message: "تم تعديل الحركة بنجاح",
      transaction: {
        id: Number(refreshed.id),
        balance_after: Number(refreshed.balance_after || 0),
      },
    });
  } catch (error) {
    console.error("Update Transaction Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const deleteTransaction = async (req, res) => {
  try {
    const id = BigInt(req.params.id);
    const deletedIds = await getDeletedTransactionIds();
    if (deletedIds.has(String(id))) {
      return res.status(404).json({ message: "الحركة محذوفة مسبقًا" });
    }

    const existing = await prisma.transactions.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "الحركة غير موجودة" });

    // Soft delete: keep the financial movement in the database and record the
    // deletion in audit_logs. All financial reads exclude records with this audit action.
    await writeAudit({
      userId: req.user.id,
      action: "DELETE",
      tableName: "transactions",
      recordId: id,
      oldValues: toPlainJson(existing),
      newValues: { deleted: true },
    });

    await recalculateCashboxBalances(existing.cashbox_id);

    return res.json({ message: "تم حذف الحركة مع الاحتفاظ بسجل المراجعة" });
  } catch (error) {
    console.error("Delete Transaction Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createTransaction,
  getTransactions,
  updateTransaction,
  deleteTransaction,
};
