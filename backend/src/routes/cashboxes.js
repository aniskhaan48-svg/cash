const express = require("express");
const router = express.Router();

const {
  getCashboxes,
} = require("../controllers/cashboxesController");

router.get("/", getCashboxes);

module.exports = router;