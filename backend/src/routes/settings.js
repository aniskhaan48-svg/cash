const express = require("express");
const {
  getSettings,
  updateSettings,
} = require("../controllers/settings");

const router = express.Router();

router.get("/", getSettings);
router.put("/", updateSettings);

module.exports = router;