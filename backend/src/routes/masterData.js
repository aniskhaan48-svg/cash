const express = require("express");
const prisma = require("../config/prisma");
const { authorize } = require("../middleware/auth");

const router = express.Router();

const ACCOUNT_GROUPS = new Set(["INCOME", "EXPENSE", "ASSET"]);

const groupToCategoryType = (group) => (group === "INCOME" ? "INCOME" : "EXPENSE");

router.get("/cashboxes", async (req, res) => {
  try {
    const cashboxes = await prisma.cashboxes.findMany({
      where: { is_active: true },
      orderBy: { id: "asc" },
    });

    return res.json(
      cashboxes.map((item) => ({
        id: Number(item.id),
        name_ar: item.name_ar,
        name_en: item.name_en,
      }))
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/categories", async (req, res) => {
  try {
    const wantsAll = req.query.all === "1";
    const canManage = req.user && ["CEO", "MANAGER"].includes(req.user.role);

    const categories = await prisma.categories.findMany({
      where: wantsAll && canManage ? {} : { is_active: true },
      orderBy: [{ account_group: "asc" }, { name_ar: "asc" }, { id: "asc" }],
    });

    return res.json(
      categories.map((item) => ({
        id: Number(item.id),
        name_ar: item.name_ar,
        name_en: item.name_en,
        type: item.type,
        account_group: item.account_group || (item.type === "INCOME" ? "INCOME" : "EXPENSE"),
        is_active: item.is_active !== false,
      }))
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/categories", authorize("CEO", "MANAGER"), async (req, res) => {
  try {
    const nameAr = String(req.body.name_ar || "").trim();
    const nameEn = String(req.body.name_en || nameAr).trim() || nameAr;
    const accountGroup = String(req.body.account_group || "EXPENSE").toUpperCase();

    if (!nameAr) {
      return res.status(400).json({ message: "اكتب اسم الحساب" });
    }

    if (!ACCOUNT_GROUPS.has(accountGroup)) {
      return res.status(400).json({ message: "نوع الحساب غير صحيح" });
    }

    const duplicate = await prisma.categories.findFirst({
      where: { name_ar: nameAr },
    });

    if (duplicate) {
      return res.status(409).json({ message: "اسم الحساب موجود مسبقًا" });
    }

    const created = await prisma.categories.create({
      data: {
        name_ar: nameAr,
        name_en: nameEn,
        type: groupToCategoryType(accountGroup),
        account_group: accountGroup,
        is_active: true,
      },
    });

    return res.status(201).json({
      message: "تم حفظ الحساب",
      category: {
        id: Number(created.id),
        name_ar: created.name_ar,
        name_en: created.name_en,
        type: created.type,
        account_group: created.account_group,
        is_active: created.is_active !== false,
      },
    });
  } catch (error) {
    console.error("Create category error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

router.put("/categories/:id", authorize("CEO", "MANAGER"), async (req, res) => {
  try {
    const id = BigInt(req.params.id);
    const current = await prisma.categories.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ message: "الحساب غير موجود" });

    const nameAr = String(req.body.name_ar ?? current.name_ar).trim();
    const nameEn = String(req.body.name_en ?? current.name_en ?? nameAr).trim() || nameAr;
    const accountGroup = String(req.body.account_group ?? current.account_group ?? "EXPENSE").toUpperCase();
    const isActive = req.body.is_active === undefined ? current.is_active !== false : Boolean(req.body.is_active);

    if (!nameAr) return res.status(400).json({ message: "اكتب اسم الحساب" });
    if (!ACCOUNT_GROUPS.has(accountGroup)) {
      return res.status(400).json({ message: "نوع الحساب غير صحيح" });
    }

    const duplicate = await prisma.categories.findFirst({
      where: {
        name_ar: nameAr,
        NOT: { id },
      },
    });
    if (duplicate) return res.status(409).json({ message: "اسم الحساب موجود مسبقًا" });

    const updated = await prisma.categories.update({
      where: { id },
      data: {
        name_ar: nameAr,
        name_en: nameEn,
        account_group: accountGroup,
        type: groupToCategoryType(accountGroup),
        is_active: isActive,
      },
    });

    return res.json({
      message: "تم تحديث الحساب",
      category: {
        id: Number(updated.id),
        name_ar: updated.name_ar,
        name_en: updated.name_en,
        type: updated.type,
        account_group: updated.account_group,
        is_active: updated.is_active !== false,
      },
    });
  } catch (error) {
    console.error("Update category error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
