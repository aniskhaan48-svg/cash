const express = require("express");

const {
  createTransaction,
  getTransactions,
} = require("../controllers/transactions");

const router = express.Router();

router.get("/", getTransactions);
router.post("/", createTransaction);

module.exports = router;