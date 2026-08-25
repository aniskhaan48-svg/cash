const prisma = require("../config/prisma");
const bcrypt = require("bcrypt");

const VALID_ROLES = new Set([
  "CEO",
  "MANAGER",
  "ACCOUNTANT",
  "STORE_KEEPER",
]);

const getUsers = async (req, res) => {
  try {
    const users = await prisma.users.findMany({
      orderBy: { id: "desc" },
    });

    return res.json(
      users.map((u) => ({
        id: Number(u.id),
        username: u.username,
        full_name: u.full_name,
        role: u.role,
        is_active: u.is_active,
      }))
    );
  } catch (error) {
    console.error("Get Users Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const createUser = async (req, res) => {
  try {
    const { username, password, full_name, role } = req.body;

    if (
      !username ||
      !password ||
      !full_name ||
      !VALID_ROLES.has(role)
    ) {
      return res.status(400).json({ message: "Invalid user data" });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters",
      });
    }

    const existingUser = await prisma.users.findUnique({
      where: { username },
    });

    if (existingUser) {
      return res.status(400).json({
        message: "Username already exists",
      });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const user = await prisma.users.create({
      data: {
        username: String(username).trim(),
        password_hash,
        full_name: String(full_name).trim(),
        role,
        is_active: true,
      },
    });

    return res.status(201).json({
      message: "User created successfully",
      id: Number(user.id),
    });
  } catch (error) {
    console.error("Create User Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getUsers,
  createUser,
};
