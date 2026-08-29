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

  // Treasury module: bank accounts, wallets, advances, transfers and external
  // daily movements. These tables are created safely on existing TiDB databases.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS treasury_accounts (
      id BIGINT NOT NULL AUTO_INCREMENT,
      entity_code VARCHAR(20) NOT NULL,
      name_ar VARCHAR(255) NOT NULL,
      account_type VARCHAR(30) NOT NULL,
      opening_balance DECIMAL(18,2) NOT NULL DEFAULT 0,
      opening_date DATE NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_treasury_accounts_entity (entity_code),
      INDEX idx_treasury_accounts_active (is_active)
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS treasury_entries (
      id BIGINT NOT NULL AUTO_INCREMENT,
      entry_date DATE NOT NULL,
      movement_type VARCHAR(40) NOT NULL,
      beneficiary VARCHAR(255) NULL,
      description TEXT NULL,
      category_id BIGINT NULL,
      created_by BIGINT NOT NULL,
      is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_treasury_entries_date (entry_date),
      INDEX idx_treasury_entries_type (movement_type),
      INDEX idx_treasury_entries_category (category_id),
      INDEX idx_treasury_entries_user (created_by),
      INDEX idx_treasury_entries_deleted (is_deleted)
    )
  `);

  const treasuryCategoryColumn = await prisma.$queryRawUnsafe(
    "SHOW COLUMNS FROM treasury_entries LIKE 'category_id'"
  );
  if (!Array.isArray(treasuryCategoryColumn) || treasuryCategoryColumn.length === 0) {
    await prisma.$executeRawUnsafe(
      "ALTER TABLE treasury_entries ADD COLUMN category_id BIGINT NULL AFTER description"
    );
    await prisma.$executeRawUnsafe(
      "CREATE INDEX idx_treasury_entries_category ON treasury_entries(category_id)"
    );
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS treasury_entry_lines (
      id BIGINT NOT NULL AUTO_INCREMENT,
      entry_id BIGINT NOT NULL,
      entity_code VARCHAR(20) NOT NULL,
      source_account_id BIGINT NULL,
      destination_account_id BIGINT NULL,
      amount DECIMAL(18,2) NOT NULL,
      note VARCHAR(500) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_treasury_lines_entry (entry_id),
      INDEX idx_treasury_lines_entity (entity_code),
      INDEX idx_treasury_lines_source (source_account_id),
      INDEX idx_treasury_lines_destination (destination_account_id)
    )
  `);

  const treasuryAccountCount = await prisma.treasury_accounts.count();
  if (treasuryAccountCount === 0) {
    const riyadhDateKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Riyadh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const openingDate = new Date(`${riyadhDateKey}T00:00:00.000Z`);
    await prisma.treasury_accounts.createMany({
      data: [
        { entity_code: "TOLAN", name_ar: "مصرف الراجحي - تولان", account_type: "BANK", opening_balance: 0, opening_date: openingDate },
        { entity_code: "TOLAN", name_ar: "مصرف الإنماء - تولان", account_type: "BANK", opening_balance: 0, opening_date: openingDate },
        { entity_code: "TOLAN", name_ar: "محفظة هلا - تولان", account_type: "WALLET", opening_balance: 0, opening_date: openingDate },
        { entity_code: "ALMALQA", name_ar: "مصرف الراجحي - الملقا", account_type: "BANK", opening_balance: 0, opening_date: openingDate },
        { entity_code: "ALMALQA", name_ar: "مصرف الإنماء - الملقا", account_type: "BANK", opening_balance: 0, opening_date: openingDate },
        { entity_code: "ALMALQA", name_ar: "محفظة هلا - الملقا", account_type: "WALLET", opening_balance: 0, opening_date: openingDate },
      ],
    });
    console.log("[schema] seeded default treasury bank/wallet accounts");
  }
}

module.exports = ensureSchema;
