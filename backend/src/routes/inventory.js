const express = require("express");
const prisma = require("../config/prisma");

const router = express.Router();

const toDateKey = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const calculateStock = (movements = []) =>
  movements.reduce((total, movement) => {
    if (movement.movement_type === "IN") return total + Number(movement.quantity);
    if (movement.movement_type === "OUT") return total - Number(movement.quantity);
    return total;
  }, 0);

router.get("/stock", async (req, res) => {
  try {
    const items = await prisma.items.findMany({
      include: { movements: true },
      orderBy: { id: "asc" },
    });

    const result = items.map((item) => ({
      id: Number(item.id),
      name: item.name,
      unit: item.unit,
      stock: calculateStock(item.movements),
    }));

    return res.json(result);
  } catch (error) {
    console.error("Inventory Stock Error:", error);
    return res.status(500).json({ message: "Error loading stock" });
  }
});

router.get("/dashboard", async (req, res) => {
  try {
    const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || ""))
      ? String(req.query.date)
      : new Date().toISOString().slice(0, 10);

    const items = await prisma.items.findMany({
      include: {
        movements: {
          orderBy: [{ movement_date: "desc" }, { id: "desc" }],
        },
      },
      orderBy: { id: "asc" },
    });

    const itemSummaries = items.map((item) => {
      let stock = 0;
      let todayIn = 0;
      let todayOut = 0;

      for (const movement of item.movements) {
        const qty = Number(movement.quantity || 0);
        if (movement.movement_type === "IN") stock += qty;
        if (movement.movement_type === "OUT") stock -= qty;

        if (toDateKey(movement.movement_date) === selectedDate) {
          if (movement.movement_type === "IN") todayIn += qty;
          if (movement.movement_type === "OUT") todayOut += qty;
        }
      }

      return {
        id: Number(item.id),
        name: item.name,
        unit: item.unit,
        stock,
        todayIn,
        todayOut,
        minStock: Number(item.min_stock || 0),
      };
    });

    const recentMovements = await prisma.stock_movements.findMany({
      include: { item: true },
      orderBy: [{ movement_date: "desc" }, { id: "desc" }],
      take: 12,
    });

    const totals = itemSummaries.reduce(
      (acc, item) => {
        acc.currentStock += item.stock;
        acc.todayIn += item.todayIn;
        acc.todayOut += item.todayOut;
        return acc;
      },
      { currentStock: 0, todayIn: 0, todayOut: 0 }
    );

    return res.json({
      date: selectedDate,
      items: itemSummaries,
      totals,
      recentMovements: recentMovements.map((movement) => ({
        id: Number(movement.id),
        itemId: Number(movement.item_id),
        itemName: movement.item?.name || "-",
        unit: movement.item?.unit || "",
        type: movement.movement_type,
        quantity: Number(movement.quantity || 0),
        date: movement.movement_date,
        notes: movement.notes || "",
      })),
    });
  } catch (error) {
    console.error("Inventory Dashboard Error:", error);
    return res.status(500).json({ message: "Error loading inventory dashboard" });
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

    const currentStock = calculateStock(item.movements);

    if (qty > currentStock) {
      return res.status(400).json({
        success: false,
        message: "الكمية المطلوبة أكبر من الرصيد المتاح",
      });
    }

    const date = movement_date
      ? new Date(`${movement_date}T00:00:00Z`)
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

    const item = await prisma.items.findUnique({
      where: { id: BigInt(item_id) },
      select: { id: true },
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    const date = movement_date
      ? new Date(`${movement_date}T00:00:00Z`)
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


router.get("/report", async (req, res) => {
  try {
    const period = req.query.period === "monthly" ? "monthly" : "daily";
    const today = new Date().toISOString().slice(0, 10);

    let startKey;
    let endKey;
    let label;

    if (period === "monthly") {
      const month = /^\d{4}-\d{2}$/.test(String(req.query.month || ""))
        ? String(req.query.month)
        : today.slice(0, 7);
      const [year, monthNumber] = month.split("-").map(Number);
      const end = new Date(Date.UTC(year, monthNumber, 0));
      startKey = `${month}-01`;
      endKey = end.toISOString().slice(0, 10);
      label = month;
    } else {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || ""))
        ? String(req.query.date)
        : today;
      startKey = date;
      endKey = date;
      label = date;
    }

    const items = await prisma.items.findMany({
      include: {
        movements: {
          orderBy: [{ movement_date: "asc" }, { id: "asc" }],
        },
      },
      orderBy: { id: "asc" },
    });

    const itemReports = items.map((item) => {
      let openingStock = 0;
      let periodIn = 0;
      let periodOut = 0;
      const periodMovements = [];

      for (const movement of item.movements) {
        const dateKey = toDateKey(movement.movement_date);
        const qty = Number(movement.quantity || 0);
        const delta = movement.movement_type === "IN" ? qty : -qty;

        if (dateKey < startKey) {
          openingStock += delta;
          continue;
        }

        if (dateKey >= startKey && dateKey <= endKey) {
          if (movement.movement_type === "IN") periodIn += qty;
          if (movement.movement_type === "OUT") periodOut += qty;
          periodMovements.push(movement);
        }
      }

      let running = openingStock;
      const movementRows = periodMovements.map((movement) => {
        const qty = Number(movement.quantity || 0);
        running += movement.movement_type === "IN" ? qty : -qty;
        return {
          id: Number(movement.id),
          itemId: Number(item.id),
          itemName: item.name,
          unit: item.unit,
          type: movement.movement_type,
          quantity: qty,
          date: movement.movement_date,
          notes: movement.notes || "",
          balanceAfter: running,
        };
      });

      return {
        id: Number(item.id),
        name: item.name,
        unit: item.unit,
        openingStock,
        totalIn: periodIn,
        totalOut: periodOut,
        closingStock: openingStock + periodIn - periodOut,
        movements: movementRows,
      };
    });

    const totals = itemReports.reduce(
      (acc, item) => {
        acc.openingStock += item.openingStock;
        acc.totalIn += item.totalIn;
        acc.totalOut += item.totalOut;
        acc.closingStock += item.closingStock;
        acc.movementCount += item.movements.length;
        return acc;
      },
      { openingStock: 0, totalIn: 0, totalOut: 0, closingStock: 0, movementCount: 0 }
    );

    const movements = itemReports
      .flatMap((item) => item.movements)
      .sort((a, b) => {
        const dateDiff = String(b.date).localeCompare(String(a.date));
        return dateDiff || b.id - a.id;
      });

    return res.json({
      period,
      label,
      from: startKey,
      to: endKey,
      items: itemReports.map(({ movements: _movements, ...item }) => item),
      totals,
      movements,
    });
  } catch (error) {
    console.error("Inventory Report Error:", error);
    return res.status(500).json({ message: "Error loading inventory report" });
  }
});

module.exports = router;
