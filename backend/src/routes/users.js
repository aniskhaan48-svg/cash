const express = require("express");
const {
  getUsers,
  createUser,
  updateUser,
  changePassword,
} = require("../controllers/users");

const router = express.Router();

router.get("/", getUsers);
router.post("/", createUser);
router.put("/:id", updateUser);
router.patch("/:id/password", changePassword);

module.exports = router;
