import { useState } from "react";
import {
  AlertCircle,
  FileText,
  Download,
  BarChart3,
  TrendingUp,
  Calendar,
  Filter,
  Truck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/providers/trpc";
import { useTableState } from "@/hooks/useTableState";
import { SortableHeader } from "@/components/SortableHeader";
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

type ReportTab = "outstanding" | "statement" | "movement" | "sales" | "items" | "gst" | "transport";

export default function Reports() {
  const [activeTab, setActiveTab] = useState<ReportTab>("outstanding");

  const tabs = [
    { key: "outstanding" as ReportTab, label: "Outstanding Report", icon: AlertCircle },
    { key: "statement" as ReportTab, label: "Buyer Statement", icon: FileText },
    { key: "movement" as ReportTab, label: "Trouser Movement", icon: BarChart3 },
    { key: "sales" as ReportTab, label: "Sales (Monthly / Weekly)", icon: TrendingUp },
    { key: "items" as ReportTab, label: "Item Performance", icon: BarChart3 },
    { key: "gst" as ReportTab, label: "GST / Tax Summary", icon: FileText },
    { key: "transport" as ReportTab, label: "Transport Performance", icon: Truck },
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
      {activeTab === "sales" && <SalesReport />}
      {activeTab === "items" && <ItemPerformanceReport />}
      {activeTab === "gst" && <GstTaxSummaryReport />}
      {activeTab === "transport" && <TransportPerformanceReport />}
    </div>
  );
}

// ─── Outstanding Report ──────────────────────────────────
function OutstandingReport() {
  const [bookType, setBookType] = useState<"ALL" | "CC" | "CS">("ALL");
  const [riskLevel, setRiskLevel] = useState<"ALL" | "High" | "Medium" | "Low">("ALL");

  const { data, isLoading } = trpc.report.outstanding.useQuery({
    bookType,
    riskLevel,
  });

  const table = useTableState({
    data: (data as any[]) || [],
    searchFields: ["companyName"],
    defaultSortKey: "outstanding",
    defaultSortDirection: "desc",
  });

  const totalOutstanding = table.filteredData?.reduce((sum: number, item: any) => sum + (item.outstanding || 0), 0) || 0;

  const exportCSV = () => {
    if (!data) return;
    const headers = ["Buyer", "Book Type", "Total Parcels", "Total Sales", "Total Paid", "Outstanding", "Days Overdue", "Risk"];
    const rows = table.filteredData.map((item: any) => [
      item.companyName,
      item.bookType,
      item.totalParcels || 0,
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
            <p className="text-xs text-[#3d4f6f] uppercase">Filtered Buyers</p>
            <p className="text-2xl font-semibold font-mono text-[#1e2a4a] mt-1">{table.filteredData?.length || 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#d9cfc0] bg-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f5f0e8] border-b border-[#e8e0d4] text-xs text-[#3d4f6f] uppercase tracking-wider">
                  <SortableHeader label="Buyer" sortKey="companyName" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} />
                  <SortableHeader label="Total Parcels" sortKey="totalParcels" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="center" />
                  <SortableHeader label="Sales" sortKey="totalSales" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="right" />
                  <SortableHeader label="Paid" sortKey="totalPaid" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="right" />
                  <SortableHeader label="Outstanding" sortKey="outstanding" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="right" />
                  <SortableHeader label="Days Overdue" sortKey="daysOverdue" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="right" />
                  <SortableHeader label="Risk" sortKey="riskScore" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="center" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="py-3 px-4"><div className="h-4 bg-[#e8e0d4] rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : (
                  table.filteredData?.map((item: any) => (
                    <tr key={item.buyerId} className="border-b border-[#f5f0e8] hover:bg-[#f5f0e8]/50">
                      <td className="py-3 px-4 text-sm font-medium text-[#1e2a4a]">{item.companyName}</td>
                      <td className="py-3 px-4 text-sm font-bold text-center text-orange-700 font-mono">{item.totalParcels || 0}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono">₹ {item.totalSales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono">₹ {item.totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono font-semibold text-red-600">
                        ₹ {item.outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-sm text-right font-mono">
                        {item.daysOverdue > 0 ? <span className="text-red-600">{item.daysOverdue} days</span> : <span className="text-green-600">On time</span>}
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
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Buyer Statement Report ──────────────────────────────
function BuyerStatementReport() {
  const [selectedBuyerId, setSelectedBuyerId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: buyersList } = trpc.buyer.list.useQuery({});
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

  const exportPDF = () => {
    if (!statement) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const totalDebit = statement.items.reduce((sum: number, item: any) => sum + item.debit, 0);
    const totalCredit = statement.items.reduce((sum: number, item: any) => sum + item.credit, 0);

    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Statement - ${statement.buyer.companyName}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
        h1 { font-size: 18px; }
        .subtitle { font-size: 12px; color: #666; margin-bottom: 15px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
        th { background: #f5f5f5; font-weight: bold; }
        .num { text-align: right; font-family: monospace; }
        .summary { margin-top: 15px; font-size: 12px; }
      </style></head>
      <body>
        <h1>Buyer Statement: ${statement.buyer.companyName}</h1>
        <div class="subtitle">${statement.buyer.contactPerson || ""} | ${statement.buyer.phone || ""}<br/>Generated: ${new Date().toLocaleDateString("en-IN")}</div>
        <table>
          <thead><tr><th>Date</th><th>Description</th><th>Book</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Balance</th></tr></thead>
          <tbody>
            ${statement.items.map((item: any) => `
              <tr>
                <td>${new Date(item.date).toLocaleDateString("en-IN")}</td>
                <td>${item.description}</td>
                <td>${item.bookType}</td>
                <td class="num">${item.debit ? "₹ " + item.debit.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : ""}</td>
                <td class="num">${item.credit ? "₹ " + item.credit.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : ""}</td>
                <td class="num">₹ ${item.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <div class="summary">
          <strong>Total Debit:</strong> ₹ ${totalDebit.toLocaleString("en-IN", { minimumFractionDigits: 2 })} |
          <strong>Total Credit:</strong> ₹ ${totalCredit.toLocaleString("en-IN", { minimumFractionDigits: 2 })} |
          <strong>Closing Balance:</strong> ₹ ${statement.closingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </div>
      </body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 200);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs text-[#3d4f6f]">Buyer</Label>
          <select
            value={selectedBuyerId || ""}
            onChange={(e) => setSelectedBuyerId(Number(e.target.value) || null)}
            className="px-3 py-2 rounded-md border border-[#d9cfc0] bg-white text-sm min-w-[200px]"
          >
            <option value="">Select buyer...</option>
            {buyersList?.items?.map((b: any) => (
              <option key={b.id} value={b.id}>{b.companyName}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-[#3d4f6f]">From</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40 bg-white border-[#d9cfc0]" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-[#3d4f6f]">To</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40 bg-white border-[#d9cfc0]" />
        </div>
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!statement} className="border-[#d9cfc0] text-xs">
            <Download className="w-3 h-3 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF} disabled={!statement} className="border-[#d9cfc0] text-xs">
            <FileText className="w-3 h-3 mr-1" /> PDF
          </Button>
        </div>
      </div>

      {statement && (
        <Card className="border-[#d9cfc0] bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-[#1e2a4a]">{statement.buyer.companyName}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#f5f0e8] border-b border-[#e8e0d4] text-xs text-[#3d4f6f] uppercase">
                    <th className="py-3 px-4 text-left font-semibold">Date</th>
                    <th className="py-3 px-4 text-left font-semibold">Description</th>
                    <th className="py-3 px-4 text-center font-semibold">Book</th>
                    <th className="py-3 px-4 text-right font-semibold">Debit</th>
                    <th className="py-3 px-4 text-right font-semibold">Credit</th>
                    <th className="py-3 px-4 text-right font-semibold">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.items.map((item: any) => (
                    <tr key={item.id} className="border-b border-[#f5f0e8]">
                      <td className="py-3 px-4 text-sm font-mono">{new Date(item.date).toLocaleDateString("en-IN")}</td>
                      <td className="py-3 px-4 text-sm text-[#1e2a4a]">{item.description}</td>
                      <td className="py-3 px-4 text-center"><span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">{item.bookType}</span></td>
                      <td className="py-3 px-4 text-sm text-right font-mono text-red-600">{item.debit ? `₹ ${item.debit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "-"}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono text-green-600">{item.credit ? `₹ ${item.credit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "-"}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono font-semibold">₹ {item.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Trouser Movement Report ─────────────────────────────
function TrouserMovementReport() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [bookType, setBookType] = useState<"ALL" | "CC" | "CS">("ALL");
  const [groupBy, setGroupBy] = useState<"Day" | "Week" | "Month" | "Buyer">("Day");

  const { data, isLoading } = trpc.report.trouserMovement.useQuery(
    {
      startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      endDate: endDate || new Date().toISOString().split("T")[0],
      bookType,
      groupBy,
    },
    { enabled: true }
  );

  const exportCSV = () => {
    if (!data?.items) return;
    const headers = groupBy === "Buyer" ? ["Buyer", "CC Qty", "CS Qty", "Total", "Cumulative"] : ["Date", "CC Qty", "CS Qty", "Total", "Cumulative"];
    const rows = data.items.map((item: any) => groupBy === "Buyer"
      ? [item.buyer, item.ccQuantity, item.csQuantity, item.total, item.cumulative]
      : [item.date, item.ccQuantity, item.csQuantity, item.total, item.cumulative]
    );
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trouser-movement-${groupBy.toLowerCase()}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-[#e8e0d4] rounded-full p-1">
          {(["ALL", "CC", "CS"] as const).map((type) => (
            <button key={type} onClick={() => setBookType(type)} className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${bookType === type ? "bg-white text-[#1e2a4a] shadow-sm" : "text-[#3d4f6f]"}`}>
              {type === "ALL" ? "All" : type}
            </button>
          ))}
        </div>
        <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as any)} className="px-3 py-1.5 rounded-md border border-[#d9cfc0] bg-white text-sm">
          {(["Day", "Week", "Month", "Buyer"] as const).map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36 bg-white border-[#d9cfc0] text-sm" />
        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36 bg-white border-[#d9cfc0] text-sm" />
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={!data?.items} className="border-[#d9cfc0] text-xs ml-auto">
          <Download className="w-3 h-3 mr-1" /> CSV
        </Button>
      </div>

      {data?.summary && (
        <div className="grid grid-cols-4 gap-4">
          <Card className="border-[#d9cfc0] bg-white"><CardContent className="p-4">
            <p className="text-xs text-[#3d4f6f] uppercase">Total Pieces</p>
            <p className="text-xl font-semibold font-mono">{data.summary.totalPieces.toLocaleString("en-IN")}</p>
          </CardContent></Card>
          <Card className="border-[#d9cfc0] bg-white"><CardContent className="p-4">
            <p className="text-xs text-[#3d4f6f] uppercase">Avg per Day</p>
            <p className="text-xl font-semibold font-mono">{data.summary.averagePerDay}</p>
          </CardContent></Card>
          <Card className="border-[#d9cfc0] bg-white"><CardContent className="p-4">
            <p className="text-xs text-[#3d4f6f] uppercase">Peak</p>
            <p className="text-sm font-semibold">{data.summary.peakDay}</p>
          </CardContent></Card>
          <Card className="border-[#d9cfc0] bg-white"><CardContent className="p-4">
            <p className="text-xs text-[#3d4f6f] uppercase">Peak Count</p>
            <p className="text-xl font-semibold font-mono">{data.summary.peakCount.toLocaleString("en-IN")}</p>
          </CardContent></Card>
        </div>
      )}

      {data?.items && data.items.length > 0 && (
        <Card className="border-[#d9cfc0] bg-white p-4">
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={data.items}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e0d4" />
              <XAxis dataKey={groupBy === "Buyer" ? "buyer" : "date"} tick={{ fontSize: 11, fill: "#3d4f6f" }} />
              <YAxis tick={{ fontSize: 11, fill: "#3d4f6f" }} />
              <Tooltip contentStyle={{ backgroundColor: "white", border: "1px solid #d9cfc0", borderRadius: "8px", fontSize: "12px" }} />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Bar dataKey="ccQuantity" name="CC" fill="#3b82f6" radius={[2, 2, 0, 0]} />
              <Bar dataKey="csQuantity" name="CS" fill="#22c55e" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card className="border-[#d9cfc0] bg-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f5f0e8] border-b border-[#e8e0d4] text-xs text-[#3d4f6f] uppercase">
                  <th className="py-3 px-4 text-left font-semibold">{groupBy === "Buyer" ? "Buyer" : "Date"}</th>
                  <th className="py-3 px-4 text-right font-semibold">CC Qty</th>
                  <th className="py-3 px-4 text-right font-semibold">CS Qty</th>
                  <th className="py-3 px-4 text-right font-semibold">Total</th>
                  <th className="py-3 px-4 text-right font-semibold">Cumulative</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? Array.from({ length: 5 }).map((_, i) => <tr key={i}>{Array.from({ length: 5 }).map((_, j) => <td key={j} className="py-3 px-4"><div className="h-4 bg-[#e8e0d4] rounded animate-pulse" /></td>)}</tr>) :
                  data?.items?.map((item: any, i: number) => (
                    <tr key={i} className="border-b border-[#f5f0e8] hover:bg-[#f5f0e8]/50">
                      <td className="py-3 px-4 text-sm text-[#1e2a4a]">{groupBy === "Buyer" ? item.buyer : new Date(item.date).toLocaleDateString("en-IN")}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono">{item.ccQuantity.toLocaleString("en-IN")}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono">{item.csQuantity.toLocaleString("en-IN")}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono font-semibold">{item.total.toLocaleString("en-IN")}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono text-[#3d4f6f]">{item.cumulative.toLocaleString("en-IN")}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sales (Monthly / Weekly) Report ─────────────────────
function SalesReport() {
  const [period, setPeriod] = useState<"Monthly" | "Weekly">("Monthly");
  const [paymentType, setPaymentType] = useState<"ALL" | "CC" | "CS">("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [buyerId, setBuyerId] = useState<number | null>(null);

  const { data: buyersList } = trpc.buyer.list.useQuery({});
  const { data: salesData, isLoading } = trpc.report.salesPeriod.useQuery(
    {
      period,
      paymentType: paymentType as any,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      buyerId: buyerId || undefined,
    },
    { enabled: true }
  );

  const table = useTableState({
    data: (salesData?.items as any[]) || [],
    searchFields: ["period"],
    defaultSortKey: "period",
    defaultSortDirection: "desc",
  });

  const exportCSV = () => {
    if (!salesData?.items) return;
    const headers = ["Period", "CC Sales", "CS Sales", "Total Sales", "Payments", "Net"];
    const rows = salesData.items.map((item: any) => [
      item.period,
      item.ccSales,
      item.csSales,
      item.totalSales,
      item.totalPayments,
      item.netAmount,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-${period.toLowerCase()}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex items-center gap-2 bg-[#e8e0d4] rounded-full p-1">
          {(["Monthly", "Weekly"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                period === p ? "bg-white text-[#1e2a4a] shadow-sm" : "text-[#3d4f6f]"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 bg-[#e8e0d4] rounded-full p-1">
          {(["ALL", "CC", "CS"] as const).map((pt) => (
            <button
              key={pt}
              onClick={() => setPaymentType(pt)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                paymentType === pt ? "bg-white text-[#1e2a4a] shadow-sm" : "text-[#3d4f6f]"
              }`}
            >
              {pt === "ALL" ? "All" : pt}
            </button>
          ))}
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-[#3d4f6f]">From</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36 bg-white border-[#d9cfc0] text-sm h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-[#3d4f6f]">To</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36 bg-white border-[#d9cfc0] text-sm h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-[#3d4f6f]">Buyer</Label>
          <select value={buyerId || ""} onChange={(e) => setBuyerId(Number(e.target.value) || null)} className="px-3 py-1.5 rounded-md border border-[#d9cfc0] bg-white text-sm h-8 min-w-[160px]">
            <option value="">All Buyers</option>
            {buyersList?.items?.map((b: any) => (
              <option key={b.id} value={b.id}>{b.companyName}</option>
            ))}
          </select>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={!salesData?.items?.length} className="border-[#d9cfc0] text-xs ml-auto">
          <Download className="w-3 h-3 mr-1" /> CSV
        </Button>
      </div>

      {/* Summary Cards */}
      {salesData?.summary && (
        <div className="grid grid-cols-4 gap-4">
          <Card className="border-[#d9cfc0] bg-white"><CardContent className="p-4">
            <p className="text-xs text-[#3d4f6f] uppercase">Total Sales</p>
            <p className="text-xl font-semibold font-mono text-[#c4703f]">
              ₹ {salesData.summary.totalSales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </CardContent></Card>
          <Card className="border-[#d9cfc0] bg-white"><CardContent className="p-4">
            <p className="text-xs text-[#3d4f6f] uppercase">Total Payments</p>
            <p className="text-xl font-semibold font-mono text-green-600">
              ₹ {salesData.summary.totalPayments.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </CardContent></Card>
          <Card className="border-[#d9cfc0] bg-white"><CardContent className="p-4">
            <p className="text-xs text-[#3d4f6f] uppercase">Net Amount</p>
            <p className="text-xl font-semibold font-mono text-[#1e2a4a]">
              ₹ {salesData.summary.netAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </CardContent></Card>
          <Card className="border-[#d9cfc0] bg-white"><CardContent className="p-4">
            <p className="text-xs text-[#3d4f6f] uppercase">Periods</p>
            <p className="text-xl font-semibold font-mono">{salesData.summary.periodCount}</p>
          </CardContent></Card>
        </div>
      )}

      {/* Chart */}
      {salesData?.items && salesData.items.length > 0 && (
        <Card className="border-[#d9cfc0] bg-white p-4">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={salesData.items}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e0d4" />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#3d4f6f" }} />
              <YAxis tick={{ fontSize: 11, fill: "#3d4f6f" }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(value: number) => [`₹ ${value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, ""]} contentStyle={{ backgroundColor: "white", border: "1px solid #d9cfc0", borderRadius: "8px", fontSize: "12px" }} />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Bar dataKey="totalSales" name="Sales" fill="#c4703f" radius={[2, 2, 0, 0]} />
              <Bar dataKey="totalPayments" name="Payments" fill="#4a9b6b" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Table */}
      <Card className="border-[#d9cfc0] bg-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f5f0e8] border-b border-[#e8e0d4] text-xs text-[#3d4f6f] uppercase">
                  <SortableHeader label="Period" sortKey="period" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} />
                  <SortableHeader label="CC Sales" sortKey="ccSales" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="right" />
                  <SortableHeader label="CS Sales" sortKey="csSales" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="right" />
                  <SortableHeader label="Total Sales" sortKey="totalSales" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="right" />
                  <SortableHeader label="Payments" sortKey="totalPayments" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="right" />
                  <SortableHeader label="Net" sortKey="netAmount" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? Array.from({ length: 5 }).map((_, i) => <tr key={i}>{Array.from({ length: 6 }).map((_, j) => <td key={j} className="py-3 px-4"><div className="h-4 bg-[#e8e0d4] rounded animate-pulse" /></td>)}</tr>) :
                  table.filteredData?.map((item: any, i: number) => (
                    <tr key={i} className="border-b border-[#f5f0e8] hover:bg-[#f5f0e8]/50">
                      <td className="py-3 px-4 text-sm font-medium text-[#1e2a4a]">{item.period}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono">₹ {item.ccSales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono">₹ {item.csSales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono font-semibold text-[#c4703f]">₹ {item.totalSales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono text-green-600">₹ {item.totalPayments.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono font-semibold">₹ {item.netAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))
                }
                {!isLoading && table.filteredData?.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-sm text-[#3d4f6f]">No sales data found for the selected filters</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Label component (local to this file)
function Label({ children, className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={`text-sm font-medium ${className}`} {...props}>{children}</label>;
}

// ─── Item Catalog Performance Report ─────────────────────
function ItemPerformanceReport() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data, isLoading } = trpc.report.itemPerformance.useQuery({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const table = useTableState({
    data: (data as any[]) || [],
    searchFields: ["name", "hsnCode"],
    defaultSortKey: "totalQty",
    defaultSortDirection: "desc",
  });

  const totalQuantity = table.filteredData?.reduce((sum: number, item: any) => sum + (item.totalQty || 0), 0) || 0;
  const totalRevenue = table.filteredData?.reduce((sum: number, item: any) => sum + (item.totalRevenue || 0), 0) || 0;

  const exportCSV = () => {
    if (!data) return;
    const headers = ["Item Name", "HSN Code", "Quantity Sold", "Gross Sales", "Discount", "Tax Amount", "Total Revenue"];
    const rows = table.filteredData.map((item: any) => [
      item.name,
      item.hsnCode,
      item.totalQty,
      item.totalSales,
      item.totalDiscount,
      item.totalTax,
      item.totalRevenue,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `item-performance-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs text-[#3d4f6f]">From Date</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40 bg-white border-[#d9cfc0] text-sm h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-[#3d4f6f]">To Date</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40 bg-white border-[#d9cfc0] text-sm h-8" />
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={!data?.length} className="border-[#d9cfc0] text-xs ml-auto">
          <Download className="w-3 h-3 mr-1" /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="border-[#d9cfc0] bg-white">
          <CardContent className="p-4">
            <p className="text-xs text-[#3d4f6f] uppercase">Total Quantity Sold</p>
            <p className="text-2xl font-semibold font-mono text-[#1e2a4a] mt-1">{totalQuantity.toLocaleString("en-IN")} Pcs.</p>
          </CardContent>
        </Card>
        <Card className="border-[#d9cfc0] bg-white">
          <CardContent className="p-4">
            <p className="text-xs text-[#3d4f6f] uppercase">Total Revenue Generated</p>
            <p className="text-2xl font-semibold font-mono text-green-600 mt-1">₹ {totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card className="border-[#d9cfc0] bg-white">
          <CardContent className="p-4">
            <p className="text-xs text-[#3d4f6f] uppercase">Unique Products Sold</p>
            <p className="text-2xl font-semibold font-mono text-[#c4703f] mt-1">{table.filteredData?.filter((i: any) => i.totalQty > 0).length || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {table.filteredData && table.filteredData.length > 0 && (
        <Card className="border-[#d9cfc0] bg-white p-4">
          <div className="text-sm font-semibold text-[#1e2a4a] mb-2">Item Sales Chart (Quantity vs Revenue)</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={table.filteredData.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e0d4" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#3d4f6f" }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#3d4f6f" }} name="Qty" />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#3d4f6f" }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} name="Revenue" />
              <Tooltip formatter={(value: number, name: string) => [name === "totalRevenue" ? `₹ ${value.toLocaleString("en-IN")}` : value, name === "totalRevenue" ? "Revenue" : "Quantity Sold"]} contentStyle={{ backgroundColor: "white", border: "1px solid #d9cfc0", borderRadius: "8px", fontSize: "12px" }} />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Bar yAxisId="left" dataKey="totalQty" name="Qty Sold" fill="#c4703f" radius={[2, 2, 0, 0]} />
              <Bar yAxisId="right" dataKey="totalRevenue" name="Revenue" fill="#1e2a4a" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Table */}
      <Card className="border-[#d9cfc0] bg-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f5f0e8] border-b border-[#e8e0d4] text-xs text-[#3d4f6f] uppercase">
                  <SortableHeader label="Item Name" sortKey="name" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} />
                  <SortableHeader label="HSN" sortKey="hsnCode" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} />
                  <SortableHeader label="Qty Sold" sortKey="totalQty" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="right" />
                  <SortableHeader label="Gross Sales" sortKey="totalSales" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="right" />
                  <SortableHeader label="Discount" sortKey="totalDiscount" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="right" />
                  <SortableHeader label="Tax" sortKey="totalTax" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="right" />
                  <SortableHeader label="Total Revenue" sortKey="totalRevenue" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? Array.from({ length: 5 }).map((_, i) => <tr key={i}>{Array.from({ length: 7 }).map((_, j) => <td key={j} className="py-3 px-4"><div className="h-4 bg-[#e8e0d4] rounded animate-pulse" /></td>)}</tr>) :
                  table.filteredData?.map((item: any, i: number) => (
                    <tr key={i} className="border-b border-[#f5f0e8] hover:bg-[#f5f0e8]/50">
                      <td className="py-3 px-4 text-sm font-medium text-[#1e2a4a]">{item.name}</td>
                      <td className="py-3 px-4 text-sm font-mono text-[#3d4f6f]">{item.hsnCode}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono font-semibold">{item.totalQty.toLocaleString("en-IN")}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono">₹ {item.totalSales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono text-red-600">₹ {item.totalDiscount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono text-[#3d4f6f]">₹ {item.totalTax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono font-semibold text-green-600">₹ {item.totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))
                }
                {!isLoading && table.filteredData?.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-sm text-[#3d4f6f]">No product sales performance data available</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── GST / Tax Summary Report ─────────────────────────────
function GstTaxSummaryReport() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data, isLoading } = trpc.report.gstTaxReport.useQuery({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const table = useTableState({
    data: (data as any[]) || [],
    searchFields: ["period"],
    defaultSortKey: "monthKey",
    defaultSortDirection: "desc",
  });

  const totalTaxable = table.filteredData?.reduce((sum: number, item: any) => sum + (item.taxableAmount || 0), 0) || 0;
  const totalCgst = table.filteredData?.reduce((sum: number, item: any) => sum + (item.cgst || 0), 0) || 0;
  const totalSgst = table.filteredData?.reduce((sum: number, item: any) => sum + (item.sgst || 0), 0) || 0;
  const totalIgst = table.filteredData?.reduce((sum: number, item: any) => sum + (item.igst || 0), 0) || 0;
  const totalTaxAmount = table.filteredData?.reduce((sum: number, item: any) => sum + (item.totalTax || 0), 0) || 0;

  const exportCSV = () => {
    if (!data) return;
    const headers = ["Period/Month", "Invoice Count", "Taxable Value", "CGST", "SGST", "IGST", "Total GST Collected", "Total Invoice Value"];
    const rows = table.filteredData.map((item: any) => [
      item.period,
      item.billCount,
      item.taxableAmount,
      item.cgst,
      item.sgst,
      item.igst,
      item.totalTax,
      item.totalAmount,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gst-tax-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs text-[#3d4f6f]">From Date</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40 bg-white border-[#d9cfc0] text-sm h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-[#3d4f6f]">To Date</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40 bg-white border-[#d9cfc0] text-sm h-8" />
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={!data?.length} className="border-[#d9cfc0] text-xs ml-auto">
          <Download className="w-3 h-3 mr-1" /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-5 gap-3">
        <Card className="border-[#d9cfc0] bg-white"><CardContent className="p-3">
          <p className="text-[10px] text-[#3d4f6f] uppercase">Taxable Value</p>
          <p className="text-lg font-semibold font-mono text-[#1e2a4a] mt-1">₹{totalTaxable.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
        </CardContent></Card>
        <Card className="border-[#d9cfc0] bg-white"><CardContent className="p-3">
          <p className="text-[10px] text-[#3d4f6f] uppercase">CGST Collected</p>
          <p className="text-lg font-semibold font-mono text-[#c4703f] mt-1">₹{totalCgst.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
        </CardContent></Card>
        <Card className="border-[#d9cfc0] bg-white"><CardContent className="p-3">
          <p className="text-[10px] text-[#3d4f6f] uppercase">SGST Collected</p>
          <p className="text-lg font-semibold font-mono text-[#c4703f] mt-1">₹{totalSgst.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
        </CardContent></Card>
        <Card className="border-[#d9cfc0] bg-white"><CardContent className="p-3">
          <p className="text-[10px] text-[#3d4f6f] uppercase">IGST Collected</p>
          <p className="text-lg font-semibold font-mono text-[#c4703f] mt-1">₹{totalIgst.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
        </CardContent></Card>
        <Card className="border-[#d9cfc0] bg-white bg-green-50/50 border-green-200"><CardContent className="p-3">
          <p className="text-[10px] text-green-800 uppercase font-medium">Total GST (C+S+I)</p>
          <p className="text-lg font-bold font-mono text-green-700 mt-1">₹{totalTaxAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
        </CardContent></Card>
      </div>

      {/* Table */}
      <Card className="border-[#d9cfc0] bg-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f5f0e8] border-b border-[#e8e0d4] text-xs text-[#3d4f6f] uppercase">
                  <SortableHeader label="Month" sortKey="monthKey" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} />
                  <SortableHeader label="Invoices" sortKey="billCount" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="center" />
                  <SortableHeader label="Taxable Value" sortKey="taxableAmount" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="right" />
                  <SortableHeader label="CGST (₹)" sortKey="cgst" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="right" />
                  <SortableHeader label="SGST (₹)" sortKey="sgst" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="right" />
                  <SortableHeader label="IGST (₹)" sortKey="igst" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="right" />
                  <SortableHeader label="Total GST (₹)" sortKey="totalTax" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="right" />
                  <SortableHeader label="Total Amount (₹)" sortKey="totalAmount" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? Array.from({ length: 5 }).map((_, i) => <tr key={i}>{Array.from({ length: 8 }).map((_, j) => <td key={j} className="py-3 px-4"><div className="h-4 bg-[#e8e0d4] rounded animate-pulse" /></td>)}</tr>) :
                  table.filteredData?.map((item: any, i: number) => (
                    <tr key={i} className="border-b border-[#f5f0e8] hover:bg-[#f5f0e8]/50">
                      <td className="py-3 px-4 text-sm font-medium text-[#1e2a4a]">{item.period}</td>
                      <td className="py-3 px-4 text-sm text-center font-mono">{item.billCount}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono">₹ {item.taxableAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono text-[#c4703f]">₹ {item.cgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono text-[#c4703f]">₹ {item.sgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono text-[#c4703f]">₹ {item.igst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono font-semibold text-green-700">₹ {item.totalTax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono font-semibold text-[#1e2a4a]">₹ {item.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))
                }
                {!isLoading && table.filteredData?.length === 0 && (
                  <tr><td colSpan={8} className="py-8 text-center text-sm text-[#3d4f6f]">No GST collection data found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Transport Performance Report ──────────────────────────
function TransportPerformanceReport() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data, isLoading } = trpc.report.transportPerformance.useQuery({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const table = useTableState({
    data: (data as any[]) || [],
    searchFields: ["name", "vehicleNumber"],
    defaultSortKey: "totalShipments",
    defaultSortDirection: "desc",
  });

  const totalShipments = table.filteredData?.reduce((sum: number, item: any) => sum + (item.totalShipments || 0), 0) || 0;
  const totalValue = table.filteredData?.reduce((sum: number, item: any) => sum + (item.totalGoodsValue || 0), 0) || 0;
  const totalParcels = table.filteredData?.reduce((sum: number, item: any) => sum + (item.totalParcels || 0), 0) || 0;

  const exportCSV = () => {
    if (!data) return;
    const headers = ["Transport Partner", "Vehicle No", "Contact Phone", "Total Shipments Handled", "Total Parcels", "Taxable Cargo Value", "Total Cargo Value"];
    const rows = table.filteredData.map((item: any) => [
      item.name,
      item.vehicleNumber,
      item.contactPhone,
      item.totalShipments,
      item.totalParcels || 0,
      item.totalTaxable,
      item.totalGoodsValue,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transport-performance-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs text-[#3d4f6f]">From Date</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40 bg-white border-[#d9cfc0] text-sm h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-[#3d4f6f]">To Date</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40 bg-white border-[#d9cfc0] text-sm h-8" />
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={!data?.length} className="border-[#d9cfc0] text-xs ml-auto">
          <Download className="w-3 h-3 mr-1" /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="border-[#d9cfc0] bg-white">
          <CardContent className="p-4">
            <p className="text-xs text-[#3d4f6f] uppercase">Total Active Cargo Value</p>
            <p className="text-xl font-bold font-mono text-green-700 mt-1">₹ {totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card className="border-[#d9cfc0] bg-white">
          <CardContent className="p-4">
            <p className="text-xs text-[#3d4f6f] uppercase">Total Shipments Handled</p>
            <p className="text-xl font-bold font-mono text-[#c4703f] mt-1">{totalShipments}</p>
          </CardContent>
        </Card>
        <Card className="border-[#d9cfc0] bg-white">
          <CardContent className="p-4">
            <p className="text-xs text-[#3d4f6f] uppercase">Total Parcels Transported</p>
            <p className="text-xl font-bold font-mono text-orange-700 mt-1">{totalParcels}</p>
          </CardContent>
        </Card>
        <Card className="border-[#d9cfc0] bg-white">
          <CardContent className="p-4">
            <p className="text-xs text-[#3d4f6f] uppercase">Transport Partners Evaluated</p>
            <p className="text-xl font-bold font-mono text-[#1e2a4a] mt-1">{table.filteredData?.length || 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#d9cfc0] bg-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f5f0e8] border-b border-[#e8e0d4] text-xs text-[#3d4f6f] uppercase font-semibold">
                  <SortableHeader label="Transport Partner" sortKey="name" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} />
                  <SortableHeader label="Vehicle Number" sortKey="vehicleNumber" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="center" />
                  <SortableHeader label="Contact Phone" sortKey="contactPhone" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="center" />
                  <SortableHeader label="Shipments Handled" sortKey="totalShipments" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="center" />
                  <SortableHeader label="Total Parcels" sortKey="totalParcels" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="center" />
                  <SortableHeader label="Taxable Cargo Value" sortKey="totalTaxable" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="right" />
                  <SortableHeader label="Total Cargo Value" sortKey="totalGoodsValue" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? Array.from({ length: 3 }).map((_, i) => <tr key={i}>{Array.from({ length: 7 }).map((_, j) => <td key={j} className="py-3 px-4"><div className="h-4 bg-[#e8e0d4] rounded animate-pulse" /></td>)}</tr>) :
                  table.filteredData?.map((item: any, i: number) => (
                    <tr key={i} className="border-b border-[#f5f0e8] hover:bg-[#f5f0e8]/50">
                      <td className="py-3 px-4 text-sm font-medium text-[#1e2a4a]">{item.name}</td>
                      <td className="py-3 px-4 text-sm font-mono text-center">{item.vehicleNumber}</td>
                      <td className="py-3 px-4 text-sm font-mono text-center">{item.contactPhone}</td>
                      <td className="py-3 px-4 text-sm font-mono text-center font-semibold text-[#c4703f]">{item.totalShipments}</td>
                      <td className="py-3 px-4 text-sm font-mono text-center font-bold text-orange-700">{item.totalParcels || 0}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono">₹ {item.totalTaxable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono font-semibold text-green-700">₹ {item.totalGoodsValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))
                }
                {!isLoading && table.filteredData?.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-sm text-[#3d4f6f]">No transport shipment performance metrics found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
