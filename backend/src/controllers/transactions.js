const prisma = require("../config/prisma");

const createTransaction = async (req, res) => {
  try {
    const {
      type,
      amount,
      description,
      cashbox_id,
      category_id,
      transaction_date,
    } = req.body;

    const numericAmount = Number(amount);

    if (
      !["IN", "OUT"].includes(type) ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      !cashbox_id ||
      !category_id
    ) {
      return res.status(400).json({
        message: "بيانات العملية غير مكتملة أو غير صحيحة",
      });
    }

    const [cashbox, category] = await Promise.all([
      prisma.cashboxes.findUnique({
        where: { id: BigInt(cashbox_id) },
      }),
      prisma.categories.findUnique({
        where: { id: BigInt(category_id) },
      }),
    ]);

    if (!cashbox || cashbox.is_active === false) {
      return res.status(400).json({ message: "الصندوق غير صالح" });
    }

    if (!category || category.is_active === false) {
      return res.status(400).json({ message: "التصنيف غير صالح" });
    }

    const expectedCategoryType = type === "IN" ? "INCOME" : "EXPENSE";
    if (category.type !== expectedCategoryType) {
      return res.status(400).json({
        message: "التصنيف لا يتوافق مع نوع العملية",
      });
    }

    const txDate = transaction_date
      ? new Date(`${transaction_date}T00:00:00`)
      : new Date();

    if (Number.isNaN(txDate.getTime())) {
      return res.status(400).json({ message: "تاريخ العملية غير صحيح" });
    }

    const transaction = await prisma.transactions.create({
      data: {
        cashbox_id: BigInt(cashbox_id),
        category_id: BigInt(category_id),
        type,
        amount: numericAmount,
        description: description || null,
        transaction_date: txDate,
        created_by: BigInt(req.user.id),
      },
    });

    return res.status(201).json({
      message: "Transaction created",
      transaction: {
        id: Number(transaction.id),
        type: transaction.type,
        amount: Number(transaction.amount),
        description: transaction.description,
        transaction_date: transaction.transaction_date,
        cashbox_id: Number(transaction.cashbox_id),
        category_id: Number(transaction.category_id),
      },
    });
  } catch (error) {
    console.error("Create Transaction Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const getTransactions = async (req, res) => {
  try {
    const transactions = await prisma.transactions.findMany({
      include: {
        cashboxes: true,
        categories: true,
        users: true,
      },
      orderBy: [
        { transaction_date: "desc" },
        { id: "desc" },
      ],
    });

    return res.json(
      transactions.map((t) => ({
        id: Number(t.id),
        type: t.type,
        amount: Number(t.amount),
        description: t.description,
        transaction_date: t.transaction_date,
        cashbox: t.cashboxes.name_ar,
        category: t.categories.name_ar,
        created_by: t.users.full_name,
      }))
    );
  } catch (error) {
    console.error("Get Transactions Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createTransaction,
  getTransactions,
};
