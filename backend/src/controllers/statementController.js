const prisma = require("../config/prisma");

const serialize = (value) =>
  JSON.parse(
    JSON.stringify(value, (_, item) =>
      typeof item === "bigint" ? Number(item) : item
    )
  );

const getStatement = async (req, res) => {
  try {
    const { cashboxId, from, to } = req.query;

    if (!cashboxId || !from || !to) {
      return res.status(400).json({
        message: "cashboxId, from and to are required",
      });
    }

    const fromDate = new Date(`${from}T00:00:00`);
    const toDate = new Date(`${to}T23:59:59.999`);

    if (
      Number.isNaN(fromDate.getTime()) ||
      Number.isNaN(toDate.getTime()) ||
      fromDate > toDate
    ) {
      return res.status(400).json({ message: "Invalid date range" });
    }

    const transactions = await prisma.transactions.findMany({
      where: {
        cashbox_id: BigInt(cashboxId),
        transaction_date: {
          gte: fromDate,
          lte: toDate,
        },
      },
      orderBy: [
        { transaction_date: "asc" },
        { id: "asc" },
      ],
      include: {
        categories: true,
      },
    });

    return res.json(serialize(transactions));
  } catch (error) {
    console.error("Statement Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = { getStatement };
