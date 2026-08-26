const express = require("express");
const { authorize } = require("../middleware/auth");
const {
  createTransaction,
  getTransactions,
  updateTransaction,
  deleteTransaction,
} = require("../controllers/transactions");

const router = express.Router();

router.get("/", getTransactions);
router.post("/", createTransaction);
router.put("/:id", authorize("CEO", "MANAGER"), updateTransaction);
router.delete("/:id", authorize("CEO", "MANAGER"), deleteTransaction);

module.exports = router;
