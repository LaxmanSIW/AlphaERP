import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BookOpen,
  Shield,
  BarChart3,
  Code,
  Server,
  Rocket,
  Package,
  Terminal,
  Database,
  FileText,
} from "lucide-react";

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-[#d9cfc0] bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#c4703f]/10 flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 text-[#c4703f]" />
          </div>
          <CardTitle className="text-lg font-semibold text-[#1e2a4a]">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0 text-sm text-[#3d4f6f] leading-relaxed space-y-3">
        {children}
      </CardContent>
    </Card>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-[#1e2a4a] text-[#b8c4d4] p-3 rounded-lg text-xs font-mono overflow-x-auto mt-2">
      <code>{children}</code>
    </pre>
  );
}

export default function About() {
  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#1e2a4a]">About</h1>
        <p className="text-sm text-[#3d4f6f] mt-1">
          Alpha Wholesale ERP System - Technical Documentation
        </p>
      </div>

      {/* System Overview */}
      <Section icon={BookOpen} title="System Overview">
        <p>
          AlphaERP is a full-stack enterprise resource planning system designed for wholesale garment businesses.
          It manages buyers, transactions (CC and CS books), generates financial reports, and provides
          risk analysis for credit management.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {["React 19", "TypeScript", "Tailwind CSS", "shadcn/ui", "tRPC", "JSON DB", "Hono", "Node.js"].map((tech) => (
            <span key={tech} className="px-2 py-1 bg-[#f5f0e8] rounded-md text-xs font-mono text-[#1e2a4a]">
              {tech}
            </span>
          ))}
        </div>
      </Section>

      {/* Risk Calculation Logic */}
      <Section icon={Shield} title="Risk Calculation Logic">
        <p>
          The risk score for each buyer is calculated based on their <strong>credit utilization ratio</strong>,
          which compares their outstanding balance against their assigned credit limit.
        </p>
        <div className="bg-[#f5f0e8] rounded-lg p-4 space-y-2">
          <h4 className="font-semibold text-[#1e2a4a] text-xs uppercase tracking-wider">Formula</h4>
          <p className="font-mono text-xs">
            Utilization = Outstanding Balance / Credit Limit
          </p>
          <div className="space-y-1 pt-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
              <strong>High Risk (Score: 2):</strong> Utilization &gt; 80%
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" />
              <strong>Medium Risk (Score: 5):</strong> Utilization 40% - 80%
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
              <strong>Low Risk (Score: 8):</strong> Utilization &lt; 40%
            </div>
          </div>
        </div>
        <p className="text-xs text-[#8b9bb4]">
          If a buyer has no credit limit set, the risk score defaults to Medium (5).
          The risk badge color changes dynamically based on the calculated score.
        </p>
      </Section>

      {/* Reports Overview */}
      <Section icon={BarChart3} title="How Reports Work">
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold text-[#1e2a4a] mb-1">Outstanding Report</h4>
            <p>
              Shows all buyers with outstanding balances (total sales minus total payments received).
              Filters by book type (CC/CS) and risk level. Days overdue are calculated from the
              latest due date of sale transactions.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-[#1e2a4a] mb-1">Buyer Statement</h4>
            <p>
              Generates a detailed transaction ledger for a specific buyer with running balance.
              Supports date range filtering. Exports to PDF (via browser print) and CSV.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-[#1e2a4a] mb-1">Trouser Movement</h4>
            <p>
              Tracks trouser quantity sold over time, grouped by Day, Week, Month, or Buyer.
              Helps identify sales patterns and peak volume periods.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-[#1e2a4a] mb-1">Sales Report (Monthly/Weekly)</h4>
            <p>
              Aggregated sales data with filters for time period, payment type (CC/CS),
              custom date range, and specific buyer selection.
            </p>
          </div>
        </div>
      </Section>

      {/* Developer Guide */}
      <Section icon={Code} title="Developer Guide">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-[#1e2a4a] mb-1 flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5" />
              How to Run the Development Server
            </h4>
            <CodeBlock>{`# Install dependencies
npm install

# Start development server (runs on http://localhost:3000)
npm run dev`}</CodeBlock>
          </div>

          <div>
            <h4 className="font-semibold text-[#1e2a4a] mb-1 flex items-center gap-2">
              <Database className="w-3.5 h-3.5" />
              Database
            </h4>
            <p className="text-sm text-[#3d4f6f] mb-2">
              This project uses a simple JSON file-based database. Data is stored in the{" "}
              <code className="bg-[#f5f0e8] px-1 rounded text-xs">data/</code>{" "}
              directory as individual JSON files for each entity (buyers.json, transactions.json, auditLogs.json).
              The database is automatically seeded with sample data on first run.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-[#1e2a4a] mb-1 flex items-center gap-2">
              <Rocket className="w-3.5 h-3.5" />
              How to Deploy
            </h4>
            <CodeBlock>{`# Build for production
npm run build

# Start production server
npm start

# Or using PM2
pm2 start dist/boot.js --name alpha-erp`}</CodeBlock>
          </div>

          <div>
            <h4 className="font-semibold text-[#1e2a4a] mb-1 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" />
              How to Add a New Page/Feature
            </h4>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                <strong>Create page component:</strong> Add a new file in{" "}
                <code className="bg-[#f5f0e8] px-1 rounded text-xs">src/pages/YourPage.tsx</code>
              </li>
              <li>
                <strong>Add route:</strong> Register the route in{" "}
                <code className="bg-[#f5f0e8] px-1 rounded text-xs">src/App.tsx</code>{" "}
                inside the <code className="bg-[#f5f0e8] px-1 rounded text-xs">&lt;Routes&gt;</code> block
              </li>
              <li>
                <strong>Add nav link:</strong> Add to the{" "}
                <code className="bg-[#f5f0e8] px-1 rounded text-xs">navItems</code>{" "}
                array in <code className="bg-[#f5f0e8] px-1 rounded text-xs">src/components/Layout.tsx</code>
              </li>
              <li>
                <strong>Create API router:</strong> Add a new router file in{" "}
                <code className="bg-[#f5f0e8] px-1 rounded text-xs">api/routers/yourRouter.ts</code>
              </li>
              <li>
                <strong>Register router:</strong> Import and add to{" "}
                <code className="bg-[#f5f0e8] px-1 rounded text-xs">api/router.ts</code>
              </li>
              <li>
                <strong>Add JSON DB type:</strong> Add type to{" "}
                <code className="bg-[#f5f0e8] px-1 rounded text-xs">api/json-db/types.ts</code>{" "}
                if new data entity is needed
              </li>
            </ol>
          </div>

          <div>
            <h4 className="font-semibold text-[#1e2a4a] mb-1 flex items-center gap-2">
              <Package className="w-3.5 h-3.5" />
              Install Dependencies
            </h4>
            <CodeBlock>{`# Install a production dependency
npm install <package-name>

# Install a dev dependency
npm install -D <package-name>

# Note: This project uses native ES modules (type: "module")
# Use .ts extensions in all imports`}</CodeBlock>
          </div>
        </div>
      </Section>

      {/* Project Structure */}
      <Section icon={Server} title="Project Structure">
        <CodeBlock>{`AlphaERP/
├── app/
│   ├── api/                    # Backend
│   │   ├── boot.ts             # Hono server entry
│   │   ├── router.ts           # tRPC router registry
│   │   ├── middleware.ts       # Auth middleware
│   │   ├── context.ts          # Request context
│   │   ├── local-auth.ts       # Local authentication
│   │   ├── json-db/            # JSON Database layer
│   │   │   ├── types.ts        # Type definitions
│   │   │   └── engine.ts       # CRUD engine
│   │   ├── routers/            # tRPC route handlers
│   │   │   ├── buyer.ts
│   │   │   ├── transaction.ts
│   │   │   ├── dashboard.ts
│   │   │   ├── report.ts
│   │   │   └── audit.ts
│   │   └── queries/            # DB connection
│   ├── contracts/              # Shared types/constants
│   └── src/
│       ├── pages/              # Route pages
│       ├── components/         # React components
│       ├── hooks/              # Custom hooks
│       └── providers/          # Context providers
├── data/                       # JSON database files
├── .env                        # Environment variables
└── package.json`}</CodeBlock>
      </Section>

      {/* Keyboard Shortcuts */}
      <Card className="border-[#d9cfc0] bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-[#1e2a4a] uppercase tracking-wider">
            Keyboard Shortcuts
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              ["Ctrl+1 ~ Ctrl+6", "Navigate pages"],
              ["Ctrl+B", "Toggle sidebar"],
              ["Ctrl+N", "New transaction"],
              ["Ctrl+S", "Save form"],
            ].map(([keys, desc]) => (
              <div key={keys} className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-[#f5f0e8] rounded text-[10px] font-mono text-[#1e2a4a]">
                  {keys}
                </kbd>
                <span className="text-[#3d4f6f]">{desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
