const express = require("express");
const prisma = require("../config/prisma");
const {
  getOpeningBalance,
  recalculateCashboxBalances,
  writeAudit,
} = require("../services/cashboxLedger");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const [cashboxes, users] = await Promise.all([
      prisma.cashboxes.findMany({
        where: { is_active: true },
        orderBy: { id: "asc" },
      }),
      prisma.users.findMany({ select: { id: true, full_name: true, username: true } }),
    ]);
    const userMap = new Map(users.map((user) => [String(user.id), user.full_name || user.username]));

    const rows = await Promise.all(
      cashboxes.map(async (cashbox) => {
        const opening = await getOpeningBalance(cashbox.id);
        return {
          cashbox_id: Number(cashbox.id),
          cashbox_name: cashbox.name_ar,
          opening_balance: opening.amount,
          opening_date: opening.date,
          note: opening.note,
          is_locked: opening.exists,
          created_at: opening.createdAt,
          created_by: opening.createdBy,
          created_by_name: opening.createdBy ? userMap.get(String(opening.createdBy)) || `#${opening.createdBy}` : null,
        };
      })
    );

    return res.json(rows);
  } catch (error) {
    console.error("Opening Balance List Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { cashbox_id, amount, opening_date, note } = req.body;
    const numericAmount = Number(amount);

    if (
      !cashbox_id ||
      !Number.isFinite(numericAmount) ||
      numericAmount < 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(String(opening_date || ""))
    ) {
      return res.status(400).json({ message: "بيانات الرصيد الافتتاحي غير صحيحة" });
    }

    const cashbox = await prisma.cashboxes.findUnique({
      where: { id: BigInt(cashbox_id) },
    });

    if (!cashbox || cashbox.is_active === false) {
      return res.status(404).json({ message: "الصندوق غير موجود" });
    }

    const existing = await getOpeningBalance(cashbox_id);
    if (existing.exists) {
      return res.status(409).json({
        message: "تم تثبيت الرصيد الافتتاحي لهذا الصندوق مسبقًا ولا يمكن تغييره من هذه الشاشة",
      });
    }

    await writeAudit({
      userId: req.user.id,
      action: "OPENING_BALANCE_SET",
      tableName: "cashboxes",
      recordId: cashbox_id,
      newValues: {
        amount: numericAmount,
        opening_date,
        note: String(note || "").trim(),
        locked: true,
      },
    });

    const currentBalance = await recalculateCashboxBalances(cashbox_id);

    return res.status(201).json({
      message: "تم تثبيت الرصيد الافتتاحي بنجاح",
      cashbox_id: Number(cashbox_id),
      opening_balance: numericAmount,
      opening_date,
      current_balance: currentBalance,
    });
  } catch (error) {
    console.error("Opening Balance Save Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
