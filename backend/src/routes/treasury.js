const express = require("express");
const prisma = require("../config/prisma");
const { authorize } = require("../middleware/auth");
const {
  getDeletedTransactionIds,
  getOpeningBalance,
  isOnOrAfterOpening,
  toPlainJson,
  writeAudit,
} = require("../services/cashboxLedger");

const router = express.Router();

const ENTITIES = new Set(["TOLAN", "ALMALQA"]);
const ACCOUNT_TYPES = new Set(["BANK", "WALLET", "OTHER"]);
const MOVEMENT_TYPES = new Set([
  "EXPENSE",
  "SUPPLIER_PAYMENT",
  "ADVANCE",
  "ADVANCE_RETURN",
  "ADVANCE_SETTLEMENT",
  "TRANSFER",
  "BANK_IN",
  "BANK_OUT",
  "OTHER_IN",
  "OTHER_OUT",
]);

const SOURCE_REQUIRED = new Set(["EXPENSE", "SUPPLIER_PAYMENT", "ADVANCE", "BANK_OUT", "OTHER_OUT"]);
const DESTINATION_REQUIRED = new Set(["ADVANCE_RETURN", "BANK_IN", "OTHER_IN"]);
const NO_ACCOUNT_REQUIRED = new Set(["ADVANCE_SETTLEMENT"]);

