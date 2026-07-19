import { insert, db } from "./engine";
import type { Buyer, Transaction, Company, Item, Bill } from "./types";

const seedBuyers: Omit<Buyer, "id" | "createdAt" | "updatedAt">[] = [
  { companyName: "Sharma Garments Pvt Ltd", contactPerson: "Rajesh Sharma", phone: "9876543210", gstNumber: "27AABCU9603R1ZM", creditLimit: "500000.00", riskScore: "5.0", address: null, city: null, state: null, stateCode: null },
  { companyName: "Gupta Textile Traders", contactPerson: "Suresh Gupta", phone: "9876543211", gstNumber: "07AAAPG1234R1ZL", creditLimit: "300000.00", riskScore: "5.0", address: null, city: null, state: null, stateCode: null },
  { companyName: "Patel Fashion House", contactPerson: "Amit Patel", phone: "9876543212", gstNumber: "24AAIFP5678R1Z2", creditLimit: "750000.00", riskScore: "5.0", address: null, city: null, state: null, stateCode: null },
  { companyName: "Singh & Sons Clothiers", contactPerson: "Harpreet Singh", phone: "9876543213", gstNumber: "03AAACS9012R1ZV", creditLimit: "400000.00", riskScore: "5.0", address: null, city: null, state: null, stateCode: null },
  { companyName: "Kumar Apparel Distributors", contactPerson: "Vijay Kumar", phone: "9876543214", gstNumber: "29AAACK3456R1ZU", creditLimit: "600000.00", riskScore: "5.0", address: null, city: null, state: null, stateCode: null },
];

function getRandomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function seedDatabase() {
  const count = db.prepare("SELECT COUNT(*) as count FROM buyers").get() as { count: number };
  if (count.count > 0) return;
  console.log("Seeding database...");
  const now = new Date();
  
  const buyerIds: number[] = [];
  for (const b of seedBuyers) {
    const res = insert<Buyer>("buyers", {
      ...b,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    buyerIds.push(res.id);
  }

  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const bookTypes: ("CC" | "CS")[] = ["CC", "CS"];
  const txTypes: ("Sale" | "Payment_Received")[] = ["Sale", "Payment_Received"];

  for (let i = 0; i < 10; i++) {
    const buyerId = buyerIds[Math.floor(Math.random() * buyerIds.length)];
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

    insert<Transaction>("transactions", {
      buyerId,
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

  const defaultCompany: Omit<Company, "id"> = {
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
    startingBillNumber: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  insert<Company>("companies", defaultCompany);

  const defaultItems: Omit<Item, "id">[] = [
    { name: "Denim Trousers", hsnCode: "39231020", listPrice: "800.00", unit: "Pcs.", taxPercent: "18.00", createdAt: now.toISOString(), updatedAt: now.toISOString() },
    { name: "Cotton Polo Shirt", hsnCode: "61051010", listPrice: "600.00", unit: "Pcs.", taxPercent: "12.00", createdAt: now.toISOString(), updatedAt: now.toISOString() },
  ];
  for (const item of defaultItems) {
    insert<Item>("items", item);
  }
}
