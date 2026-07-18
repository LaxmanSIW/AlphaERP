import fs from "fs";
import path from "path";
import type { User, Buyer, Transaction, AuditLog, Item, Bill, Company } from "./types";

const DATA_DIR = path.resolve(process.cwd(), "data");

interface Database {
  users: User[];
  buyers: Buyer[];
  transactions: Transaction[];
  auditLogs: AuditLog[];
  items: Item[];
  bills: Bill[];
  companies: Company[];
}

type TableName = keyof Database;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getFilePath(table: TableName): string {
  return path.join(DATA_DIR, `${table}.json`);
}

function readTable<T>(table: TableName): T[] {
  ensureDataDir();
  const filePath = getFilePath(table);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "[]", "utf-8");
    return [];
  }
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as T[];
  } catch {
    return [];
  }
}

function writeTable<T>(table: TableName, data: T[]): void {
  ensureDataDir();
  const filePath = getFilePath(table);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

let nextIds: Record<TableName, number> = {
  users: 1,
  buyers: 1,
  transactions: 1,
  auditLogs: 1,
  items: 1,
  bills: 1,
  companies: 1,
};

// Initialize next IDs from existing data
function initNextIds() {
  (Object.keys(nextIds) as TableName[]).forEach((table) => {
    const rows = readTable<Database[TableName][number]>(table);
    if (rows.length > 0) {
      const maxId = Math.max(...rows.map((r: any) => r.id || 0));
      nextIds[table] = maxId + 1;
    }
  });
}

// Initialize on module load
initNextIds();

function getNextId(table: TableName): number {
  const id = nextIds[table];
  nextIds[table]++;
  return id;
}

export function resetNextId(table: TableName): number {
  const rows = readTable<Database[TableName][number]>(table);
  const activeRows = table === "transactions"
    ? rows.filter((row: any) => !row.deleted)
    : rows;
  const maxId = activeRows.reduce((max, row: any) => Math.max(max, row.id || 0), 0);
  nextIds[table] = maxId + 1;
  return nextIds[table];
}

// ─── Generic CRUD Operations ─────────────────────────────

export function findAll<T extends { id: number }>(table: TableName): T[] {
  return readTable<T>(table);
}

export function findById<T extends { id: number }>(table: TableName, id: number): T | undefined {
  const rows = readTable<T>(table);
  return rows.find((r: any) => r.id === id);
}

export function findOne<T>(table: TableName, predicate: (row: T) => boolean): T | undefined {
  const rows = readTable<T>(table);
  return rows.find(predicate);
}

export function findMany<T>(table: TableName, predicate: (row: T) => boolean): T[] {
  const rows = readTable<T>(table);
  return rows.filter(predicate);
}

export function insert<T extends Record<string, any>>(table: TableName, data: Omit<T, "id">): T {
  const rows = readTable<T>(table);
  const newRow = { ...data, id: getNextId(table) } as T;
  rows.push(newRow);
  writeTable(table, rows);
  return newRow;
}

export function update<T extends { id: number }>(table: TableName, id: number, data: Partial<T>): T | undefined {
  const rows = readTable<T>(table);
  const index = rows.findIndex((r: any) => r.id === id);
  if (index === -1) return undefined;
  rows[index] = { ...rows[index], ...data, id } as T;
  writeTable(table, rows);
  return rows[index];
}

export function remove<T extends { id: number }>(table: TableName, id: number): boolean {
  const rows = readTable<T>(table);
  const filtered = rows.filter((r: any) => r.id !== id);
  if (filtered.length === rows.length) return false;
  writeTable(table, filtered);
  return true;
}

export function count<T>(table: TableName, predicate?: (row: T) => boolean): number {
  const rows = readTable<T>(table);
  if (!predicate) return rows.length;
  return rows.filter(predicate).length;
}

// ─── Seed Data ───────────────────────────────────────────

const seedBuyers: Omit<Buyer, "id" | "createdAt" | "updatedAt">[] = [
  { companyName: "Sharma Garments Pvt Ltd", contactPerson: "Rajesh Sharma", phone: "9876543210", gstNumber: "27AABCU9603R1ZM", creditLimit: "500000.00", riskScore: "5.0", address: null, city: null, state: null, stateCode: null },
  { companyName: "Gupta Textile Traders", contactPerson: "Suresh Gupta", phone: "9876543211", gstNumber: "07AAAPG1234R1ZL", creditLimit: "300000.00", riskScore: "5.0", address: null, city: null, state: null, stateCode: null },
  { companyName: "Patel Fashion House", contactPerson: "Amit Patel", phone: "9876543212", gstNumber: "24AAIFP5678R1Z2", creditLimit: "750000.00", riskScore: "5.0", address: null, city: null, state: null, stateCode: null },
  { companyName: "Singh & Sons Clothiers", contactPerson: "Harpreet Singh", phone: "9876543213", gstNumber: "03AAACS9012R1ZV", creditLimit: "400000.00", riskScore: "5.0", address: null, city: null, state: null, stateCode: null },
  { companyName: "Kumar Apparel Distributors", contactPerson: "Vijay Kumar", phone: "9876543214", gstNumber: "29AAACK3456R1ZU", creditLimit: "600000.00", riskScore: "5.0", address: null, city: null, state: null, stateCode: null },
  { companyName: "Reddy Wholesale Mart", contactPerson: "Srinivas Reddy", phone: "9876543215", gstNumber: "36AABCR7890R1ZX", creditLimit: "450000.00", riskScore: "5.0", address: null, city: null, state: null, stateCode: null },
  { companyName: "Mehta Trading Company", contactPerson: "Pankaj Mehta", phone: "9876543216", gstNumber: "08AADCM2345R1ZY", creditLimit: "350000.00", riskScore: "5.0", address: null, city: null, state: null, stateCode: null },
  { companyName: "Joshi Cloth Merchants", contactPerson: "Nilesh Joshi", phone: "9876543217", gstNumber: "27AAAFJ6789R1ZP", creditLimit: "250000.00", riskScore: "5.0", address: null, city: null, state: null, stateCode: null },
  { companyName: "Verma Garment Exports", contactPerson: "Rahul Verma", phone: "9876543218", gstNumber: "09AAAVG0123R1ZQ", creditLimit: "800000.00", riskScore: "5.0", address: null, city: null, state: null, stateCode: null },
  { companyName: "Iyer Textile Corporation", contactPerson: "Krishnan Iyer", phone: "9876543219", gstNumber: "33AAATI4567R1ZR", creditLimit: "550000.00", riskScore: "5.0", address: null, city: null, state: null, stateCode: null },
  { companyName: "Nair Fashion Wholesale", contactPerson: "Mohan Nair", phone: "9876543220", gstNumber: "32AAANN8901R1ZS", creditLimit: "200000.00", riskScore: "5.0", address: null, city: null, state: null, stateCode: null },
  { companyName: "Desai Brothers Apparels", contactPerson: "Mahesh Desai", phone: "9876543221", gstNumber: "24AAADD2345R1ZT", creditLimit: "650000.00", riskScore: "5.0", address: null, city: null, state: null, stateCode: null },
  { companyName: "Banerjee Cloth House", contactPerson: "Subhas Banerjee", phone: "9876543222", gstNumber: "19AAABN6789R1ZU", creditLimit: "280000.00", riskScore: "5.0", address: null, city: null, state: null, stateCode: null },
  { companyName: "Chauhan Garments Ltd", contactPerson: "Dinesh Chauhan", phone: "9876543223", gstNumber: "23AAACC0123R1ZV", creditLimit: "500000.00", riskScore: "5.0", address: null, city: null, state: null, stateCode: null },
  { companyName: "Malhotra Fashion Hub", contactPerson: "Anil Malhotra", phone: "9876543224", gstNumber: "07AAAMH4567R1ZW", creditLimit: "900000.00", riskScore: "5.0", address: null, city: null, state: null, stateCode: null },
  { companyName: "Rao Textile Traders", contactPerson: "Prasad Rao", phone: "9876543225", gstNumber: "37AAART8901R1ZX", creditLimit: "320000.00", riskScore: "5.0", address: null, city: null, state: null, stateCode: null },
  { companyName: "Agarwal & Co Garments", contactPerson: "Sunil Agarwal", phone: "9876543226", gstNumber: "08AAACA2345R1ZY", creditLimit: "420000.00", riskScore: "5.0", address: null, city: null, state: null, stateCode: null },
  { companyName: "Menon Apparels", contactPerson: "Ravi Menon", phone: "9876543227", gstNumber: "32AAAMN6789R1ZP", creditLimit: "180000.00", riskScore: "5.0", address: null, city: null, state: null, stateCode: null },
  { companyName: "Pillai Garment Stores", contactPerson: "Suresh Pillai", phone: "9876543228", gstNumber: "32AAAPP0123R1ZQ", creditLimit: "380000.00", riskScore: "5.0", address: null, city: null, state: null, stateCode: null },
  { companyName: "Bhatt Cloth Distributors", contactPerson: "Kiran Bhatt", phone: "9876543229", gstNumber: "24AAABB4567R1ZR", creditLimit: "480000.00", riskScore: "5.0", address: null, city: null, state: null, stateCode: null },
];

function getRandomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function seedDatabase() {
  // Check if already seeded
  const existingBuyers = readTable<Buyer>("buyers");
  if (existingBuyers.length > 0) {
    return; // Already seeded
  }

  console.log("Seeding database...");

  // Seed buyers
  const now = new Date();
  const buyerRows: Buyer[] = seedBuyers.map((b, i) => ({
    ...b,
    id: i + 1,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }));
  writeTable("buyers", buyerRows);

  // Seed transactions
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const bookTypes: ("CC" | "CS")[] = ["CC", "CS"];
  const txTypes: ("Sale" | "Payment_Received")[] = ["Sale", "Payment_Received"];
  const transactionData: Transaction[] = [];

  for (let i = 0; i < 150; i++) {
    const buyer = buyerRows[Math.floor(Math.random() * buyerRows.length)];
    const bookType = bookTypes[Math.floor(Math.random() * bookTypes.length)];
    const txType = txTypes[Math.floor(Math.random() * txTypes.length)];
    const txDate = getRandomDate(sixMonthsAgo, now);
    const dueDate = new Date(txDate);
    dueDate.setDate(dueDate.getDate() + 30);

    const isSale = txType === "Sale";
    const quantity = isSale ? Math.floor(Math.random() * 200) + 10 : 0;
    const amount = isSale
      ? Math.floor(Math.random() * 50000) + 5000
      : Math.floor(Math.random() * 30000) + 2000;

    transactionData.push({
      id: i + 1,
      buyerId: buyer.id,
      bookType,
      transactionDate: formatDate(txDate),
      dueDate: isSale ? formatDate(dueDate) : null,
      amount: amount.toFixed(2),
      trouserQuantity: quantity,
      checkNumber: bookType === "CC" && isSale ? `CHQ${Math.floor(Math.random() * 900000 + 100000)}` : null,
      transactionType: txType,
      includeInReporting: Math.random() > 0.15,
      deleted: false,
      deletedReason: null,
      deletedAt: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  }

  // Sort by date
  transactionData.sort((a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime());
  // Reassign IDs after sort
  transactionData.forEach((t, i) => { t.id = i + 1; });
  writeTable("transactions", transactionData);

  // Re-init next IDs
  nextIds.buyers = buyerRows.length + 1;
  nextIds.transactions = transactionData.length + 1;

  // Seed default company if empty
  const existingCompanies = readTable<Company>("companies");
  if (existingCompanies.length === 0) {
    const defaultCompany: Company = {
      id: 1,
      companyName: "Alpha Wholesale",
      address: "123 Commercial Belt, Sector 4, Noida, Uttar Pradesh",
      phone: "+91 9999999999",
      email: "company@gmail.com",
      gstNumber: "09AAAAA1234A1Z2",
      bankName: "ICICI Bank",
      accountNumber: "123456789",
      ifscCode: "ICIC11222",
      branchName: "Noida",
      authorizedSignatory: "Add Name",
      terms: [
        "1. Goods once sold will not be taken back.",
        "2. Interest @ 18% p.a. will be charged if the payment for Company Name is not made within the stipulated time.",
        "3. Subject to 'Delhi' Jurisdiction only."
      ],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    writeTable("companies", [defaultCompany]);
    nextIds.companies = 2;
  }

  // Seed default items if empty
  const existingItems = readTable<Item>("items");
  if (existingItems.length === 0) {
    const defaultItems: Item[] = [
      { id: 1, name: "Denim Trousers", hsnCode: "39231020", listPrice: "800.00", unit: "Pcs.", taxPercent: "18.00", createdAt: now.toISOString(), updatedAt: now.toISOString() },
      { id: 2, name: "Cotton Polo Shirt", hsnCode: "61051010", listPrice: "600.00", unit: "Pcs.", taxPercent: "12.00", createdAt: now.toISOString(), updatedAt: now.toISOString() },
      { id: 3, name: "Casual Summer Shorts", hsnCode: "62034200", listPrice: "450.00", unit: "Pcs.", taxPercent: "5.00", createdAt: now.toISOString(), updatedAt: now.toISOString() },
      { id: 4, name: "Formal Linen Blazer", hsnCode: "62031100", listPrice: "2500.00", unit: "Pcs.", taxPercent: "18.00", createdAt: now.toISOString(), updatedAt: now.toISOString() },
      { id: 5, name: "Silk Evening Gown", hsnCode: "62044200", listPrice: "4500.00", unit: "Pcs.", taxPercent: "18.00", createdAt: now.toISOString(), updatedAt: now.toISOString() },
    ];
    writeTable("items", defaultItems);
    nextIds.items = 6;
  }

  const existingBills = readTable<Bill>("bills");
  if (existingBills.length > 0) {
    const maxBillId = Math.max(...existingBills.map((b) => b.id || 0));
    nextIds.bills = maxBillId + 1;
  } else {
    nextIds.bills = 1;
  }

  console.log(`Seeded ${buyerRows.length} buyers and ${transactionData.length} transactions`);
}