function dateKey(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parseDate(value, fallback = null) {
  const key = /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : fallback;
  if (!key) return null;
  return new Date(`${key}T00:00:00.000Z`);
}

function businessTodayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function entityLabel(code) {
  return code === "ALMALQA" ? "الملقا" : code === "TOLAN" ? "تولان" : code;
}

function resolveCashboxEntity(cashbox) {
  const name = `${cashbox?.name_ar || ""} ${cashbox?.name_en || ""}`.toLowerCase();
  if (name.includes("الملقا") || name.includes("malqa")) return "ALMALQA";
  if (name.includes("تولان") || name.includes("tolan")) return "TOLAN";
  return "OTHER";
}

function serializeAccount(account, currentBalance = null) {
  return {
    id: Number(account.id),
    entity_code: account.entity_code,
    entity_name: entityLabel(account.entity_code),
    name_ar: account.name_ar,
    account_type: account.account_type,
    opening_balance: Number(account.opening_balance || 0),
    opening_date: dateKey(account.opening_date),
    is_active: Boolean(account.is_active),
    current_balance: currentBalance == null ? undefined : Number(currentBalance),
  };
}

function serializeEntry(entry) {
  const lines = (entry.lines || []).map((line) => ({
    id: Number(line.id),
    entity_code: line.entity_code,
    entity_name: entityLabel(line.entity_code),
    source_account_id: line.source_account_id ? Number(line.source_account_id) : null,
    source_account: line.source_account?.name_ar || null,
    source_entity: line.source_account?.entity_code || null,
    destination_account_id: line.destination_account_id ? Number(line.destination_account_id) : null,
    destination_account: line.destination_account?.name_ar || null,
    destination_entity: line.destination_account?.entity_code || null,
    amount: Number(line.amount || 0),
    note: line.note || "",
  }));

  return {
    id: Number(entry.id),
    entry_date: dateKey(entry.entry_date),
    movement_type: entry.movement_type,
    beneficiary: entry.beneficiary || "",
    description: entry.description || "",
    category_id: entry.category_id ? Number(entry.category_id) : null,
    category_name: entry.category?.name_ar || "",
    category_type: entry.category?.type || null,
    created_by: Number(entry.created_by),
    created_by_name: entry.user?.full_name || entry.user?.username || "",
    created_at: entry.created_at,
    updated_at: entry.updated_at,
    total_amount: lines.reduce((sum, line) => sum + Number(line.amount || 0), 0),
    lines,
  };
}

async function getAccountsWithBalances(asOf = null) {
  const asOfDate = asOf ? parseDate(asOf) : parseDate(businessTodayKey());
  const accounts = await prisma.treasury_accounts.findMany({ orderBy: [{ entity_code: "asc" }, { id: "asc" }] });
  const entries = await prisma.treasury_entries.findMany({
    where: {
      is_deleted: false,
      ...(asOfDate ? { entry_date: { lte: asOfDate } } : {}),
    },
    include: { lines: true },
    orderBy: [{ entry_date: "asc" }, { id: "asc" }],
  });

  const accountMap = new Map();
  const asOfKey = asOfDate ? dateKey(asOfDate) : null;
  accounts.forEach((account) => {
    const openingDate = dateKey(account.opening_date);
    accountMap.set(String(account.id), {
      account,
      openingDate,
      balance: !asOfKey || !openingDate || asOfKey >= openingDate ? Number(account.opening_balance || 0) : 0,
    });
  });

  for (const entry of entries) {
    const entryKey = dateKey(entry.entry_date);
    for (const line of entry.lines) {
      const amount = Number(line.amount || 0);
      if (line.source_account_id) {
        const source = accountMap.get(String(line.source_account_id));
        if (source && (!source.openingDate || entryKey >= source.openingDate)) source.balance -= amount;
      }
      if (line.destination_account_id) {
        const destination = accountMap.get(String(line.destination_account_id));
        if (destination && (!destination.openingDate || entryKey >= destination.openingDate)) destination.balance += amount;
      }
    }
  }

  return accounts.map((account) => serializeAccount(account, accountMap.get(String(account.id))?.balance || 0));
}

async function normalizeLines(lines, movementType) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return { error: "أضف سطرًا واحدًا على الأقل للحركة" };
  }

  const accountIds = new Set();
  lines.forEach((line) => {
    if (line.source_account_id) accountIds.add(String(line.source_account_id));
    if (line.destination_account_id) accountIds.add(String(line.destination_account_id));
  });

  const accounts = accountIds.size
    ? await prisma.treasury_accounts.findMany({
        where: { id: { in: [...accountIds].map((id) => BigInt(id)) } },
      })
    : [];
  const accountMap = new Map(accounts.map((account) => [String(account.id), account]));

  const normalized = [];
  for (const line of lines) {
    const entity = String(line.entity_code || "").toUpperCase();
    const amount = Number(line.amount);
    const sourceId = line.source_account_id ? String(line.source_account_id) : null;
    const destinationId = line.destination_account_id ? String(line.destination_account_id) : null;
    const source = sourceId ? accountMap.get(sourceId) : null;
    const destination = destinationId ? accountMap.get(destinationId) : null;

    if (!ENTITIES.has(entity)) return { error: "اختر الجهة: تولان أو الملقا لكل سطر" };
    if (!Number.isFinite(amount) || amount <= 0) return { error: "المبلغ يجب أن يكون أكبر من صفر" };
    if (sourceId && (!source || source.is_active === false)) return { error: "الحساب المصدر غير صالح" };
    if (destinationId && (!destination || destination.is_active === false)) return { error: "الحساب المستلم غير صالح" };

    if (SOURCE_REQUIRED.has(movementType)) {
      if (!source) return { error: "اختر الحساب المصدر" };
      if (source.entity_code !== entity) return { error: "الحساب المصدر يجب أن يتبع نفس الجهة المختارة" };
    }

    if (DESTINATION_REQUIRED.has(movementType)) {
      if (!destination) return { error: "اختر الحساب المستلم" };
      if (destination.entity_code !== entity) return { error: "الحساب المستلم يجب أن يتبع نفس الجهة المختارة" };
    }

    if (movementType === "TRANSFER") {
      if (!source || !destination) return { error: "التحويل يحتاج حسابًا مصدرًا وحسابًا مستلمًا" };
      if (sourceId === destinationId) return { error: "لا يمكن التحويل إلى نفس الحساب" };
      if (source.entity_code !== entity) return { error: "جهة سطر التحويل يجب أن تكون جهة الحساب المصدر" };
    }

    if (NO_ACCOUNT_REQUIRED.has(movementType) && (source || destination)) {
      return { error: "تسوية العهدة لا تغير رصيد بنك أو محفظة مباشرة" };
    }

    normalized.push({
      entity_code: entity,
      source_account_id: source ? source.id : null,
      destination_account_id: destination ? destination.id : null,
      amount,
      note: String(line.note || "").trim() || null,
    });
  }

  return { data: normalized };
}

