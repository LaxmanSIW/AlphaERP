# Alpha ERP – Comprehensive Developer & Operator Guide

Welcome to the **Alpha ERP** project guide. This consolidated documentation provides you with everything you need to set up, customize, extend, and deploy this full-stack enterprise application.

---

## Table of Contents
1. [Local Development Setup & Production Deployment](#1-local-development-setup--production-deployment)
2. [Project Architecture & Directory Structure](#2-project-architecture--directory-structure)
3. [How to Add a New Page (End-to-End Workflow)](#3-how-to-add-a-new-page-end-to-end-workflow)
4. [User Interface Overview & Operator Manual](#4-user-interface-overview--operator-manual)
5. [How to Edit or Add Dashboard Cards](#5-how-to-edit-or-add-dashboard-cards)
6. [How to Customize the Bill Print Template & Styles](#6-how-to-customize-the-bill-print-template--styles)

---

## 1. Local Development Setup & Production Deployment

Alpha ERP is a full-stack Web Application built on **React 19**, **Vite**, and **Hono** (serving as a fast backend server over Node.js). 

### Prerequisites
- **Node.js** (v20.0.0 or higher recommended)
- **npm** (v10.0.0 or higher)

### Local Environment Setup
Follow these steps to run the project in your local development environment:

1. **Extract or Clone the Repository** into your desired workspace directory.
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Configure Environment Variables**:
   Create a `.env` file at the root of the project using `.env.example` as a template:
   ```env
   # .env
   PORT=3000
   NODE_ENV=development
   ```
4. **Run the Development Server**:
   ```bash
   npm run dev
   ```
   *Vite will boot the client application and register the Hono dev server plugin. Open `http://localhost:3000` in your browser.*

### Production Build & Compilation
To compile the application into a single optimized static bundle and server executable:

1. **Build the Application**:
   ```bash
   npm i -g batter-sqlite3@12.11.1
   ```
   ```bash
   npm run build
   ```
   This command executes two main compilations:
   - Compiles client assets using **Vite**, placing optimized static files in `dist/public/`.
   - Bundles the Hono server code (`api/boot.ts`) into a standalone CommonJS/ESM module in `dist/boot.js` using **esbuild**.
   - but since we are using batter-sqlite3, so it can't bind so we need to install sqlite as global package
    

2. **Start Production Server Locally**:
   ```bash
   npm start
   ```
   *This starts the Node server running `dist/boot.js`, serving the complete API and the static files inside `dist/public/`.*

### Deployment to Production (Cloud Run, Docker, VPS)
To deploy this application to a live server:

1. **Docker Containerization**:
   Create a standard `Dockerfile` in the root directory:
   ```dockerfile
   FROM node:20-slim AS builder
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci
   COPY . .
   RUN npm run build

   FROM node:20-slim
   WORKDIR /app
   ENV NODE_ENV=production
   ENV PORT=3000
   COPY --from=builder /app/package*.json ./
   COPY --from=builder /app/dist ./dist
   RUN npm ci --only=production
   EXPOSE 3000
   CMD ["node", "dist/boot.js"]
   ```

2. **Deploy to Google Cloud Run**:
   Submit your code to Google Cloud Build and deploy:
   ```bash
   gcloud builds submit --tag gcr.io/your-project-id/alpha-erp
   gcloud run deploy alpha-erp --image gcr.io/your-project-id/alpha-erp --platform managed --port 3000 --allow-unauthenticated
   ```

---

## 2. Project Architecture & Directory Structure

Here is a visual map of the workspace structure:

```text
├── api/                     # Backend Code (Hono Server + tRPC Routers)
│   ├── json-db/             # SQLite Database Engine (better-sqlite3)
│   │   ├── engine.ts        # Primary database engine (SQLite queries)
│   │   ├── types.ts         # Types definitions (e.g. Bill, Transaction, Buyer)
│   │   └── index.ts         # Database client initializer
│   ├── queries/             # DB query helper abstractions
│   ├── routers/             # Business Logic Routers (tRPC controllers)
│   │   ├── bill.ts          # Invoicing logic
│   │   ├── dashboard.ts     # Dashboard aggregations & KPIs
│   │   ├── report.ts        # Performance & movement report queries
│   │   └── transaction.ts   # Ledger transaction records
│   ├── boot.ts              # Entry point starting Hono server & registering tRPC
│   ├── context.ts           # tRPC request context resolver
│   └── router.ts            # Central assembly connecting individual routers
│
├── src/                     # Frontend Code (React SPA)
│   ├── components/          # Shared visual elements & Shadcn UI foundations
│   ├── hooks/               # Custom React lifecycle helpers
│   ├── pages/               # Functional Screen Modules (pages)
│   │   ├── Dashboard.tsx    # Charts, sales counters, debtor list
│   │   ├── Bills.tsx        # Billing invoice manager and PDF/Print view
│   │   ├── Transactions.tsx # Ledger entries (Sales, Payment Received)
│   │   ├── Items.tsx        # Product catalog & HSN listings
│   │   ├── Buyers.tsx       # Buyer profile management
│   │   ├── Reports.tsx      # Comprehensive business reports center
│   │   └── Settings.tsx     # ERP profile configuration
│   ├── App.tsx              # Application layout, React Router, Sidebar routing
│   ├── main.tsx             # DOM entry point
│   └── index.css            # Global CSS styles with Tailwind CSS directives
```

### Purpose of Core Folders & Propagation Path
- **Database (`api/json-db/`)**: Local persistence is powered by a high-performance SQLite database (`better-sqlite3`) stored directly on the container/virtual machine file system (`data/sqlite.db`). This provides efficient, scalable querying without needing a complex external database server.
- **Backend Routers (`api/routers/`)**: Define the server-side queries and mutations using `tRPC` and `Zod` validation schemas.
- **Frontend Pages (`src/pages/`)**: Retrieve data reactively using `@tanstack/react-query` and `@trpc/react-query`. Every modification inside the backend routers automatically updates the typescript interfaces used on the frontend.

---

## 3. How to Add a New Page (End-to-End Workflow)

Suppose you need to add a new page called **"Inventory Management"**. Follow these precise steps:

### Step 1: Create the Page Component
Create a new file `/src/pages/Inventory.tsx` and export a React component:
```tsx
import React from "react";
import { Card, CardContent } from "@/components/ui/card";

export default function Inventory() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-[#1e2a4a]">Inventory Manager</h1>
      </div>
      <Card className="border-[#d9cfc0] bg-white">
        <CardContent className="p-6">
          <p className="text-sm text-[#3d4f6f]">Inventory tracking panel.</p>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Step 2: Set Up Backend Router & Queries (If database endpoints are required)
1. Create a new file `/api/routers/inventory.ts`:
   ```ts
   import { createRouter, publicQuery } from "../middleware";
   import { z } from "zod";

   export const inventoryRouter = createRouter({
     getStock: publicQuery.query(async () => {
       // Fetch or manipulate database objects here
       return [{ itemId: 1, stock: 120 }];
     }),
   });
   ```
2. Import and register your router in `/api/router.ts`:
   ```ts
   import { inventoryRouter } from "./routers/inventory";

   export const appRouter = createRouter({
     // ... other routers
     inventory: inventoryRouter,
   });
   ```

### Step 3: Register Route and Sidebar Navigation in `src/App.tsx`
1. Open `/src/App.tsx`.
2. Import your page component:
   ```tsx
   import Inventory from "./pages/Inventory";
   ```
3. Add a path and navigation option to the sidebar list:
   ```tsx
   const navigationItems = [
     // ... other navigation items
     { key: "inventory", label: "Inventory", path: "/inventory", icon: PackageCheck },
   ];
   ```
4. Define the route handler inside the React Router `<Routes>` stack:
   ```tsx
   <Route path="/inventory" element={<Inventory />} />
   ```

---

## 4. User Interface Overview & Operator Manual

The ERP utilizes a modern **minimalist sand-and-slate design** with warm cream backgrounds (`#f5f0e8`), charcoal typography, and subtle leather-orange/rust accents (`#c4703f`). 

### Core Layout Matrix
```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                                 HEADER / TOPBAR                              │
├─────────────┬────────────────────────────────────────────────────────────────┤
│             │                                                                │
│   SIDEBAR   │                            MAIN WORKSPACE                      │
│  NAVIGATOR  │                                                                │
│             │   [ KPI Card 1 ]   [ KPI Card 2 ]   [ KPI Card 3 ]             │
│  - Dash     │                                                                │
│  - Invoices │   ┌───────────────────────┐   ┌────────────────────────────┐   │
│  - Ledger   │   │     Sales Chart       │   │        Debtor List         │   │
│  - Reports  │   │                       │   │                            │   │
│             │   └───────────────────────┘   └────────────────────────────┘   │
└─────────────┴────────────────────────────────────────────────────────────────┘
```

### Operator Workflow Guide
- **Issuing Bills**: Navigate to `Invoices`. Click **"Create Invoice"**. Search and select the buyer. Add multiple items from your catalog, configure quantities and discounts, and hit **"Save Invoice"**. You can immediately click **"Print"** to see the clean, pre-styled tax invoice template.
- **Recording Ledger Transactions**: Payments and general sales receipts are logged in the `Ledger` (Transactions) screen. Payments automatically reduce a buyer's outstanding debit balance.
- **Analyzing Business Health**: The `Reports Centre` offers visual metrics: outstanding dues statement, weekly/monthly sales curves, item performance grids, GST tax summaries, and product movement listings.

---

## 5. How to Edit or Add Dashboard Cards

All dashboard counters are managed cooperatively between `/api/routers/dashboard.ts` (data retrieval) and `/src/pages/Dashboard.tsx` (visualization rendering).

### To Edit an Existing Metric Counter
If you need to adjust what records count as a metric, look inside the `.query()` function in `/api/routers/dashboard.ts`. For instance, to count only sales that are checked for reporting:
```ts
const totalPieces = filteredMonthTxs
  .filter(t => t.transactionType === "Sale" && t.includeInReporting)
  .reduce((sum, t) => sum + (t.trouserQuantity || 0), 0);
```

### To Add a New Dashboard KPI Card
Suppose you want to add a card for **"Average Sale Value (AOV)"**.

#### Step 1: Update Backend Router
In `/api/routers/dashboard.ts`, calculate the value inside the `stats` query:
```ts
// Calculate AOV
const salesCount = filteredMonthTxs.filter(t => t.transactionType === "Sale").length;
const averageOrderValue = salesCount > 0 ? totalSales / salesCount : 0;

return {
  totalSales,
  totalPayments,
  totalOutstanding,
  totalPieces,
  averageOrderValue, // return this metric
  periodLabel,
};
```

#### Step 2: Render Card on Frontend Page
In `/src/pages/Dashboard.tsx`, extract and render the new attribute:

1. Locate where `stats` is queried:
   ```tsx
   const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery({ bookType });
   ```
2. Place the markup in the KPI grid list:
   ```tsx
   <KPICard
     title="Average Sale Value"
     value={statsLoading ? "Loading..." : formatCurrency(stats?.averageOrderValue || 0)}
     icon={TrendingUp}
     iconColor="text-blue-600"
     iconBg="bg-blue-100"
     subtext="Per sale this period"
   />
   ```

---

## 6. How to Customize the Bill Print Template & Styles

The billing printable layout is rendered inside `/src/pages/Bills.tsx`. It consists of a dedicated print-optimized CSS overlay combined with high-density table cells designed to match standard physical thermal printers and A4 sheets perfectly.

### Primary Layout Sections in `Bills.tsx`
- **Print Overlay Rules (Line ~835)**:
  An inline `<style>` block overrides page margins, background colors, borders, and forces absolute monochrome contrast during print operations:
  ```css
  @media print {
    body { background: white !important; color: black !important; }
    .no-print { display: none !important; }
    .print-container { padding: 0 !important; margin: 0 !important; width: 100% !important; }
  }
  ```
- **Invoice Header Info**: Renders your custom company logo, GSTIN numbers, address block, and document metadata (Invoice Number, Supply Location, Invoice Date).
- **Billing Matrix**: A grid table that cleanly splits billing data and shipping destination side-by-side.
- **Dynamic Calculation Loop (Line ~920)**:
  Loops through added items, evaluating state tax vs. inter-state tax (evaluating whether place of supply matches base address states) and computing SGST/CGST/IGST breakdown:
  ```tsx
  const isInterState = !(activePrintBill.placeOfSupply || "").toLowerCase().includes("uttar pradesh");
  // calculations for sgst, cgst, igst tax shares
  ```

### How to Add or Remove Fields on Invoice Template
1. Open `/src/pages/Bills.tsx` and scroll to `<div className="print-container">` (typically around line 860).
2. **To Remove a Field** (e.g., *DueDate*):
   Simply remove or comment out its visual node block:
   ```tsx
   {/* To remove due date, delete or comment the block below */}
   {/* {activePrintBill.dueDate && (
     <div className="flex"><span className="w-28 font-bold">Due Date</span>...</div>
   )} */}
   ```
3. **To Customize Global Printing Spacing**:
   Find the CSS padding rule inside the media block stylesheet (around line ~850) and modify padding:
   ```css
   th, td {
     padding: 2px 4px !important; /* Decrease padding to compress taller bills */
   }
   ```
   
---

Thank you for coding with the Alpha ERP base template! Happy engineering!
