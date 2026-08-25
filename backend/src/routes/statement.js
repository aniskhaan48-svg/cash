const express = require("express");
const router = express.Router();

const {
  getStatement,
} = require("../controllers/statementController");

router.get("/", getStatement);

module.exports = router;