async function validateEntryPayload(payload) {
  const movementType = String(payload.movement_type || "").toUpperCase();
  if (!MOVEMENT_TYPES.has(movementType)) return { error: "نوع الحركة غير صحيح" };

  const entryDate = parseDate(payload.entry_date, businessTodayKey());
  if (!entryDate) return { error: "تاريخ الحركة غير صحيح" };

  const beneficiary = String(payload.beneficiary || "").trim();
  if (["ADVANCE", "ADVANCE_RETURN", "ADVANCE_SETTLEMENT"].includes(movementType) && !beneficiary) {
    return { error: "اكتب اسم صاحب العهدة" };
  }
  if (movementType === "SUPPLIER_PAYMENT" && !beneficiary) {
    return { error: "اكتب اسم المورد" };
  }

  const categoryId = payload.category_id ? BigInt(payload.category_id) : null;
  const expenseTypes = new Set(["EXPENSE", "SUPPLIER_PAYMENT", "ADVANCE_SETTLEMENT"]);
  const incomeTypes = new Set(["BANK_IN", "OTHER_IN"]);
  const categoryRequired = expenseTypes.has(movementType) || incomeTypes.has(movementType);

  if (categoryRequired && !categoryId) {
    return { error: expenseTypes.has(movementType) ? "اختر حساب المصروف" : "اختر حساب الإيراد" };
  }

  if (categoryId) {
    const category = await prisma.categories.findUnique({ where: { id: categoryId } });
    if (!category || category.is_active === false) return { error: "الحساب المحاسبي غير صالح" };
    if (expenseTypes.has(movementType) && category.type !== "EXPENSE") return { error: "اختر حسابًا من المصروفات أو الأصول" };
    if (incomeTypes.has(movementType) && category.type !== "INCOME") return { error: "اختر حسابًا من الإيرادات" };
  }

  const lineResult = await normalizeLines(payload.lines, movementType);
  if (lineResult.error) return lineResult;

  return {
    data: {
      entry_date: entryDate,
      movement_type: movementType,
      beneficiary: beneficiary || null,
      description: String(payload.description || "").trim() || null,
      category_id: categoryId,
      lines: lineResult.data,
    },
  };
}

router.get("/accounts", async (req, res) => {
  try {
    const accounts = await getAccountsWithBalances(req.query.asOf || null);
    return res.json(accounts);
  } catch (error) {
    console.error("Treasury Accounts Error:", error);
    return res.status(500).json({ message: "تعذر تحميل حسابات الخزينة" });
  }
});

router.post("/accounts", authorize("CEO", "MANAGER"), async (req, res) => {
  try {
    const entity = String(req.body.entity_code || "").toUpperCase();
    const name = String(req.body.name_ar || "").trim();
    const accountType = String(req.body.account_type || "BANK").toUpperCase();
    const openingBalance = Number(req.body.opening_balance || 0);
    const openingDate = parseDate(req.body.opening_date, businessTodayKey());

    if (!ENTITIES.has(entity) || !name || !ACCOUNT_TYPES.has(accountType) || !Number.isFinite(openingBalance) || !openingDate) {
      return res.status(400).json({ message: "بيانات الحساب غير صحيحة" });
    }

    const account = await prisma.treasury_accounts.create({
      data: {
        entity_code: entity,
        name_ar: name,
        account_type: accountType,
        opening_balance: openingBalance,
        opening_date: openingDate,
        is_active: true,
      },
    });

    await writeAudit({
      userId: req.user.id,
      action: "CREATE",
      tableName: "treasury_accounts",
      recordId: account.id,
      newValues: toPlainJson(account),
    });

    return res.status(201).json({ message: "تم إنشاء الحساب", account: serializeAccount(account, openingBalance) });
  } catch (error) {
    console.error("Create Treasury Account Error:", error);
    return res.status(500).json({ message: "تعذر إنشاء الحساب" });
  }
});

