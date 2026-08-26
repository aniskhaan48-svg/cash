const prisma = require("../config/prisma");
const bcrypt = require("bcrypt");
const { writeAudit } = require("../services/cashboxLedger");

const VALID_ROLES = new Set(["CEO", "MANAGER", "ACCOUNTANT", "STORE_KEEPER"]);

const getUsers = async (req, res) => {
  try {
    const users = await prisma.users.findMany({ orderBy: { id: "desc" } });
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
    const cleanUsername = String(username || "").trim();
    const cleanFullName = String(full_name || "").trim();

    if (!cleanUsername || !password || !cleanFullName || !VALID_ROLES.has(role)) {
      return res.status(400).json({ message: "بيانات المستخدم غير صحيحة" });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ message: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" });
    }

    const existingUser = await prisma.users.findUnique({ where: { username: cleanUsername } });
    if (existingUser) return res.status(400).json({ message: "اسم المستخدم موجود مسبقًا" });

    const password_hash = await bcrypt.hash(password, 10);
    const user = await prisma.users.create({
      data: {
        username: cleanUsername,
        password_hash,
        full_name: cleanFullName,
        role,
        is_active: true,
      },
    });

    await writeAudit({
      userId: req.user.id,
      action: "CREATE",
      tableName: "users",
      recordId: user.id,
      newValues: {
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        is_active: user.is_active,
      },
    });

    return res.status(201).json({ message: "تم إنشاء المستخدم بنجاح", id: Number(user.id) });
  } catch (error) {
    console.error("Create User Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const updateUser = async (req, res) => {
  try {
    const id = BigInt(req.params.id);
    const { full_name, role, is_active } = req.body;

    const existing = await prisma.users.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "المستخدم غير موجود" });

    if (
      !String(full_name || "").trim() ||
      !VALID_ROLES.has(role) ||
      typeof is_active !== "boolean"
    ) {
      return res.status(400).json({ message: "بيانات المستخدم غير صحيحة" });
    }

    if (Number(existing.id) === Number(req.user.id) && is_active === false) {
      return res.status(400).json({ message: "لا يمكنك إيقاف حسابك الحالي" });
    }

    if (Number(existing.id) === Number(req.user.id) && role !== "CEO") {
      return res.status(400).json({ message: "لا يمكنك إزالة صلاحية المالك من حسابك الحالي" });
    }

    const updated = await prisma.users.update({
      where: { id },
      data: {
        full_name: String(full_name).trim(),
        role,
        is_active,
      },
    });

    await writeAudit({
      userId: req.user.id,
      action: "UPDATE",
      tableName: "users",
      recordId: id,
      oldValues: {
        username: existing.username,
        full_name: existing.full_name,
        role: existing.role,
        is_active: existing.is_active,
      },
      newValues: {
        username: updated.username,
        full_name: updated.full_name,
        role: updated.role,
        is_active: updated.is_active,
      },
    });

    return res.json({ message: "تم تحديث المستخدم بنجاح" });
  } catch (error) {
    console.error("Update User Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const changePassword = async (req, res) => {
  try {
    const id = BigInt(req.params.id);
    const { password } = req.body;

    if (!password || String(password).length < 8) {
      return res.status(400).json({ message: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل" });
    }

    const existing = await prisma.users.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "المستخدم غير موجود" });

    const password_hash = await bcrypt.hash(String(password), 10);
    await prisma.users.update({ where: { id }, data: { password_hash } });

    await writeAudit({
      userId: req.user.id,
      action: "PASSWORD_RESET",
      tableName: "users",
      recordId: id,
      oldValues: { username: existing.username },
      newValues: { username: existing.username, password_changed: true },
    });

    return res.json({ message: "تم تغيير كلمة المرور بنجاح" });
  } catch (error) {
    console.error("Change Password Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = { getUsers, createUser, updateUser, changePassword };
