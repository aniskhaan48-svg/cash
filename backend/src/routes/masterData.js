const express = require("express");
const prisma = require("../config/prisma");

const router = express.Router();

router.get("/cashboxes", async (req, res) => {
  try {
    const cashboxes = await prisma.cashboxes.findMany({
      where: {
        is_active: true,
      },
      orderBy: {
        id: "asc",
      },
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

    return res.status(500).json({
      message: "Server error",
    });
  }
});

router.get("/categories", async (req, res) => {
  try {
    const categories = await prisma.categories.findMany({
      where: {
        is_active: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    return res.json(
      categories.map((item) => ({
        id: Number(item.id),
        name_ar: item.name_ar,
        name_en: item.name_en,
        type: item.type,
      }))
    );
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Server error",
    });
  }
});

module.exports = router;