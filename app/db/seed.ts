import { getDb } from "../api/queries/connection";
import { buyers, transactions } from "./schema";

const db = getDb();

// Seed Buyers - Indian wholesale garment buyers
const buyerData = [
  { companyName: "Sharma Garments Pvt Ltd", contactPerson: "Rajesh Sharma", phone: "9876543210", gstNumber: "27AABCU9603R1ZM", creditLimit: "500000.00" },
  { companyName: "Gupta Textile Traders", contactPerson: "Suresh Gupta", phone: "9876543211", gstNumber: "07AAAPG1234R1ZL", creditLimit: "300000.00" },
  { companyName: "Patel Fashion House", contactPerson: "Amit Patel", phone: "9876543212", gstNumber: "24AAIFP5678R1Z2", creditLimit: "750000.00" },
  { companyName: "Singh & Sons Clothiers", contactPerson: "Harpreet Singh", phone: "9876543213", gstNumber: "03AAACS9012R1ZV", creditLimit: "400000.00" },
  { companyName: "Kumar Apparel Distributors", contactPerson: "Vijay Kumar", phone: "9876543214", gstNumber: "29AAACK3456R1ZU", creditLimit: "600000.00" },
  { companyName: "Reddy Wholesale Mart", contactPerson: "Srinivas Reddy", phone: "9876543215", gstNumber: "36AABCR7890R1ZX", creditLimit: "450000.00" },
  { companyName: "Mehta Trading Company", contactPerson: "Pankaj Mehta", phone: "9876543216", gstNumber: "08AADCM2345R1ZY", creditLimit: "350000.00" },
  { companyName: "Joshi Cloth Merchants", contactPerson: "Nilesh Joshi", phone: "9876543217", gstNumber: "27AAAFJ6789R1ZP", creditLimit: "250000.00" },
  { companyName: "Verma Garment Exports", contactPerson: "Rahul Verma", phone: "9876543218", gstNumber: "09AAAVG0123R1ZQ", creditLimit: "800000.00" },
  { companyName: "Iyer Textile Corporation", contactPerson: "Krishnan Iyer", phone: "9876543219", gstNumber: "33AAATI4567R1ZR", creditLimit: "550000.00" },
  { companyName: "Nair Fashion Wholesale", contactPerson: "Mohan Nair", phone: "9876543220", gstNumber: "32AAANN8901R1ZS", creditLimit: "200000.00" },
  { companyName: "Desai Brothers Apparels", contactPerson: "Mahesh Desai", phone: "9876543221", gstNumber: "24AAADD2345R1ZT", creditLimit: "650000.00" },
  { companyName: "Banerjee Cloth House", contactPerson: "Subhas Banerjee", phone: "9876543222", gstNumber: "19AAABN6789R1ZU", creditLimit: "280000.00" },
  { companyName: "Chauhan Garments Ltd", contactPerson: "Dinesh Chauhan", phone: "9876543223", gstNumber: "23AAACC0123R1ZV", creditLimit: "500000.00" },
  { companyName: "Malhotra Fashion Hub", contactPerson: "Anil Malhotra", phone: "9876543224", gstNumber: "07AAAMH4567R1ZW", creditLimit: "900000.00" },
  { companyName: "Rao Textile Traders", contactPerson: "Prasad Rao", phone: "9876543225", gstNumber: "37AAART8901R1ZX", creditLimit: "320000.00" },
  { companyName: "Agarwal & Co Garments", contactPerson: "Sunil Agarwal", phone: "9876543226", gstNumber: "08AAACA2345R1ZY", creditLimit: "420000.00" },
  { companyName: "Menon Apparels", contactPerson: "Ravi Menon", phone: "9876543227", gstNumber: "32AAAMN6789R1ZP", creditLimit: "180000.00" },
  { companyName: "Pillai Garment Stores", contactPerson: "Suresh Pillai", phone: "9876543228", gstNumber: "32AAAPP0123R1ZQ", creditLimit: "380000.00" },
  { companyName: "Bhatt Cloth Distributors", contactPerson: "Kiran Bhatt", phone: "9876543229", gstNumber: "24AAABB4567R1ZR", creditLimit: "480000.00" },
];

// Generate dates over last 6 months
function getRandomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

const now = new Date();
const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

// Seed function
async function seed() {
  console.log("Seeding database...");

  // Insert buyers
  await db.insert(buyers).values(buyerData as any);
  console.log(`Inserted ${buyerData.length} buyers`);

  // Fetch all buyers to get IDs
  const allBuyers = await db.select().from(buyers);

  // Generate 150 transactions
  const transactionData: any[] = [];
  const bookTypes = ["CC", "CS"] as const;
  const txTypes = ["Sale", "Payment_Received"] as const;

  for (let i = 0; i < 150; i++) {
    const buyer = allBuyers[Math.floor(Math.random() * allBuyers.length)];
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
      buyerId: buyer.id,
      bookType,
      transactionDate: new Date(formatDate(txDate)),
      dueDate: isSale ? new Date(formatDate(dueDate)) : null,
      amount: amount.toFixed(2),
      trouserQuantity: quantity,
      checkNumber: bookType === "CC" && isSale ? `CHQ${Math.floor(Math.random() * 900000 + 100000)}` : null,
      transactionType: txType,
      includeInReporting: Math.random() > 0.15,
    });
  }

  // Sort by date
  transactionData.sort((a, b) => a.transactionDate.getTime() - b.transactionDate.getTime());

  await db.insert(transactions).values(transactionData);
  console.log(`Inserted ${transactionData.length} transactions`);

  console.log("Seed complete!");
}

seed().catch(console.error);