router.put("/accounts/:id", authorize("CEO", "MANAGER"), async (req, res) => {
  try {
    const id = BigInt(req.params.id);
    const existing = await prisma.treasury_accounts.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "الحساب غير موجود" });

    const entity = String(req.body.entity_code || "").toUpperCase();
    const name = String(req.body.name_ar || "").trim();
    const accountType = String(req.body.account_type || "BANK").toUpperCase();
    const openingBalance = Number(req.body.opening_balance || 0);
    const openingDate = parseDate(req.body.opening_date);
    const isActive = typeof req.body.is_active === "boolean" ? req.body.is_active : true;

    if (!ENTITIES.has(entity) || !name || !ACCOUNT_TYPES.has(accountType) || !Number.isFinite(openingBalance) || !openingDate) {
      return res.status(400).json({ message: "بيانات الحساب غير صحيحة" });
    }

    if (entity !== existing.entity_code) {
      const usedLines = await prisma.treasury_entry_lines.count({
        where: { OR: [{ source_account_id: id }, { destination_account_id: id }] },
      });
      if (usedLines > 0) {
        return res.status(400).json({ message: "لا يمكن تغيير جهة حساب لديه حركات سابقة. أنشئ حسابًا جديدًا للجهة الصحيحة." });
      }
    }

    const updated = await prisma.treasury_accounts.update({
      where: { id },
      data: {
        entity_code: entity,
        name_ar: name,
        account_type: accountType,
        opening_balance: openingBalance,
        opening_date: openingDate,
        is_active: isActive,
        updated_at: new Date(),
      },
    });

    await writeAudit({
      userId: req.user.id,
      action: "UPDATE",
      tableName: "treasury_accounts",
      recordId: id,
      oldValues: toPlainJson(existing),
      newValues: toPlainJson(updated),
    });

    return res.json({ message: "تم تحديث الحساب" });
  } catch (error) {
    console.error("Update Treasury Account Error:", error);
    return res.status(500).json({ message: "تعذر تحديث الحساب" });
  }
});

router.get("/entries", async (req, res) => {
  try {
    const today = businessTodayKey();
    const from = parseDate(req.query.from || "2000-01-01", "2000-01-01");
    const to = parseDate(req.query.to || today, today);
    const entity = String(req.query.entity || "ALL").toUpperCase();
    const limit = Math.min(Math.max(Number(req.query.limit || 150), 1), 500);

    const entries = await prisma.treasury_entries.findMany({
      where: { is_deleted: false, entry_date: { gte: from, lte: to } },
      include: {
        user: { select: { full_name: true, username: true } },
        category: true,
        lines: {
          include: {
            source_account: true,
            destination_account: true,
          },
        },
      },
      orderBy: [{ entry_date: "desc" }, { id: "desc" }],
      take: limit,
    });

    const rows = entries
      .map(serializeEntry)
      .filter((entry) => {
        if (entity === "ALL") return true;
        return entry.lines.some(
          (line) => line.entity_code === entity || line.source_entity === entity || line.destination_entity === entity
        );
      });

    return res.json(rows);
  } catch (error) {
    console.error("Treasury Entries Error:", error);
    return res.status(500).json({ message: "تعذر تحميل الحركات" });
  }
});

