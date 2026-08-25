const prisma = require("../config/prisma");

const getCashboxes = async (req, res) => {
  try {
    const cashboxes = await prisma.cashboxes.findMany({
      where: {
        is_active: true,
      },
      orderBy: {
        id: "asc",
      },
      select: {
        id: true,
        name_ar: true,
      },
    });

    const result = cashboxes.map((box) => ({
      id: Number(box.id),
      name_ar: box.name_ar,
    }));

    return res.json(result);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

module.exports = {
  getCashboxes,
};