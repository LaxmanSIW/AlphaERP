import { useState } from "react";
import {
  AlertCircle,
  FileText,
  Download,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/providers/trpc";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type ReportTab = "outstanding" | "statement" | "movement";

export default function Reports() {
  const [activeTab, setActiveTab] = useState<ReportTab>("outstanding");

  const tabs = [
    { key: "outstanding" as ReportTab, label: "Outstanding Report", icon: AlertCircle },
    { key: "statement" as ReportTab, label: "Buyer Statement", icon: FileText },
    { key: "movement" as ReportTab, label: "Trouser Movement", icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#1e2a4a]">Reports</h1>
        <p className="text-sm text-[#3d4f6f] mt-1">Comprehensive financial reports</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#d9cfc0]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.key
                  ? "border-[#c4703f] text-[#c4703f]"
                  : "border-transparent text-[#3d4f6f] hover:text-[#1e2a4a]"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {activeTab === "outstanding" && <OutstandingReport />}
      {activeTab === "statement" && <BuyerStatementReport />}
      {activeTab === "movement" && <TrouserMovementReport />}
    </div>
  );
}

function OutstandingReport() {
  const [bookType, setBookType] = useState<"ALL" | "CC" | "CS">("ALL");
  const [riskLevel, setRiskLevel] = useState<"ALL" | "High" | "Medium" | "Low">("ALL");

  const { data, isLoading } = trpc.report.outstanding.useQuery({
    bookType,
    riskLevel,
  });

  const totalOutstanding = data?.reduce((sum, item) => sum + item.outstanding, 0) || 0;
  const overdueCount = data?.filter((item) => item.daysOverdue > 0).length || 0;

  const exportCSV = () => {
    if (!data) return;
    const headers = ["Buyer", "Book Type", "Total Sales", "Total Paid", "Outstanding", "Days Overdue", "Risk"];
    const rows = data.map((item) => [
      item.companyName,
      item.bookType,
      item.totalSales,
      item.totalPaid,
      item.outstanding,
      item.daysOverdue,
      `${item.riskScore} (${item.riskLevel})`,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `outstanding-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-[#e8e0d4] rounded-full p-1">
          {(["ALL", "CC", "CS"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setBookType(type)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                bookType === type ? "bg-white text-[#1e2a4a] shadow-sm" : "text-[#3d4f6f]"
              }`}
            >
              {type === "ALL" ? "All Books" : `Alpha ${type}`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 bg-[#e8e0d4] rounded-full p-1">
          {(["ALL", "High", "Medium", "Low"] as const).map((level) => (
            <button
              key={level}
              onClick={() => setRiskLevel(level)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                riskLevel === level ? "bg-white text-[#1e2a4a] shadow-sm" : "text-[#3d4f6f]"
              }`}
            >
              {level === "ALL" ? "All Risk" : level}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} className="border-[#d9cfc0] text-xs ml-auto">
          <Download className="w-3 h-3 mr-1" />
          Export CSV
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-[#d9cfc0] bg-white">
          <CardContent className="p-4">
            <p className="text-xs text-[#3d4f6f] uppercase">Total Outstanding</p>
            <p className="text-2xl font-semibold font-mono text-red-600 mt-1">
              ₹ {totalOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card className="border-[#d9cfc0] bg-white">
          <CardContent className="p-4">
            <p className="text-xs text-[#3d4f6f] uppercase">Overdue Buyers</p>
            <p className="text-2xl font-semibold font-mono text-[#1e2a4a] mt-1">{overdueCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="border-[#d9cfc0] bg-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f5f0e8] border-b border-[#e8e0d4] text-xs text-[#3d4f6f] uppercase tracking-wider">
                  <th className="text-left py-3 px-4 font-semibold">Buyer</th>
                  <th className="text-right py-3 px-4 font-semibold">Total Sales</th>
                  <th className="text-right py-3 px-4 font-semibold">Total Paid</th>
                  <th className="text-right py-3 px-4 font-semibold">Outstanding</th>
                  <th className="text-right py-3 px-4 font-semibold">Days Overdue</th>
                  <th className="text-center py-3 px-4 font-semibold">Risk</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="py-3 px-4"><div className="h-4 bg-[#e8e0d4] rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : (
                  data?.map((item) => (
                    <tr key={item.buyerId} className="border-b border-[#f5f0e8] hover:bg-[#f5f0e8]/50">
                      <td className="py-3 px-4 text-sm font-medium text-[#1e2a4a]">{item.companyName}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono">₹ {item.totalSales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono">₹ {item.totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono font-semibold text-red-600">
                        ₹ {item.outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-sm text-right font-mono">
                        {item.daysOverdue > 0 ? (
                          <span className="text-red-600">{item.daysOverdue} days</span>
                        ) : (
                          <span className="text-green-600">On time</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                          item.riskScore <= 3 ? "bg-red-500 text-white" :
                          item.riskScore <= 7 ? "bg-yellow-500 text-white" : "bg-green-500 text-white"
                        }`}>
                          {item.riskScore} - {item.riskLevel}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
                {(!isLoading && (!data || data.length === 0)) && (
                  <tr><td colSpan={6} className="py-8 text-center text-sm text-[#3d4f6f]">No outstanding amounts found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BuyerStatementReport() {
  const [buyerSearch] = useState("");
  const [selectedBuyerId, setSelectedBuyerId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: buyersList } = trpc.buyer.list.useQuery({ limit: 100, search: buyerSearch || undefined });
  const { data: statement } = trpc.report.buyerStatement.useQuery(
    { buyerId: selectedBuyerId!, startDate: startDate || undefined, endDate: endDate || undefined },
    { enabled: !!selectedBuyerId }
  );

  const exportCSV = () => {
    if (!statement) return;
    const headers = ["Date", "Description", "Book", "Debit", "Credit", "Balance"];
    const rows = statement.items.map((item: any) => [
      new Date(item.date).toLocaleDateString("en-IN"),
      item.description,
      item.bookType,
      item.debit || "",
      item.credit || "",
      item.balance,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `statement-${statement.buyer.companyName}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      {/* Buyer Selector */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[250px] max-w-[400px]">
          <Label className="text-sm font-medium text-[#1e2a4a] mb-1.5 block">Select Buyer</Label>
          <select
            value={selectedBuyerId || ""}
            onChange={(e) => setSelectedBuyerId(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-md border border-[#d9cfc0] bg-white text-sm text-[#1e2a4a] focus:outline-none focus:border-[#c4703f]"
          >
            <option value="">Select a buyer...</option>
            {buyersList?.items?.map((buyer) => (
              <option key={buyer.id} value={buyer.id}>{buyer.companyName}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-sm font-medium text-[#1e2a4a] mb-1.5 block">From</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border-[#d9cfc0]" />
        </div>
        <div>
          <Label className="text-sm font-medium text-[#1e2a4a] mb-1.5 block">To</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border-[#d9cfc0]" />
        </div>
        {selectedBuyerId && (
          <Button variant="outline" size="sm" onClick={exportCSV} className="border-[#d9cfc0]">
            <Download className="w-3 h-3 mr-1" />
            Export
          </Button>
        )}
      </div>

      {/* Statement */}
      {selectedBuyerId && statement && (
        <div className="space-y-4">
          {/* Buyer Info */}
          <div className="bg-[#f5f0e8] rounded-lg p-4 text-sm">
            <p className="font-semibold text-[#1e2a4a]">{statement.buyer.companyName}</p>
            <p className="text-[#3d4f6f]">{statement.buyer.contactPerson} | {statement.buyer.phone}</p>
          </div>

          {/* Balance */}
          <div className="flex items-center justify-between bg-[#1e2a4a] text-white rounded-lg px-6 py-3">
            <div>
              <p className="text-xs text-[#8b9bb4]">Opening Balance</p>
              <p className="font-mono font-semibold">₹ {statement.openingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#8b9bb4]">Closing Balance</p>
              <p className="font-mono font-semibold text-lg">₹ {statement.closingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
            </div>
          </div>

          {/* Table */}
          <Card className="border-[#d9cfc0] bg-white">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#f5f0e8] border-b border-[#e8e0d4] text-xs uppercase">
                      <th className="text-left py-3 px-4 font-semibold">Date</th>
                      <th className="text-left py-3 px-4 font-semibold">Description</th>
                      <th className="text-left py-3 px-4 font-semibold">Book</th>
                      <th className="text-right py-3 px-4 font-semibold text-red-600">Debit</th>
                      <th className="text-right py-3 px-4 font-semibold text-green-600">Credit</th>
                      <th className="text-right py-3 px-4 font-semibold">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.items.map((item: any, idx: number) => (
                      <tr key={idx} className="border-b border-[#f5f0e8] hover:bg-[#f5f0e8]/50">
                        <td className="py-3 px-4 text-[#3d4f6f]">{item.date ? new Date(item.date).toLocaleDateString("en-IN") : "-"}</td>
                        <td className="py-3 px-4 font-medium text-[#1e2a4a]">{item.description}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-semibold ${item.bookType === "CC" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                            {item.bookType}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-red-600">{item.debit > 0 ? `₹ ${item.debit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "-"}</td>
                        <td className="py-3 px-4 text-right font-mono text-green-600">{item.credit > 0 ? `₹ ${item.credit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "-"}</td>
                        <td className="py-3 px-4 text-right font-mono font-semibold">₹ {item.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    {statement.items.length === 0 && (
                      <tr><td colSpan={6} className="py-8 text-center text-[#3d4f6f]">No transactions found for selected period</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function TrouserMovementReport() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [bookType, setBookType] = useState<"ALL" | "CC" | "CS">("ALL");
  const [groupBy, setGroupBy] = useState<"Day" | "Week" | "Month" | "Buyer">("Day");

  const { data, isLoading } = trpc.report.trouserMovement.useQuery(
    { startDate, endDate, bookType, groupBy },
    { enabled: !!startDate && !!endDate }
  );

  const exportCSV = () => {
    if (!data) return;
    const headers = groupBy === "Buyer" ? ["Buyer", "CC Qty", "CS Qty", "Total", "Cumulative"] : ["Date", "CC Qty", "CS Qty", "Total", "Cumulative"];
    const rows = data.items.map((item: any) => [item.buyer || item.date, item.ccQuantity, item.csQuantity, item.total, item.cumulative]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trouser-movement-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <Label className="text-sm font-medium text-[#1e2a4a] mb-1.5 block">From</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border-[#d9cfc0]" />
        </div>
        <div>
          <Label className="text-sm font-medium text-[#1e2a4a] mb-1.5 block">To</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border-[#d9cfc0]" />
        </div>
        <div className="flex items-center gap-2 bg-[#e8e0d4] rounded-full p-1">
          {(["ALL", "CC", "CS"] as const).map((type) => (
            <button key={type} onClick={() => setBookType(type)} className={`px-3 py-1 rounded-full text-xs font-medium ${bookType === type ? "bg-white text-[#1e2a4a] shadow-sm" : "text-[#3d4f6f]"}`}>
              {type}
            </button>
          ))}
        </div>
        <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as any)} className="px-3 py-2 rounded-md border border-[#d9cfc0] bg-white text-sm">
          <option value="Day">By Day</option>
          <option value="Week">By Week</option>
          <option value="Month">By Month</option>
          <option value="Buyer">By Buyer</option>
        </select>
        <Button variant="outline" size="sm" onClick={exportCSV} className="border-[#d9cfc0] ml-auto">
          <Download className="w-3 h-3 mr-1" />
          Export
        </Button>
      </div>

      {/* Summary */}
      {data?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-[#d9cfc0] bg-white">
            <CardContent className="p-4">
              <p className="text-xs text-[#3d4f6f] uppercase">Total Pieces</p>
              <p className="text-xl font-semibold font-mono text-[#1e2a4a] mt-1">{data.summary.totalPieces.toLocaleString("en-IN")}</p>
            </CardContent>
          </Card>
          <Card className="border-[#d9cfc0] bg-white">
            <CardContent className="p-4">
              <p className="text-xs text-[#3d4f6f] uppercase">Average/Day</p>
              <p className="text-xl font-semibold font-mono text-[#1e2a4a] mt-1">{data.summary.averagePerDay.toLocaleString("en-IN")}</p>
            </CardContent>
          </Card>
          <Card className="border-[#d9cfc0] bg-white">
            <CardContent className="p-4">
              <p className="text-xs text-[#3d4f6f] uppercase">Peak</p>
              <p className="text-sm font-semibold text-[#1e2a4a] mt-1 truncate">{data.summary.peakDay}</p>
              <p className="text-xs font-mono text-[#c4703f]">{data.summary.peakCount} pcs</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chart */}
      {data && data.items.length > 0 && groupBy !== "Buyer" && (
        <Card className="border-[#d9cfc0] bg-white">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-[#1e2a4a]">Trouser Movement Chart</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={data.items}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e0d4" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#3d4f6f" }} />
                <YAxis tick={{ fontSize: 11, fill: "#3d4f6f" }} />
                <Tooltip contentStyle={{ backgroundColor: "white", border: "1px solid #d9cfc0", borderRadius: "8px", fontSize: "12px" }} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="ccQuantity" name="CC Book" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="csQuantity" name="CS Book" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card className="border-[#d9cfc0] bg-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f5f0e8] border-b border-[#e8e0d4] text-xs text-[#3d4f6f] uppercase tracking-wider">
                  <th className="text-left py-3 px-4 font-semibold">{groupBy === "Buyer" ? "Buyer" : "Date"}</th>
                  <th className="text-right py-3 px-4 font-semibold">CC Qty</th>
                  <th className="text-right py-3 px-4 font-semibold">CS Qty</th>
                  <th className="text-right py-3 px-4 font-semibold">Total</th>
                  <th className="text-right py-3 px-4 font-semibold">Cumulative</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 5 }).map((_, j) => <td key={j} className="py-3 px-4"><div className="h-4 bg-[#e8e0d4] rounded animate-pulse" /></td>)}</tr>
                  ))
                ) : (
                  data?.items?.map((item: any, idx: number) => (
                    <tr key={idx} className="border-b border-[#f5f0e8] hover:bg-[#f5f0e8]/50">
                      <td className="py-3 px-4 text-sm font-medium text-[#1e2a4a]">{item.buyer || (item.date ? new Date(item.date).toLocaleDateString("en-IN") : "-")}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono text-blue-600">{item.ccQuantity.toLocaleString("en-IN")}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono text-green-600">{item.csQuantity.toLocaleString("en-IN")}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono font-semibold">{item.total.toLocaleString("en-IN")}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono text-[#3d4f6f]">{item.cumulative.toLocaleString("en-IN")}</td>
                    </tr>
                  ))
                )}
                {(!isLoading && (!data?.items || data.items.length === 0)) && (
                  <tr><td colSpan={5} className="py-8 text-center text-sm text-[#3d4f6f]">No data for selected period</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { Label } from "@/components/ui/label";
