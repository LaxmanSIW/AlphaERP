import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const DATA_DIR = path.resolve(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const db = new Database(path.join(DATA_DIR, "sqlite.db"));

// Initialize Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unionId TEXT,
    name TEXT,
    email TEXT,
    avatar TEXT,
    role TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    lastSignInAt TEXT
  );

  CREATE TABLE IF NOT EXISTS buyers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    companyName TEXT,
    contactPerson TEXT,
    phone TEXT,
    gstNumber TEXT,
    creditLimit TEXT,
    riskScore TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    stateCode TEXT,
    defaultTransportId INTEGER,
    defaultTransportName TEXT,
    createdAt TEXT,
    updatedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    buyerId INTEGER,
    bookType TEXT,
    transactionDate TEXT,
    dueDate TEXT,
    amount TEXT,
    trouserQuantity INTEGER,
    checkNumber TEXT,
    transactionType TEXT,
    includeInReporting INTEGER,
    billId INTEGER,
    deleted INTEGER,
    deletedReason TEXT,
    deletedAt TEXT,
    createdAt TEXT,
    updatedAt TEXT
  );
  
  CREATE INDEX IF NOT EXISTS idx_transactions_buyerId ON transactions(buyerId);
  CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transactionDate);

  CREATE TABLE IF NOT EXISTS auditLogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tableName TEXT,
    recordId INTEGER,
    action TEXT,
    oldValues TEXT,
    newValues TEXT,
    reason TEXT,
    userId TEXT,
    createdAt TEXT
  );

  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    hsnCode TEXT,
    listPrice TEXT,
    unit TEXT,
    taxPercent TEXT,
    createdAt TEXT,
    updatedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    billNumber TEXT,
    billDate TEXT,
    dueDate TEXT,
    buyerId INTEGER,
    buyerName TEXT,
    buyerGst TEXT,
    buyerAddress TEXT,
    buyerPhone TEXT,
    buyerEmail TEXT,
    placeOfSupply TEXT,
    reverseCharge TEXT,
    items TEXT,
    cgstAmount TEXT,
    sgstAmount TEXT,
    igstAmount TEXT,
    totalTax TEXT,
    subtotal TEXT,
    discountAmount TEXT,
    roundOff TEXT,
    totalAmount TEXT,
    transportId INTEGER,
    transportName TEXT,
    parcel INTEGER,
    createdAt TEXT,
    updatedAt TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(billDate);

  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    companyName TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    gstNumber TEXT,
    bankName TEXT,
    accountNumber TEXT,
    ifscCode TEXT,
    branchName TEXT,
    authorizedSignatory TEXT,
    terms TEXT,
    startingBillNumber TEXT,
    createdAt TEXT,
    updatedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS transports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT,
    vehicleNumber TEXT,
    createdAt TEXT,
    updatedAt TEXT
  );
`);


// ─── Generic CRUD Operations ─────────────────────────────
type TableName = "users" | "buyers" | "transactions" | "auditLogs" | "items" | "bills" | "companies" | "transports";

function rowToObj(row: any): any {
  if (!row) return row;
  const obj = { ...row };
  // Convert boolean fields
  if ("includeInReporting" in obj) obj.includeInReporting = obj.includeInReporting === 1;
  if ("deleted" in obj) obj.deleted = obj.deleted === 1;
  // Convert JSON arrays
  if (obj.items && typeof obj.items === "string") {
      try { obj.items = JSON.parse(obj.items); } catch {}
  }
  if (obj.terms && typeof obj.terms === "string") {
      try { obj.terms = JSON.parse(obj.terms); } catch {}
  }
  if (obj.oldValues && typeof obj.oldValues === "string") {
      try { obj.oldValues = JSON.parse(obj.oldValues); } catch {}
  }
  if (obj.newValues && typeof obj.newValues === "string") {
      try { obj.newValues = JSON.parse(obj.newValues); } catch {}
  }
  return obj;
}

export function findAll<T extends { id: number }>(table: TableName): T[] {
  const rows = db.prepare(`SELECT * FROM ${table}`).all();
  return rows.map(rowToObj) as T[];
}

export function findById<T extends { id: number }>(table: TableName, id: number): T | undefined {
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  return rowToObj(row) as T | undefined;
}

export function findOne<T>(table: TableName, predicate: (row: T) => boolean): T | undefined {
  const rows = findAll<T & { id: number }>(table);
  return rows.find(predicate) as T | undefined;
}

export function findMany<T>(table: TableName, predicate: (row: T) => boolean): T[] {
  const rows = findAll<T & { id: number }>(table);
  return rows.filter(predicate) as T[];
}

export function insert<T extends Record<string, any>>(table: TableName, data: Omit<T, "id">): T {
  const keys = Object.keys(data);
  const values = keys.map(k => {
    const val = (data as any)[k];
    if (typeof val === "boolean") return val ? 1 : 0;
    if (typeof val === "object" && val !== null) return JSON.stringify(val);
    return val;
  });
  
  const stmt = db.prepare(`INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`);
  const info = stmt.run(...values);
  
  return { ...data, id: info.lastInsertRowid } as unknown as T;
}

export function update<T extends { id: number }>(table: TableName, id: number, data: Partial<T>): T | undefined {
  const keys = Object.keys(data);
  if (keys.length === 0) return findById(table, id);

  const values = keys.map(k => {
    const val = (data as any)[k];
    if (typeof val === "boolean") return val ? 1 : 0;
    if (typeof val === "object" && val !== null) return JSON.stringify(val);
    return val;
  });
  
  const setClause = keys.map(k => `${k} = ?`).join(", ");
  const stmt = db.prepare(`UPDATE ${table} SET ${setClause} WHERE id = ?`);
  stmt.run(...values, id);
  
  return findById(table, id);
}

export function remove<T extends { id: number }>(table: TableName, id: number): boolean {
  const info = db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  return info.changes > 0;
}

export function count<T>(table: TableName, predicate?: (row: T) => boolean): number {
  if (!predicate) {
    const row = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number };
    return row.c;
  }
  const rows = findAll<T & { id: number }>(table);
  return rows.filter(predicate).length;
}

export function resetNextId(table: TableName): number {
  return 0; // Not needed for SQLite AUTOINCREMENT
}


