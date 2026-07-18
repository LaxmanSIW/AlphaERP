import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  FileText,
  Shield,
  ChevronLeft,
  ChevronRight,
  Download,
  X,
  } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/providers/trpc";
import { useToast } from "@/hooks/use-toast";
import { useTableState } from "@/hooks/useTableState";
import { SortableHeader } from "@/components/SortableHeader";

interface BuyerFormData {
  companyName: string;
  contactPerson: string;
  phone: string;
  gstNumber: string;
  creditLimit: number;
  address: string;
  city: string;
  state: string;
  stateCode: string;
  defaultTransportId: number | null;
  defaultTransportName: string | null;
}

const emptyForm: BuyerFormData = {
  companyName: "",
  contactPerson: "",
  phone: "",
  gstNumber: "",
  creditLimit: 100000,
  address: "",
  city: "",
  state: "",
  stateCode: "",
  defaultTransportId: null,
  defaultTransportName: null,
};

function RiskBadge({ score, level }: { score: number; level: string }) {
  const getColors = () => {
    if (score <= 3) return "bg-red-500 text-white";
    if (score <= 7) return "bg-yellow-500 text-white";
    return "bg-green-500 text-white";
  };

  return (
    <div className="flex items-center justify-center gap-1.5">
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold font-mono ${getColors()}`}>
        {score}
      </span>
      {level === "Low" && <Shield className="w-4 h-4 text-green-500" />}
    </div>
  );
}

export default function Buyers() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<BuyerFormData>({ ...emptyForm });
  const [statementOpen, setStatementOpen] = useState(false);
  const [statementBuyerId, setStatementBuyerId] = useState<number | null>(null);
  const [panelWidth, setPanelWidth] = useState(600);
  
  
  
  const isResizing = useRef(false);

  const utils = trpc.useUtils();

  const { data: apiData, isLoading } = trpc.buyer.list.useQuery({});

  const { data: transportsData } = trpc.transport.list.useQuery();
  const transports = transportsData?.transports || [];

  const { data: riskData } = trpc.buyer.riskAnalysis.useQuery({});

  const table = useTableState({
    data: (apiData?.items as any[]) || [],
    searchFields: ["companyName", "contactPerson", "phone", "gstNumber", "city", "state"],
    defaultSortKey: "companyName",
    defaultSortDirection: "asc",
  });

  const createMutation = trpc.buyer.create.useMutation({
    onSuccess: () => {
      utils.buyer.list.invalidate();
      toast({ title: "Success", description: "Buyer created successfully" });
      setModalOpen(false);
      setForm({ ...emptyForm });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = trpc.buyer.update.useMutation({
    onSuccess: () => {
      utils.buyer.list.invalidate();
      toast({ title: "Success", description: "Buyer updated successfully" });
      setModalOpen(false);
      setEditingId(null);
      setForm({ ...emptyForm });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = trpc.buyer.delete.useMutation({
    onSuccess: () => {
      utils.buyer.list.invalidate();
      toast({ title: "Success", description: "Buyer deleted successfully" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });


  const openEdit = (buyer: any) => {
    setEditingId(buyer.id);
    setForm({
      companyName: buyer.companyName,
      contactPerson: buyer.contactPerson || "",
      phone: buyer.phone || "",
      gstNumber: buyer.gstNumber || "",
      creditLimit: parseFloat(buyer.creditLimit as string) || 0,
      address: buyer.address || "",
      city: buyer.city || "",
      state: buyer.state || "",
      stateCode: buyer.stateCode || "",
      defaultTransportId: buyer.defaultTransportId || null,
      defaultTransportName: buyer.defaultTransportName || null,
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.companyName) {
      toast({ title: "Validation Error", description: "Company name is required", variant: "destructive" });
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const viewStatement = (buyerId: number) => {
    setStatementBuyerId(buyerId);
    setStatementOpen(true);
  };

  // Resizable panel handlers
  const handleResizeStart = useCallback(() => {
    isResizing.current = true;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = window.innerWidth - e.clientX;
      setPanelWidth(Math.max(400, Math.min(900, newWidth)));
    };
    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // Pre-select buyer from URL param
  useEffect(() => {
    const buyerId = searchParams.get("id");
    if (buyerId) {
      viewStatement(Number(buyerId));
      searchParams.delete("id");
      setSearchParams(searchParams);
    }
  }, [searchParams]);

  // Bulk upload parsing
  ;

  const formatCurrency = (amount: string | number) => {
    const val = typeof amount === "string" ? parseFloat(amount) : amount;
    return `₹ ${val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1e2a4a]">Buyers</h1>
          <p className="text-sm text-[#3d4f6f] mt-1">Manage buyer accounts</p>
        </div>
        <div className="flex items-center gap-2">
          
          <Button
            onClick={() => {
              setEditingId(null);
              setForm({ ...emptyForm });
              setModalOpen(true);
            }}
            className="bg-[#c4703f] hover:bg-[#a85d32] text-white"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Buyer
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-[400px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#3d4f6f]" />
        <Input
          placeholder="Search buyers (name, contact, phone, GST, city, state)..."
          value={table.search}
          onChange={(e) => table.setSearch(e.target.value)}
          className="pl-9 bg-white border-[#d9cfc0]"
        />
      </div>

      {/* Search info */}
      {table.isSearchActive && (
        <div className="text-sm text-[#3d4f6f] bg-blue-50 px-3 py-2 rounded-md">
          Showing {table.totalFiltered} matching results (search active — no pagination)
        </div>
      )}

      {/* Table */}
      <Card className="border-[#d9cfc0] bg-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f5f0e8] border-b border-[#e8e0d4] text-xs text-[#3d4f6f] uppercase tracking-wider">
                  <SortableHeader label="ID" sortKey="id" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} className="w-14" />
                  <SortableHeader label="Company" sortKey="companyName" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} />
                  <SortableHeader label="Contact" sortKey="contactPerson" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} />
                  <SortableHeader label="Phone" sortKey="phone" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} />
                  <SortableHeader label="GST" sortKey="gstNumber" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} />
                  <SortableHeader label="City" sortKey="city" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} />
                  <SortableHeader label="State" sortKey="state" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} />
                  <SortableHeader label="Credit Limit" sortKey="creditLimit" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="right" />
                  <SortableHeader label="Outstanding" sortKey="outstanding" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="right" />
                  <SortableHeader label="Total Parcels" sortKey="totalParcels" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="center" className="w-24" />
                  <SortableHeader label="Risk" sortKey="riskScore" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="center" className="w-24" />
                  <th className="py-3 px-4 font-semibold text-center w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-[#f5f0e8]">
                      {Array.from({ length: 12 }).map((_, j) => (
                        <td key={j} className="py-3 px-4">
                          <div className="h-4 bg-[#e8e0d4] rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  table.filteredData.map((buyer: any) => {
                    const risk = riskData?.find((r: any) => r.buyer.id === buyer.id);
                    return (
                      <tr key={buyer.id} className="border-b border-[#f5f0e8] hover:bg-[#f5f0e8]/50 transition-colors">
                        <td className="py-3 px-4 text-sm font-mono text-[#3d4f6f]">#{buyer.id}</td>
                        <td className="py-3 px-4 text-sm font-medium text-[#1e2a4a]">{buyer.companyName}</td>
                        <td className="py-3 px-4 text-sm text-[#3d4f6f]">{buyer.contactPerson || "-"}</td>
                        <td className="py-3 px-4 text-sm text-[#3d4f6f] font-mono">{buyer.phone || "-"}</td>
                        <td className="py-3 px-4 text-sm text-[#3d4f6f] font-mono">{buyer.gstNumber || "-"}</td>
                        <td className="py-3 px-4 text-sm text-[#3d4f6f]">{buyer.city || "-"}</td>
                        <td className="py-3 px-4 text-sm text-[#3d4f6f]">{buyer.state || "-"}</td>
                        <td className="py-3 px-4 text-sm text-right font-mono">
                          {formatCurrency(buyer.creditLimit)}
                        </td>
                        <td className="py-3 px-4 text-sm text-right font-mono font-semibold text-red-600">
                          {formatCurrency((buyer as any).outstanding || 0)}
                        </td>
                        <td className="py-3 px-4 text-sm font-bold text-center text-orange-700 font-mono">
                          {buyer.totalParcels || 0}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {risk ? (
                            <RiskBadge score={risk.riskScore} level={risk.riskLevel} />
                          ) : (
                            <span className="text-xs text-[#3d4f6f]">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => viewStatement(buyer.id)} className="p-1.5 rounded hover:bg-blue-50 transition-colors" title="View Statement">
                              <FileText className="w-4 h-4 text-blue-500" />
                            </button>
                            <button onClick={() => openEdit(buyer)} className="p-1.5 rounded hover:bg-[#f5f0e8] transition-colors" title="Edit">
                              <Pencil className="w-4 h-4 text-[#3d4f6f]" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm("Delete this buyer? Only buyers with no transactions can be deleted.")) {
                                  deleteMutation.mutate({ id: buyer.id });
                                }
                              }}
                              className="p-1.5 rounded hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
                {!isLoading && table.filteredData.length === 0 && (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-sm text-[#3d4f6f]">
                      {table.search ? "No matching buyers found" : "No buyers found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination - only show when no search */}
          {!table.isSearchActive && table.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#e8e0d4]">
              <p className="text-sm text-[#3d4f6f]">
                Page {table.page} of {table.totalPages} ({apiData?.total || 0} total)
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => table.setPage(table.page - 1)} disabled={table.page <= 1} className="border-[#d9cfc0] h-8 w-8 p-0">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => table.setPage(table.page + 1)} disabled={table.page >= table.totalPages} className="border-[#d9cfc0] h-8 w-8 p-0">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg text-[#1e2a4a]">
                {editingId ? "Edit Buyer" : "Add Buyer"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label className="text-[#1e2a4a]">Company Name *</Label>
                <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="Enter company name" className="bg-[#f5f0e8] border-[#d9cfc0]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[#1e2a4a]">Contact Person</Label>
                  <Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} placeholder="Contact name" className="bg-[#f5f0e8] border-[#d9cfc0]" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#1e2a4a]">Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone number" className="bg-[#f5f0e8] border-[#d9cfc0] font-mono" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[#1e2a4a]">GST Number</Label>
                <Input value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} placeholder="15-character GSTIN" className="bg-[#f5f0e8] border-[#d9cfc0] font-mono" />
              </div>
              <div className="space-y-2">
                <Label className="text-[#1e2a4a]">Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street address" className="bg-[#f5f0e8] border-[#d9cfc0]" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-[#1e2a4a]">City</Label>
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" className="bg-[#f5f0e8] border-[#d9cfc0]" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#1e2a4a]">State</Label>
                  <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="State" className="bg-[#f5f0e8] border-[#d9cfc0]" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#1e2a4a]">State Code</Label>
                  <Input value={form.stateCode} onChange={(e) => setForm({ ...form, stateCode: e.target.value })} placeholder="Code" className="bg-[#f5f0e8] border-[#d9cfc0] font-mono" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[#1e2a4a]">Credit Limit (₹)</Label>
                <Input type="number" value={form.creditLimit || ""} onChange={(e) => setForm({ ...form, creditLimit: parseFloat(e.target.value) || 0 })} placeholder="0.00" className="bg-[#f5f0e8] border-[#d9cfc0] text-right font-mono" />
              </div>
              <div className="space-y-2">
                <Label className="text-[#1e2a4a]">Default Transport</Label>
                <Select
                  value={form.defaultTransportId ? String(form.defaultTransportId) : "NA"}
                  onValueChange={(val) => {
                    if (val === "NA") {
                      setForm({ ...form, defaultTransportId: null, defaultTransportName: "NA" });
                    } else {
                      const tId = Number(val);
                      const selectedTr = transports.find((t: any) => t.id === tId);
                      setForm({
                        ...form,
                        defaultTransportId: tId,
                        defaultTransportName: selectedTr ? selectedTr.name : "NA",
                      });
                    }
                  }}
                >
                  <SelectTrigger className="bg-[#f5f0e8] border-[#d9cfc0] w-full text-left">
                    <SelectValue placeholder="Select default transport" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="NA">NA (No Default Transport)</SelectItem>
                    {transports.map((t: any) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name} {t.vehicleNumber ? `(${t.vehicleNumber})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} className="flex-1 bg-[#c4703f] hover:bg-[#a85d32] text-white">
                  {editingId ? "Update" : "Save"}
                </Button>
                <Button variant="outline" onClick={() => { setModalOpen(false); setEditingId(null); }} className="border-[#d9cfc0]">Cancel</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Statement Side Panel */}
      {statementOpen && statementBuyerId && (
        <BuyerStatementPanel
          buyerId={statementBuyerId}
          onClose={() => setStatementOpen(false)}
          width={panelWidth}
          onResizeStart={handleResizeStart}
        />
      )}
    </div>
  );
}

// ─── Buyer Statement Panel (Resizable Side Panel) ───────────
function BuyerStatementPanel({
  buyerId,
  onClose,
  width,
  onResizeStart,
}: {
  buyerId: number;
  onClose: () => void;
  width: number;
  onResizeStart: () => void;
}) {
  const { data: statement } = trpc.buyer.statement.useQuery({ id: buyerId });

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
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `statement-${statement.buyer.companyName}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const exportPDF = () => {
    if (!statement) return;
    // Use browser print to PDF
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const totalDebit = statement.items.reduce((sum: number, item: any) => sum + item.debit, 0);
    const totalCredit = statement.items.reduce((sum: number, item: any) => sum + item.credit, 0);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Statement - ${statement.buyer.companyName}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
          h1 { font-size: 18px; margin-bottom: 5px; }
          .subtitle { font-size: 12px; color: #666; margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
          th { background: #f5f5f5; font-weight: bold; }
          .num { text-align: right; font-family: monospace; }
          .summary { margin-top: 15px; font-size: 12px; }
          .summary-item { display: inline-block; margin-right: 30px; }
        </style>
      </head>
      <body>
        <h1>Buyer Statement: ${statement.buyer.companyName}</h1>
        <div class="subtitle">
          ${statement.buyer.contactPerson || ""} | ${statement.buyer.phone || ""} | ${statement.buyer.gstNumber || ""}<br/>
          Generated: ${new Date().toLocaleDateString("en-IN")}
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Book</th>
              <th class="num">Debit</th>
              <th class="num">Credit</th>
              <th class="num">Balance</th>
            </tr>
          </thead>
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
          <div class="summary-item"><strong>Total Debit:</strong> ₹ ${totalDebit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
          <div class="summary-item"><strong>Total Credit:</strong> ₹ ${totalCredit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
          <div class="summary-item"><strong>Closing Balance:</strong> ₹ ${statement.closingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 200);
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Resizable panel */}
      <div
        className="fixed right-0 top-0 h-full bg-white shadow-2xl z-50 flex flex-col border-l border-[#d9cfc0]"
        style={{ width: `${width}px` }}
      >
        {/* Resize handle */}
        <div
          className="absolute left-0 top-0 w-2 h-full cursor-ew-resize hover:bg-[#c4703f]/20 z-10"
          onMouseDown={onResizeStart}
        />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e8e0d4] bg-[#f5f0e8]">
          <div>
            <h2 className="text-lg font-bold text-[#1e2a4a]">{statement?.buyer?.companyName || "Loading..."}</h2>
            <p className="text-xs text-[#3d4f6f]">
              {statement?.buyer?.contactPerson} {statement?.buyer?.phone && `| ${statement.buyer.phone}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV} className="border-[#d9cfc0] text-xs">
              <Download className="w-3 h-3 mr-1" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportPDF} className="border-[#d9cfc0] text-xs">
              <FileText className="w-3 h-3 mr-1" />
              PDF
            </Button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-[#e8e0d4] transition-colors">
              <X className="w-5 h-5 text-[#3d4f6f]" />
            </button>
          </div>
        </div>

        {/* Summary */}
        {statement && (
          <div className="grid grid-cols-3 gap-0 border-b border-[#e8e0d4]">
            <div className="px-4 py-3 border-r border-[#e8e0d4]">
              <p className="text-[10px] text-[#3d4f6f] uppercase">Total Debit</p>
              <p className="text-sm font-semibold font-mono text-red-600">
                ₹ {statement.items.reduce((s: number, i: any) => s + i.debit, 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="px-4 py-3 border-r border-[#e8e0d4]">
              <p className="text-[10px] text-[#3d4f6f] uppercase">Total Credit</p>
              <p className="text-sm font-semibold font-mono text-green-600">
                ₹ {statement.items.reduce((s: number, i: any) => s + i.credit, 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="px-4 py-3">
              <p className="text-[10px] text-[#3d4f6f] uppercase">Closing Balance</p>
              <p className="text-sm font-semibold font-mono text-[#1e2a4a]">
                ₹ {statement.closingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        )}

        {/* Statement Table */}
        <div className="flex-1 overflow-y-auto">
          {!statement ? (
            <div className="flex items-center justify-center h-32">
              <div className="h-6 w-6 border-2 border-[#c4703f] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : statement.items.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-[#3d4f6f]">
              No transactions found
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-[#e8e0d4] text-[10px] text-[#3d4f6f] uppercase">
                  <th className="py-2 px-3 text-left font-semibold">Date</th>
                  <th className="py-2 px-3 text-left font-semibold">Description</th>
                  <th className="py-2 px-3 text-center font-semibold">Bk</th>
                  <th className="py-2 px-3 text-right font-semibold">Debit</th>
                  <th className="py-2 px-3 text-right font-semibold">Credit</th>
                  <th className="py-2 px-3 text-right font-semibold">Balance</th>
                </tr>
              </thead>
              <tbody>
                {statement.items.map((item: any) => (
                  <tr key={item.id} className="border-b border-[#f5f0e8] hover:bg-[#f5f0e8]/50">
                    <td className="py-2 px-3 text-xs font-mono text-[#3d4f6f]">
                      {new Date(item.date).toLocaleDateString("en-IN")}
                    </td>
                    <td className="py-2 px-3 text-xs text-[#1e2a4a]">{item.description}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        item.bookType === "CC" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                      }`}>
                        {item.bookType}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-xs text-right font-mono text-red-600">
                      {item.debit ? `₹ ${item.debit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : ""}
                    </td>
                    <td className="py-2 px-3 text-xs text-right font-mono text-green-600">
                      {item.credit ? `₹ ${item.credit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : ""}
                    </td>
                    <td className="py-2 px-3 text-xs text-right font-mono font-semibold">
                      ₹ {item.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
