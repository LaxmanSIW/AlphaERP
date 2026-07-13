import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Save,
  FileText,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { trpc } from "@/providers/trpc";
import { useToast } from "@/hooks/use-toast";
import { useTableState } from "@/hooks/useTableState";
import { SortableHeader } from "@/components/SortableHeader";

interface TransactionFormData {
  buyerId: number;
  bookType: "CC" | "CS";
  transactionType: "Sale" | "Payment_Received";
  transactionDate: string;
  dueDate: string;
  trouserQuantity: number;
  amount: number;
  checkNumber: string;
  includeInReporting: boolean;
}

const emptyForm: TransactionFormData = {
  buyerId: 0,
  bookType: "CC",
  transactionType: "Sale",
  transactionDate: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "/"),
  dueDate: "",
  trouserQuantity: 0,
  amount: 0,
  checkNumber: "",
  includeInReporting: true,
};

function SmartDateInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleBlur = () => {
    const parsed = parseSmartDate(localValue);
    if (parsed) {
      setLocalValue(parsed);
      onChange(parsed);
    }
  };

  return (
    <Input
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      placeholder={placeholder || "DD/MM/YYYY"}
      className="bg-[#f5f0e8] border-[#d9cfc0] focus:border-[#c4703f] focus:ring-[#c4703f]/15"
    />
  );
}

function parseSmartDate(dateStr: string): string | null {
  if (!dateStr) return null;
  if (dateStr.includes("/") || dateStr.includes("-")) {
    const parts = dateStr.split(/[\/\-]/);
    if (parts.length === 3) {
      const day = parts[0].padStart(2, "0");
      const month = parts[1].padStart(2, "0");
      const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
      return `${day}/${month}/${year}`;
    }
  }
  const clean = dateStr.replace(/\D/g, "");
  if (clean.length === 6 || clean.length === 8) {
    const day = clean.substring(0, 2);
    const month = clean.substring(2, 4);
    const year = clean.length === 6 ? `20${clean.substring(4, 6)}` : clean.substring(4, 8);
    return `${day}/${month}/${year}`;
  }
  return null;
}

