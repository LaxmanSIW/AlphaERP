import { useState } from "react";
import { useNavigate } from "react-router";
import {
  TrendingUp,
  Wallet,
  AlertCircle,
  Package,
  DollarSign,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

function formatCurrency(value: number): string {
  if (value >= 100000) {
    return `₹ ${(value / 100000).toFixed(2)}L`;
  }
  return `₹ ${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function KPICard({
  title,
  value,
  icon: Icon,
  iconColor,
  iconBg,
  trend,
  subtext,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  trend?: { value: number; positive: boolean };
  subtext?: string;
}) {
  return (
    <Card className="border-[#d9cfc0] bg-white hover:shadow-md transition-shadow duration-150">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-[#3d4f6f] uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-semibold text-[#1e2a4a] mt-3 font-mono">{value}</p>
            {trend && (
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                    trend.positive
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {trend.positive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                  {trend.value}%
                </span>
                <span className="text-xs text-[#3d4f6f]">vs last month</span>
              </div>
            )}
            {subtext && <p className="text-xs text-[#3d4f6f] mt-2">{subtext}</p>}
          </div>
          <div className={`w-10 h-10 rounded-full ${iconBg} flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Top5Card({
  title,
  subtitle,
  iconColor,
  items,
  valuePrefix = "₹",
  valueSuffix = "",
  onItemClick,
}: {
  title: string;
  subtitle: string;
  iconColor: string;
  items: Array<{ buyerId: number; companyName: string; value: number }>;
  valuePrefix?: string;
  valueSuffix?: string;
  onItemClick: (buyerId: number) => void;
}) {
  return (
    <Card className="border-[#d9cfc0] bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${iconColor}`} />
          <CardTitle className="text-base font-semibold text-[#1e2a4a]">{title}</CardTitle>
        </div>
        <p className="text-xs text-[#3d4f6f] ml-5">{subtitle}</p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {items.length === 0 ? (
            <p className="text-sm text-[#3d4f6f] text-center py-4">No data available</p>
          ) : (
            items.map((item, index) => (
              <div
                key={item.buyerId}
                onClick={() => onItemClick(item.buyerId)}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#f5f0e8] cursor-pointer transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-[#e8e0d4] flex items-center justify-center text-xs font-semibold text-[#1e2a4a] flex-shrink-0">
                  {index + 1}
                </div>
                <span className="flex-1 text-sm font-medium text-[#1e2a4a] truncate">
                  {item.companyName}
                </span>
                <span className="text-sm font-semibold font-mono text-[#1e2a4a]">
                  {valuePrefix}
                  {item.value.toLocaleString("en-IN")}
                  {valueSuffix}
                </span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [bookType, setBookType] = useState<"ALL" | "CC" | "CS">("ALL");

  // Fetch dashboard data
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery(
    { bookType: bookType as any },
    { enabled: true }
  );
  const { data: topDebtors } = trpc.dashboard.topDebtors.useQuery(
    { bookType: bookType as any },
    { enabled: true }
  );
  const { data: topPaymasters } = trpc.dashboard.topPaymasters.useQuery(undefined, { enabled: true });
  const { data: topVolumeBuyers } = trpc.dashboard.topVolumeBuyers.useQuery(undefined, { enabled: true });
  const { data: monthlyTrends } = trpc.dashboard.monthlyTrends.useQuery(
    { bookType: bookType as any },
    { enabled: true }
  );
  const { data: monthlyQuantity } = trpc.dashboard.monthlyQuantity.useQuery(
    { bookType: bookType as any },
    { enabled: true }
  );

  // Fetch recent transactions
  const { data: recentTransactions } = trpc.transaction.list.useQuery(
    { limit: 10 },
    { enabled: true }
  );
  const { data: allTimeSales } = trpc.dashboard.allTimeSales.useQuery(
    { bookType: bookType as any },
    { enabled: true }
  );

  const bookTypeOptions = [
    { key: "ALL", label: "All Books" },
    { key: "CC", label: "Alpha CC" },
    { key: "CS", label: "Alpha CS" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1e2a4a]">Dashboard</h1>
          <p className="text-sm text-[#3d4f6f] mt-1">Financial Overview</p>
        </div>
        <div className="flex items-center gap-2 bg-[#e8e0d4] rounded-full p-1">
          {bookTypeOptions.map((option) => (
            <button
              key={option.key}
              onClick={() => setBookType(option.key as any)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                bookType === option.key
                  ? "bg-white text-[#1e2a4a] shadow-sm"
                  : "text-[#3d4f6f] hover:text-[#1e2a4a]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5">
        <KPICard
          title="Total Sale Amount"
          value={statsLoading ? "Loading..." : formatCurrency(allTimeSales?.totalSaleAmount || 0)}
          icon={DollarSign}
          iconColor="text-purple-600"
          iconBg="bg-purple-100"
          subtext={bookType === "ALL" ? "All books, all time" : `Alpha ${bookType}, all time`}
        />
        <KPICard
          title="Total Sales"
          value={statsLoading ? "Loading..." : formatCurrency(stats?.totalSales || 0)}
          icon={TrendingUp}
          iconColor="text-[#c4703f]"
          iconBg="bg-[#c4703f]/10"
          trend={{ value: 12.5, positive: true }}
        />
        <KPICard
          title="Payments Received"
          value={statsLoading ? "Loading..." : formatCurrency(stats?.totalPayments || 0)}
          icon={Wallet}
          iconColor="text-green-600"
          iconBg="bg-green-100"
          trend={{ value: 8.2, positive: true }}
        />
        <KPICard
          title="Outstanding Balance"
          value={statsLoading ? "Loading..." : formatCurrency(stats?.totalOutstanding || 0)}
          icon={AlertCircle}
          iconColor="text-red-500"
          iconBg="bg-red-100"
          subtext="Across all buyers"
        />
        <KPICard
          title="Total Pieces Sold"
          value={statsLoading ? "Loading..." : `${(stats?.totalPieces || 0).toLocaleString("en-IN")}`}
          icon={Package}
          iconColor="text-blue-500"
          iconBg="bg-blue-100"
          subtext="Trousers this period"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="border-[#d9cfc0] bg-white">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-[#1e2a4a]">
              Monthly Sales vs Payments
            </CardTitle>
            <p className="text-xs text-[#3d4f6f]">Last 12 months</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyTrends || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e0d4" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#3d4f6f" }} />
                <YAxis
                  tick={{ fontSize: 12, fill: "#3d4f6f" }}
                  tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`}
                />
                <Tooltip
                  formatter={(value: number) => [`₹ ${value.toLocaleString("en-IN")}`, ""]}
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #d9cfc0",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Line
                  type="monotone"
                  dataKey="sales"
                  name="Sales"
                  stroke="#c4703f"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#c4703f" }}
                />
                <Line
                  type="monotone"
                  dataKey="payments"
                  name="Payments"
                  stroke="#4a9b6b"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#4a9b6b" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-[#d9cfc0] bg-white">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-[#1e2a4a]">
              Monthly Trouser Movement
            </CardTitle>
            <p className="text-xs text-[#3d4f6f]">Pieces sold per month</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyQuantity || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e0d4" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#3d4f6f" }} />
                <YAxis tick={{ fontSize: 12, fill: "#3d4f6f" }} />
                <Tooltip
                  formatter={(value: number) => [`${value.toLocaleString("en-IN")} pcs`, ""]}
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #d9cfc0",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar
                  dataKey="quantity"
                  name="Pieces"
                  fill="#d4895a"
                  stroke="#c4703f"
                  strokeWidth={1}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top 5 Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Top5Card
          title="Top 5 Debtors"
          subtitle="Highest outstanding"
          iconColor="bg-red-500"
          items={topDebtors?.map((d) => ({ buyerId: d.buyerId, companyName: d.companyName, value: d.outstanding })) || []}
          onItemClick={(id) => navigate(`/buyers?id=${id}`)}
        />
        <Top5Card
          title="Top 5 Paymasters"
          subtitle="Most payments (30 days)"
          iconColor="bg-green-500"
          items={topPaymasters?.map((p) => ({ buyerId: p.buyerId, companyName: p.companyName, value: p.totalPaid })) || []}
          onItemClick={(id) => navigate(`/buyers?id=${id}`)}
        />
        <Top5Card
          title="Volume Leaders"
          subtitle="Most pieces purchased"
          iconColor="bg-blue-500"
          items={topVolumeBuyers?.map((v) => ({ buyerId: v.buyerId, companyName: v.companyName, value: v.totalQuantity })) || []}
          valuePrefix=""
          valueSuffix=" pcs"
          onItemClick={(id) => navigate(`/buyers?id=${id}`)}
        />
      </div>

      {/* Recent Transactions */}
      <Card className="border-[#d9cfc0] bg-white">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-[#1e2a4a]">
              Recent Transactions
            </CardTitle>
            <p className="text-xs text-[#3d4f6f]">Last 10 transactions</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-xs border-[#d9cfc0]"
            onClick={() => navigate("/transactions")}
          >
            View All
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e8e0d4] text-xs text-[#3d4f6f] uppercase tracking-wider">
                  <th className="text-left py-3 px-4 font-semibold">Date</th>
                  <th className="text-left py-3 px-4 font-semibold">Buyer</th>
                  <th className="text-left py-3 px-4 font-semibold">Book</th>
                  <th className="text-left py-3 px-4 font-semibold">Type</th>
                  <th className="text-right py-3 px-4 font-semibold">Qty</th>
                  <th className="text-right py-3 px-4 font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions?.items?.map((tx) => (
                  <tr key={tx.id} className="border-b border-[#f5f0e8] hover:bg-[#f5f0e8]/50 transition-colors">
                    <td className="py-3 px-4 text-sm text-[#1e2a4a]">
                      {tx.transactionDate ? new Date(tx.transactionDate).toLocaleDateString("en-IN") : "-"}
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-[#1e2a4a]">{tx.companyName}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                          tx.bookType === "CC"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {tx.bookType}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                          tx.transactionType === "Sale"
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {tx.transactionType === "Sale" ? "Sale" : "Payment"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-right font-mono">{tx.trouserQuantity || 0}</td>
                    <td className="py-3 px-4 text-sm text-right font-mono">
                      ₹ {parseFloat(tx.amount as string).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
                {(!recentTransactions?.items || recentTransactions.items.length === 0) && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-[#3d4f6f]">
                      No transactions found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