router.post("/entries", async (req, res) => {
  try {
    const validated = await validateEntryPayload(req.body);
    if (validated.error) return res.status(400).json({ message: validated.error });

    const entry = await prisma.treasury_entries.create({
      data: {
        entry_date: validated.data.entry_date,
        movement_type: validated.data.movement_type,
        beneficiary: validated.data.beneficiary,
        description: validated.data.description,
        category_id: validated.data.category_id,
        created_by: BigInt(req.user.id),
        lines: { create: validated.data.lines },
      },
      include: { lines: true },
    });

    await writeAudit({
      userId: req.user.id,
      action: "CREATE",
      tableName: "treasury_entries",
      recordId: entry.id,
      newValues: toPlainJson(entry),
    });

    return res.status(201).json({ message: "تم حفظ الحركة بنجاح", id: Number(entry.id) });
  } catch (error) {
    console.error("Create Treasury Entry Error:", error);
    return res.status(500).json({ message: "تعذر حفظ الحركة" });
  }
});

router.put("/entries/:id", authorize("CEO", "MANAGER"), async (req, res) => {
  try {
    const id = BigInt(req.params.id);
    const existing = await prisma.treasury_entries.findUnique({ where: { id }, include: { lines: true } });
    if (!existing || existing.is_deleted) return res.status(404).json({ message: "الحركة غير موجودة" });

    const validated = await validateEntryPayload(req.body);
    if (validated.error) return res.status(400).json({ message: validated.error });

    await prisma.$transaction(async (tx) => {
      await tx.treasury_entries.update({
        where: { id },
        data: {
          entry_date: validated.data.entry_date,
          movement_type: validated.data.movement_type,
          beneficiary: validated.data.beneficiary,
          description: validated.data.description,
          category_id: validated.data.category_id,
          updated_at: new Date(),
        },
      });
      await tx.treasury_entry_lines.deleteMany({ where: { entry_id: id } });
      await tx.treasury_entry_lines.createMany({
        data: validated.data.lines.map((line) => ({ ...line, entry_id: id })),
      });
    });

    const refreshed = await prisma.treasury_entries.findUnique({ where: { id }, include: { lines: true } });
    await writeAudit({
      userId: req.user.id,
      action: "UPDATE",
      tableName: "treasury_entries",
      recordId: id,
      oldValues: toPlainJson(existing),
      newValues: toPlainJson(refreshed),
    });

    return res.json({ message: "تم تعديل الحركة بنجاح" });
  } catch (error) {
    console.error("Update Treasury Entry Error:", error);
    return res.status(500).json({ message: "تعذر تعديل الحركة" });
  }
});

router.delete("/entries/:id", authorize("CEO", "MANAGER"), async (req, res) => {
  try {
    const id = BigInt(req.params.id);
    const existing = await prisma.treasury_entries.findUnique({ where: { id }, include: { lines: true } });
    if (!existing || existing.is_deleted) return res.status(404).json({ message: "الحركة غير موجودة" });

    const updated = await prisma.treasury_entries.update({
      where: { id },
      data: { is_deleted: true, updated_at: new Date() },
    });

    await writeAudit({
      userId: req.user.id,
      action: "DELETE",
      tableName: "treasury_entries",
      recordId: id,
      oldValues: toPlainJson(existing),
      newValues: toPlainJson(updated),
    });

    return res.json({ message: "تم حذف الحركة مع الاحتفاظ بسجل المراجعة" });
  } catch (error) {
    console.error("Delete Treasury Entry Error:", error);
    return res.status(500).json({ message: "تعذر حذف الحركة" });
  }
});

async function buildAdvanceSummary({ to, entity = "ALL" }) {
  const toDate = parseDate(to, businessTodayKey());
  const entries = await prisma.treasury_entries.findMany({
    where: {
      is_deleted: false,
      entry_date: { lte: toDate },
      movement_type: { in: ["ADVANCE", "ADVANCE_RETURN", "ADVANCE_SETTLEMENT"] },
    },
    include: { lines: { include: { source_account: true, destination_account: true } } },
    orderBy: [{ entry_date: "asc" }, { id: "asc" }],
  });

  const map = new Map();
  for (const entry of entries) {
    const beneficiary = String(entry.beneficiary || "بدون اسم").trim() || "بدون اسم";
    for (const line of entry.lines) {
      const lineEntity = line.entity_code;
      if (entity !== "ALL" && lineEntity !== entity) continue;
      const key = `${beneficiary}__${lineEntity}`;
      if (!map.has(key)) {
        map.set(key, {
          beneficiary,
          entity_code: lineEntity,
          entity_name: entityLabel(lineEntity),
          issued: 0,
          returned: 0,
          settled: 0,
          outstanding: 0,
        });
      }
      const row = map.get(key);
      const amount = Number(line.amount || 0);
      if (entry.movement_type === "ADVANCE") row.issued += amount;
      if (entry.movement_type === "ADVANCE_RETURN") row.returned += amount;
      if (entry.movement_type === "ADVANCE_SETTLEMENT") row.settled += amount;
      row.outstanding = row.issued - row.returned - row.settled;
    }
  }

  return [...map.values()].sort((a, b) => b.outstanding - a.outstanding || a.beneficiary.localeCompare(b.beneficiary, "ar"));
}

