const prisma = require("../config/prisma");

async function ensureSchema() {
  const columns = await prisma.$queryRawUnsafe(
    "SHOW COLUMNS FROM categories LIKE 'account_group'"
  );

  if (!Array.isArray(columns) || columns.length === 0) {
    console.log("[schema] adding categories.account_group");
    await prisma.$executeRawUnsafe(
      "ALTER TABLE categories ADD COLUMN account_group VARCHAR(30) NOT NULL DEFAULT 'EXPENSE' AFTER type"
    );
  }

  // Preserve all existing classifications while giving legacy income accounts
  // the correct logical group. Expense rows stay EXPENSE unless a user later
  // explicitly changes one to ASSET from the chart-of-accounts screen.
  await prisma.$executeRawUnsafe(
    "UPDATE categories SET account_group = 'INCOME' WHERE type = 'INCOME' AND account_group <> 'INCOME'"
  );

  await prisma.$executeRawUnsafe(
    "UPDATE categories SET account_group = 'EXPENSE' WHERE type = 'EXPENSE' AND (account_group IS NULL OR account_group = '')"
  );
}

module.exports = ensureSchema;
