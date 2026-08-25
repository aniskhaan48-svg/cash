const express = require("express");
const prisma = require("../config/prisma");

const router = express.Router();

router.get("/stock", async (req, res) => {
  try {
    const items = await prisma.items.findMany({
      include: { movements: true },
      orderBy: { id: "asc" },
    });

    const result = items.map((item) => {
      const stock = item.movements.reduce((total, movement) => {
        if (movement.movement_type === "IN") {
          return total + Number(movement.quantity);
        }
        if (movement.movement_type === "OUT") {
          return total - Number(movement.quantity);
        }
        return total;
      }, 0);

      return {
        id: Number(item.id),
        name: item.name,
        unit: item.unit,
        stock,
      };
    });

    return res.json(result);
  } catch (error) {
    console.error("Inventory Stock Error:", error);
    return res.status(500).json({ message: "Error loading stock" });
  }
});

router.post("/consumption", async (req, res) => {
  try {
    const { item_id, quantity, movement_date } = req.body;
    const qty = Number(quantity);

    if (!item_id || !Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid item or quantity",
      });
    }

    const item = await prisma.items.findUnique({
      where: { id: BigInt(item_id) },
      include: { movements: true },
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    const currentStock = item.movements.reduce((total, movement) => {
      if (movement.movement_type === "IN") return total + Number(movement.quantity);
      if (movement.movement_type === "OUT") return total - Number(movement.quantity);
      return total;
    }, 0);

    if (qty > currentStock) {
      return res.status(400).json({
        success: false,
        message: "الكمية المطلوبة أكبر من الرصيد المتاح",
      });
    }

    const date = movement_date
      ? new Date(`${movement_date}T00:00:00`)
      : new Date();

    await prisma.stock_movements.create({
      data: {
        item_id: BigInt(item_id),
        movement_type: "OUT",
        quantity: qty,
        movement_date: date,
      },
    });

    return res.json({
      success: true,
      message: "Consumption saved successfully",
    });
  } catch (error) {
    console.error("Consumption Error:", error);
    return res.status(500).json({
      success: false,
      message: "Error saving consumption",
    });
  }
});

router.post("/stock-in", async (req, res) => {
  try {
    const { item_id, quantity, movement_date } = req.body;
    const qty = Number(quantity);

    if (!item_id || !Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid item or quantity",
      });
    }

    const date = movement_date
      ? new Date(`${movement_date}T00:00:00`)
      : new Date();

    await prisma.stock_movements.create({
      data: {
        item_id: BigInt(item_id),
        movement_type: "IN",
        quantity: qty,
        movement_date: date,
      },
    });

    return res.json({
      success: true,
      message: "Stock added successfully",
    });
  } catch (error) {
    console.error("Stock In Error:", error);
    return res.status(500).json({
      success: false,
      message: "Error adding stock",
    });
  }
});

module.exports = router;
