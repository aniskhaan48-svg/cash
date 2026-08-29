const express = require("express");
const router = express.Router();

const authRoutes = require("./auth");
const dashboardRoutes = require("./dashboard");
const transactionRoutes = require("./transactions");
const usersRoutes = require("./users");
const settingsRoutes = require("./settings");
const inventoryRoutes = require("./inventory");
const masterDataRoutes = require("./masterData");
const cashboxesRoutes = require("./cashboxes");
const statementRoutes = require("./statement");
const openingBalancesRoutes = require("./openingBalances");
const treasuryRoutes = require("./treasury");
const { authenticate, authorize } = require("../middleware/auth");

router.get("/", (req, res) => {
  res.json({ name: "CashBox Cloud", status: "running" });
});

router.use("/api/auth", authRoutes);

router.use(
  "/api/dashboard",
  authenticate,
  authorize("CEO", "MANAGER", "ACCOUNTANT"),
  dashboardRoutes
);
router.use(
  "/api/transactions",
  authenticate,
  authorize("CEO", "MANAGER", "ACCOUNTANT"),
  transactionRoutes
);
router.use(
  "/api/users",
  authenticate,
  authorize("CEO"),
  usersRoutes
);
router.use(
  "/api/settings",
  authenticate,
  authorize("CEO", "MANAGER"),
  settingsRoutes
);
router.use(
  "/api/inventory",
  authenticate,
  authorize("CEO", "MANAGER", "STORE_KEEPER"),
  inventoryRoutes
);
router.use(
  "/api/master-data",
  authenticate,
  authorize("CEO", "MANAGER", "ACCOUNTANT"),
  masterDataRoutes
);
router.use(
  "/api/cashboxes",
  authenticate,
  authorize("CEO", "MANAGER", "ACCOUNTANT"),
  cashboxesRoutes
);
router.use(
  "/api/statement",
  authenticate,
  authorize("CEO", "MANAGER", "ACCOUNTANT"),
  statementRoutes
);
router.use(
  "/api/opening-balances",
  authenticate,
  authorize("CEO", "MANAGER"),
  openingBalancesRoutes
);

router.use(
  "/api/treasury",
  authenticate,
  authorize("CEO", "MANAGER", "ACCOUNTANT"),
  treasuryRoutes
);

module.exports = router;