router.get("/advances", async (req, res) => {
  try {
    const today = businessTodayKey();
    const to = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.to || "")) ? String(req.query.to) : today;
    const entity = ENTITIES.has(String(req.query.entity || "").toUpperCase()) ? String(req.query.entity).toUpperCase() : "ALL";
    const rows = await buildAdvanceSummary({ to, entity });
    return res.json({
      to,
      entity,
      rows,
      totals: rows.reduce(
        (acc, row) => {
          acc.issued += row.issued;
          acc.returned += row.returned;
          acc.settled += row.settled;
          acc.outstanding += row.outstanding;
          return acc;
        },
        { issued: 0, returned: 0, settled: 0, outstanding: 0 }
      ),
    });
  } catch (error) {
    console.error("Treasury Advances Error:", error);
    return res.status(500).json({ message: "تعذر تحميل العهد" });
  }
});

router.get("/report", async (req, res) => {
  try {
    const today = businessTodayKey();
    const fromKey = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.from || "")) ? String(req.query.from) : today;
    const toKey = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.to || "")) ? String(req.query.to) : today;
    if (fromKey > toKey) return res.status(400).json({ message: "تاريخ البداية يجب أن يكون قبل تاريخ النهاية" });

    const entity = ENTITIES.has(String(req.query.entity || "").toUpperCase()) ? String(req.query.entity).toUpperCase() : "ALL";
    const from = parseDate(fromKey);
    const to = parseDate(toKey);

    const [deletedCashIds, cashboxes, cashTransactions, treasuryEntries, accounts, advances, items] = await Promise.all([
      getDeletedTransactionIds(),
      prisma.cashboxes.findMany({ where: { is_active: true }, orderBy: { id: "asc" } }),
      prisma.transactions.findMany({
        where: { transaction_date: { gte: from, lte: to } },
        include: { cashboxes: true, categories: true },
        orderBy: [{ transaction_date: "asc" }, { id: "asc" }],
      }),
      prisma.treasury_entries.findMany({
        where: { is_deleted: false, entry_date: { gte: from, lte: to } },
        include: {
          user: { select: { full_name: true, username: true } },
          category: true,
          lines: { include: { source_account: true, destination_account: true } },
        },
        orderBy: [{ entry_date: "asc" }, { id: "asc" }],
      }),
      getAccountsWithBalances(toKey),
      buildAdvanceSummary({ to: toKey, entity }),
      prisma.items.findMany({
        include: {
          movements: {
            where: { movement_date: { lte: to } },
            orderBy: [{ movement_date: "asc" }, { id: "asc" }],
          },
        },
        orderBy: { id: "asc" },
      }),
    ]);

    const openingByCashbox = new Map();
    await Promise.all(cashboxes.map(async (box) => openingByCashbox.set(String(box.id), await getOpeningBalance(box.id))));

    const rangeCash = cashTransactions.filter((tx) => {
      if (deletedCashIds.has(String(tx.id))) return false;
      const txEntity = resolveCashboxEntity(tx.cashboxes);
      if (entity !== "ALL" && txEntity !== entity) return false;
      const opening = openingByCashbox.get(String(tx.cashbox_id));
      return isOnOrAfterOpening(tx.transaction_date, opening);
    });

    const allCashToDate = await prisma.transactions.findMany({
      where: { transaction_date: { lte: to } },
      include: { cashboxes: true },
      orderBy: [{ transaction_date: "asc" }, { id: "asc" }],
    });

    const cashboxBalances = [];
    for (const box of cashboxes) {
      const boxEntity = resolveCashboxEntity(box);
      if (entity !== "ALL" && boxEntity !== entity) continue;
      const opening = openingByCashbox.get(String(box.id));
      let balance = opening?.exists ? Number(opening.amount || 0) : 0;
      for (const tx of allCashToDate) {
        if (String(tx.cashbox_id) !== String(box.id) || deletedCashIds.has(String(tx.id))) continue;
        if (!isOnOrAfterOpening(tx.transaction_date, opening)) continue;
        const amount = Number(tx.amount || 0);
        balance += tx.type === "IN" ? amount : -amount;
      }
      cashboxBalances.push({
        id: Number(box.id),
        name: box.name_ar,
        entity_code: boxEntity,
        entity_name: entityLabel(boxEntity),
        balance,
      });
    }

    const activeAccounts = accounts.filter((account) => account.is_active && (entity === "ALL" || account.entity_code === entity));

    const summary = {
      cashIncome: 0,
      cashExpense: 0,
      externalIncome: 0,
      externalExpense: 0,
      supplierPayments: 0,
      advancesIssued: 0,
      advancesReturned: 0,
      advancesSettled: 0,
      bankOut: 0,
      transfersOut: 0,
      transfersIn: 0,
      movementCount: 0,
    };

    const expenseByAccount = new Map();
    const incomeByAccount = new Map();
    const addAccountTotal = (map, name, amount) => {
      const key = name || "غير مصنف";
      map.set(key, (map.get(key) || 0) + Number(amount || 0));
    };

    const dailyMap = new Map();
    const getDay = (key) => {
      if (!dailyMap.has(key)) dailyMap.set(key, { date: key, income: 0, expense: 0, advances: 0, bankIn: 0, bankOut: 0, count: 0 });
      return dailyMap.get(key);
    };

    const movements = [];

    for (const tx of rangeCash) {
      const amount = Number(tx.amount || 0);
      const key = dateKey(tx.transaction_date);
      const txEntity = resolveCashboxEntity(tx.cashboxes);
      const day = getDay(key);
      if (tx.type === "IN") {
        summary.cashIncome += amount;
        day.income += amount;
        addAccountTotal(incomeByAccount, tx.categories?.name_ar, amount);
      } else {
        summary.cashExpense += amount;
        day.expense += amount;
        addAccountTotal(expenseByAccount, tx.categories?.name_ar, amount);
      }
      day.count += 1;
      summary.movementCount += 1;
      movements.push({
        source: "CASHBOX",
        id: Number(tx.id),
        date: key,
        entity_code: txEntity,
        entity_name: entityLabel(txEntity),
        movement_type: tx.type === "IN" ? "CASH_IN" : "CASH_OUT",
        account: tx.categories?.name_ar || "",
        from_account: tx.cashboxes?.name_ar || "",
        to_account: "",
        beneficiary: "",
        description: tx.description || "",
        amount,
        balance_after: Number(tx.balance_after || 0),
      });
    }

    for (const entry of treasuryEntries) {
      const key = dateKey(entry.entry_date);
      for (const line of entry.lines) {
        const amount = Number(line.amount || 0);
        const sourceEntity = line.source_account?.entity_code || line.entity_code;
        const destinationEntity = line.destination_account?.entity_code || line.entity_code;
        const lineMatches = entity === "ALL" || line.entity_code === entity || sourceEntity === entity || destinationEntity === entity;
        if (!lineMatches) continue;

        const day = getDay(key);
        const type = entry.movement_type;
        const primaryEntity = type === "TRANSFER" ? sourceEntity : line.entity_code;
        const displayEntity = entity === "ALL" ? primaryEntity : entity;

        if (["BANK_IN", "OTHER_IN"].includes(type) && (entity === "ALL" || destinationEntity === entity)) {
          summary.externalIncome += amount;
          day.income += amount;
          day.bankIn += amount;
          addAccountTotal(incomeByAccount, entry.category?.name_ar, amount);
        }
        if (["EXPENSE", "ADVANCE_SETTLEMENT"].includes(type) && (entity === "ALL" || line.entity_code === entity)) {
          summary.externalExpense += amount;
          day.expense += amount;
          addAccountTotal(expenseByAccount, entry.category?.name_ar, amount);
        }
        if (type === "SUPPLIER_PAYMENT" && (entity === "ALL" || line.entity_code === entity)) {
          summary.supplierPayments += amount;
          summary.externalExpense += amount;
          day.expense += amount;
          addAccountTotal(expenseByAccount, entry.category?.name_ar, amount);
        }
        if (type === "ADVANCE" && (entity === "ALL" || line.entity_code === entity)) {
          summary.advancesIssued += amount;
          day.advances += amount;
        }
        if (type === "ADVANCE_RETURN" && (entity === "ALL" || line.entity_code === entity)) summary.advancesReturned += amount;
        if (type === "ADVANCE_SETTLEMENT" && (entity === "ALL" || line.entity_code === entity)) summary.advancesSettled += amount;
        if (["BANK_OUT", "OTHER_OUT"].includes(type) && (entity === "ALL" || sourceEntity === entity)) {
          summary.bankOut += amount;
          day.bankOut += amount;
        }
        if (type === "TRANSFER") {
          if (entity === "ALL" || sourceEntity === entity) summary.transfersOut += amount;
          if (entity === "ALL" || destinationEntity === entity) summary.transfersIn += amount;
        }

        day.count += 1;
        summary.movementCount += 1;
        movements.push({
          source: "TREASURY",
          id: Number(entry.id),
          line_id: Number(line.id),
          date: key,
          entity_code: displayEntity,
          entity_name: entityLabel(displayEntity),
          destination_entity: destinationEntity,
          movement_type: type,
          account: entry.category?.name_ar || "",
          from_account: line.source_account?.name_ar || "",
          to_account: line.destination_account?.name_ar || "",
          beneficiary: entry.beneficiary || "",
          description: entry.description || line.note || "",
          amount,
          balance_after: null,
        });
      }
    }

    summary.totalIncome = summary.cashIncome + summary.externalIncome;
    summary.totalExpense = summary.cashExpense + summary.externalExpense;
    summary.netIncomeExpense = summary.totalIncome - summary.totalExpense;
    summary.outstandingAdvances = advances.reduce((sum, row) => sum + row.outstanding, 0);
    summary.cashboxClosing = cashboxBalances.reduce((sum, row) => sum + row.balance, 0);
    summary.bankWalletClosing = activeAccounts.reduce((sum, row) => sum + Number(row.current_balance || 0), 0);
    summary.totalLiquidity = summary.cashboxClosing + summary.bankWalletClosing;

    const inventory = items.map((item) => {
      let closingStock = 0;
      for (const movement of item.movements) {
        const quantity = Number(movement.quantity || 0);
        closingStock += movement.movement_type === "IN" ? quantity : -quantity;
      }
      return { id: Number(item.id), name: item.name, unit: item.unit, closingStock };
    });

    return res.json({
      from: fromKey,
      to: toKey,
      entity,
      entity_name: entity === "ALL" ? "تولان + الملقا" : entityLabel(entity),
      summary,
      expenseByAccount: [...expenseByAccount.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount),
      incomeByAccount: [...incomeByAccount.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount),
      daily: [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
      cashboxes: cashboxBalances,
      accounts: activeAccounts,
      advances,
      inventory,
      movements: movements.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
    });
  } catch (error) {
    console.error("Treasury Report Error:", error);
    return res.status(500).json({ message: "تعذر إنشاء التقرير الشامل" });
  }
});

module.exports = router;