export default function Transactions() {
  const { toast } = useToast();
  const [bookType, setBookType] = useState<"ALL" | "CC" | "CS">("ALL");
  const [txType, setTxType] = useState<"ALL" | "Sale" | "Payment_Received">("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TransactionFormData>({ ...emptyForm });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  const { data: apiData, isLoading } = trpc.transaction.list.useQuery({
    bookType: bookType as any,
    transactionType: txType as any,
  });

  const { data: buyersList } = trpc.buyer.list.useQuery({});

  const table = useTableState({
    data: (apiData?.items as any[]) || [],
    searchFields: ["companyName", "checkNumber"],
    defaultSortKey: "transactionDate",
    defaultSortDirection: "desc",
  });

  const createMutation = trpc.transaction.create.useMutation({
    onSuccess: () => {
      utils.transaction.list.invalidate();
      utils.dashboard.stats.invalidate();
      toast({ title: "Success", description: "Transaction created successfully" });
      setModalOpen(false);
      setForm({ ...emptyForm });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = trpc.transaction.update.useMutation({
    onSuccess: () => {
      utils.transaction.list.invalidate();
      utils.dashboard.stats.invalidate();
      toast({ title: "Success", description: "Transaction updated successfully" });
      setModalOpen(false);
      setEditingId(null);
      setForm({ ...emptyForm });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = trpc.transaction.delete.useMutation({
    onSuccess: () => {
      utils.transaction.list.invalidate();
      utils.dashboard.stats.invalidate();
      toast({ title: "Success", description: "Transaction archived successfully" });
      setDeleteModalOpen(false);
      setDeleteReason("");
      setDeletingId(null);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        setEditingId(null);
        setForm({ ...emptyForm, transactionDate: new Date().toLocaleDateString("en-IN").replace(/\//g, "/") });
        setModalOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSave = useCallback(() => {
    if (!form.buyerId || form.amount <= 0) {
      toast({ title: "Validation Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        buyerId: form.buyerId,
        bookType: form.bookType,
        transactionDate: form.transactionDate,
        dueDate: form.dueDate || undefined,
        amount: form.amount,
        trouserQuantity: form.trouserQuantity,
        checkNumber: form.checkNumber || undefined,
        transactionType: form.transactionType,
        includeInReporting: form.includeInReporting,
      });
    } else {
      createMutation.mutate({
        buyerId: form.buyerId,
        bookType: form.bookType,
        transactionDate: form.transactionDate,
        dueDate: form.dueDate || undefined,
        amount: form.amount,
        trouserQuantity: form.trouserQuantity,
        checkNumber: form.checkNumber || undefined,
        transactionType: form.transactionType,
        includeInReporting: form.includeInReporting,
      });
    }
  }, [form, editingId, createMutation, updateMutation, toast]);

  // Form keyboard shortcut (Ctrl+S)
  useEffect(() => {
    if (!modalOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [modalOpen, handleSave]);

  const openEdit = (tx: any) => {
    setEditingId(tx.id);
    setForm({
      buyerId: tx.buyerId,
      bookType: tx.bookType as "CC" | "CS",
      transactionType: tx.transactionType as "Sale" | "Payment_Received",
      transactionDate: tx.transactionDate ? new Date(tx.transactionDate).toLocaleDateString("en-IN") : "",
      dueDate: tx.dueDate ? new Date(tx.dueDate).toLocaleDateString("en-IN") : "",
      trouserQuantity: tx.trouserQuantity || 0,
      amount: parseFloat(tx.amount as string),
      checkNumber: tx.checkNumber || "",
      includeInReporting: tx.includeInReporting ?? true,
    });
    setModalOpen(true);
  };

  const openDelete = (id: number) => {
    setDeletingId(id);
    setDeleteReason("");
    setDeleteModalOpen(true);
  };

  const formatCurrency = (amount: string | number) => {
    const val = typeof amount === "string" ? parseFloat(amount) : amount;
    return `\u20b9 ${val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1e2a4a]">Transactions</h1>
          <p className="text-sm text-[#3d4f6f] mt-1">Alpha CC &amp; CS Ledger</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#e8e0d4] rounded-full p-1">
            {(["ALL", "CC", "CS"] as const).map((type) => (
              <button
                key={type}
                onClick={() => { setBookType(type); table.setPage(1); }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  bookType === type ? "bg-white text-[#1e2a4a] shadow-sm" : "text-[#3d4f6f]"
                }`}
              >
                {type === "ALL" ? "All" : type}
              </button>
            ))}
          </div>
          <Button
            onClick={() => {
              setEditingId(null);
              setForm({ ...emptyForm, transactionDate: new Date().toLocaleDateString("en-IN").replace(/\//g, "/") });
              setModalOpen(true);
            }}
            className="bg-[#c4703f] hover:bg-[#a85d32] text-white"
          >
            <Plus className="w-4 h-4 mr-1" />
            New Transaction
            <kbd className="ml-2 text-[10px] bg-[#a85d32] px-1.5 py-0.5 rounded">Ctrl+N</kbd>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#3d4f6f]" />
          <Input
            placeholder="Search buyer name or check number..."
            value={table.search}
            onChange={(e) => table.setSearch(e.target.value)}
            className="pl-9 bg-white border-[#d9cfc0]"
          />
        </div>
        <select
          value={txType}
          onChange={(e) => { setTxType(e.target.value as any); table.setPage(1); }}
          className="px-3 py-2 rounded-md border border-[#d9cfc0] bg-white text-sm text-[#1e2a4a] focus:outline-none focus:ring-2 focus:ring-[#c4703f]/15"
        >
          <option value="ALL">All Types</option>
          <option value="Sale">Sale</option>
          <option value="Payment_Received">Payment Received</option>
        </select>
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
                  <SortableHeader label="ID" sortKey="id" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} className="w-16" />
                  <SortableHeader label="Buyer" sortKey="companyName" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} />
                  <SortableHeader label="Book" sortKey="bookType" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="center" className="w-20" />
                  <SortableHeader label="Type" sortKey="transactionType" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="center" />
                  <SortableHeader label="Date" sortKey="transactionDate" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} />
                  <SortableHeader label="Due Date" sortKey="dueDate" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} />
                  <SortableHeader label="Qty" sortKey="trouserQuantity" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="right" className="w-20" />
                  <SortableHeader label="Amount" sortKey="amount" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} align="right" />
                  <SortableHeader label="Check #" sortKey="checkNumber" currentSortKey={table.sortConfig?.key || null} sortDirection={table.sortConfig?.direction || null} onSort={table.handleSort} />
                  <th className="py-3 px-4 font-semibold text-center w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-[#f5f0e8]">
                      {Array.from({ length: 10 }).map((_, j) => (
                        <td key={j} className="py-3 px-4">
                          <div className="h-4 bg-[#e8e0d4] rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : table.filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-sm text-[#3d4f6f]">
                      {table.search ? "No matching transactions found" : "No transactions found"}
                    </td>
                  </tr>
                ) : (
                  table.filteredData.map((tx: any) => (
                    <tr key={tx.id} className="border-b border-[#f5f0e8] hover:bg-[#f5f0e8]/50 transition-colors">
                      <td className="py-3 px-4 text-sm font-mono text-[#3d4f6f]">#{tx.id}</td>
                      <td className="py-3 px-4 text-sm font-medium text-[#1e2a4a]">{tx.companyName || "Unknown"}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                          tx.bookType === "CC" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                        }`}>
                          {tx.bookType}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                          tx.transactionType === "Sale" ? "bg-[#c4703f]/10 text-[#c4703f]" : "bg-green-100 text-green-700"
                        }`}>
                          {tx.transactionType === "Sale" ? "Sale" : "Payment"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-[#3d4f6f] font-mono">
                        {tx.transactionDate ? new Date(tx.transactionDate).toLocaleDateString("en-IN") : "-"}
                      </td>
                      <td className="py-3 px-4 text-sm text-[#3d4f6f] font-mono">
                        {tx.dueDate ? new Date(tx.dueDate).toLocaleDateString("en-IN") : "-"}
                      </td>
                      <td className="py-3 px-4 text-sm text-right font-mono">{tx.trouserQuantity || 0}</td>
                      <td className={`py-3 px-4 text-sm text-right font-mono font-semibold ${
                        tx.transactionType === "Sale" ? "text-red-600" : "text-green-600"
                      }`}>
                        {tx.transactionType === "Sale" ? "+" : "-"} {formatCurrency(tx.amount)}
                      </td>
                      <td className="py-3 px-4 text-sm text-[#3d4f6f] font-mono">{tx.checkNumber || "-"}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(tx)} className="p-1.5 rounded hover:bg-[#f5f0e8] transition-colors" title="Edit">
                            <Pencil className="w-4 h-4 text-[#3d4f6f]" />
                          </button>
                          <button onClick={() => openDelete(tx.id)} className="p-1.5 rounded hover:bg-red-50 transition-colors" title="Archive">
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.setPage(table.page - 1)}
                  disabled={table.page <= 1}
                  className="border-[#d9cfc0] h-8 w-8 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.setPage(table.page + 1)}
                  disabled={table.page >= table.totalPages}
                  className="border-[#d9cfc0] h-8 w-8 p-0"
                >
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
                {editingId ? "Edit Transaction" : "New Transaction"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label className="text-[#1e2a4a]">Buyer *</Label>
                <select
                  value={form.buyerId}
                  onChange={(e) => setForm({ ...form, buyerId: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-md border border-[#d9cfc0] bg-[#f5f0e8] text-sm focus:outline-none focus:ring-2 focus:ring-[#c4703f]/15"
                >
                  <option value={0}>Select buyer...</option>
                  {buyersList?.items?.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.companyName}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[#1e2a4a]">Book Type *</Label>
                  <div className="flex gap-2">
                    {(["CC", "CS"] as const).map((bt) => (
                      <button
                        key={bt}
                        onClick={() => setForm({ ...form, bookType: bt })}
                        className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                          form.bookType === bt
                            ? "bg-[#c4703f] text-white"
                            : "bg-[#f5f0e8] border border-[#d9cfc0] text-[#3d4f6f] hover:bg-[#e8e0d4]"
                        }`}
                      >
                        {bt}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[#1e2a4a]">Transaction Type *</Label>
                  <div className="flex gap-2">
                    {(["Sale", "Payment_Received"] as const).map((tt) => (
                      <button
                        key={tt}
                        onClick={() => setForm({ ...form, transactionType: tt })}
                        className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                          form.transactionType === tt
                            ? tt === "Sale" ? "bg-red-500 text-white" : "bg-green-500 text-white"
                            : "bg-[#f5f0e8] border border-[#d9cfc0] text-[#3d4f6f] hover:bg-[#e8e0d4]"
                        }`}
                      >
                        {tt === "Sale" ? "Sale" : "Payment"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[#1e2a4a]">Transaction Date *</Label>
                  <SmartDateInput
                    value={form.transactionDate}
                    onChange={(val) => setForm({ ...form, transactionDate: val })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#1e2a4a]">Due Date</Label>
                  <SmartDateInput
                    value={form.dueDate}
                    onChange={(val) => setForm({ ...form, dueDate: val })}
                    placeholder="DD/MM/YYYY (optional)"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[#1e2a4a]">Amount (\u20b9) *</Label>
                  <Input
                    type="number"
                    value={form.amount || ""}
                    onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="bg-[#f5f0e8] border-[#d9cfc0] text-right font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#1e2a4a]">Trouser Quantity</Label>
                  <Input
                    type="number"
                    value={form.trouserQuantity || ""}
                    onChange={(e) => setForm({ ...form, trouserQuantity: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                    className="bg-[#f5f0e8] border-[#d9cfc0] text-right font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[#1e2a4a]">Check Number</Label>
                <Input
                  value={form.checkNumber}
                  onChange={(e) => setForm({ ...form, checkNumber: e.target.value })}
                  placeholder="Optional (for CC transactions)"
                  className="bg-[#f5f0e8] border-[#d9cfc0] font-mono"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="includeInReporting"
                  checked={form.includeInReporting}
                  onChange={(e) => setForm({ ...form, includeInReporting: e.target.checked })}
                  className="w-4 h-4 rounded border-[#d9cfc0] text-[#c4703f] focus:ring-[#c4703f]"
                />
                <Label htmlFor="includeInReporting" className="text-sm text-[#3d4f6f] cursor-pointer">
                  Include in reporting
                </Label>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleSave}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 bg-[#c4703f] hover:bg-[#a85d32] text-white"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {editingId ? "Update" : "Save"}
                  <kbd className="ml-2 text-[10px] bg-[#a85d32] px-1.5 py-0.5 rounded">Ctrl+S</kbd>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setModalOpen(false); setEditingId(null); }}
                  className="border-[#d9cfc0]"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Modal */}
      {deleteModalOpen && (
        <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg text-[#1e2a4a] flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                Archive Transaction
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <p className="text-sm text-[#3d4f6f]">
                This will soft-delete the transaction. It will remain visible in reports but marked as archived.
              </p>
              <div className="space-y-2">
                <Label className="text-[#1e2a4a]">Reason for archiving *</Label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Enter reason..."
                  className="w-full px-3 py-2 rounded-md border border-[#d9cfc0] bg-[#f5f0e8] text-sm focus:outline-none focus:ring-2 focus:ring-[#c4703f]/15 min-h-[80px] resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => {
                    if (!deleteReason.trim()) {
                      toast({ title: "Required", description: "Please provide a reason", variant: "destructive" });
                      return;
                    }
                    if (deletingId) deleteMutation.mutate({ id: deletingId, reason: deleteReason });
                  }}
                  disabled={deleteMutation.isPending}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {deleteMutation.isPending ? "Archiving..." : "Archive"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setDeleteModalOpen(false); setDeletingId(null); }}
                  className="border-[#d9cfc0]"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
