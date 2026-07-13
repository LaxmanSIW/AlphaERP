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
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [bookType, setBookType] = useState<"ALL" | "CC" | "CS">("ALL");
  const [txType, setTxType] = useState<"ALL" | "Sale" | "Payment_Received">("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TransactionFormData>({ ...emptyForm });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.transaction.list.useQuery({
    page,
    limit: 25,
    bookType: bookType as any,
    search: search || undefined,
    transactionType: txType as any,
  });

  const { data: buyersList } = trpc.buyer.list.useQuery({ limit: 100 });

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
                onClick={() => { setBookType(type); setPage(1); }}
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
            placeholder="Search buyer name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 bg-white border-[#d9cfc0]"
          />
        </div>
        <select
          value={txType}
          onChange={(e) => { setTxType(e.target.value as any); setPage(1); }}
          className="px-3 py-2 rounded-md border border-[#d9cfc0] bg-white text-sm text-[#1e2a4a] focus:outline-none focus:border-[#c4703f]"
        >
          <option value="ALL">All Types</option>
          <option value="Sale">Sales</option>
          <option value="Payment_Received">Payments</option>
        </select>
      </div>

      {/* Table */}
      <Card className="border-[#d9cfc0] bg-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f5f0e8] border-b border-[#e8e0d4] text-xs text-[#3d4f6f] uppercase tracking-wider">
                  <th className="text-left py-3 px-4 font-semibold">ID</th>
                  <th className="text-left py-3 px-4 font-semibold">Date</th>
                  <th className="text-left py-3 px-4 font-semibold">Buyer</th>
                  <th className="text-left py-3 px-4 font-semibold">Book</th>
                  <th className="text-left py-3 px-4 font-semibold">Type</th>
                  <th className="text-left py-3 px-4 font-semibold">Check #</th>
                  <th className="text-right py-3 px-4 font-semibold">Qty</th>
                  <th className="text-right py-3 px-4 font-semibold">Amount</th>
                  <th className="text-center py-3 px-4 font-semibold">Report</th>
                  <th className="text-center py-3 px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-[#f5f0e8]">
                      {Array.from({ length: 10 }).map((_, j) => (
                        <td key={j} className="py-3 px-4">
                          <div className="h-4 bg-[#e8e0d4] rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  data?.items?.map((tx) => (
                    <tr key={tx.id} className="border-b border-[#f5f0e8] hover:bg-[#f5f0e8]/50 transition-colors">
                      <td className="py-3 px-4 text-sm font-mono text-[#3d4f6f]">#{tx.id}</td>
                      <td className="py-3 px-4 text-sm text-[#1e2a4a]">
                        {tx.transactionDate ? new Date(tx.transactionDate).toLocaleDateString("en-IN") : "-"}
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-[#1e2a4a]">{tx.companyName}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${tx.bookType === "CC" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                          {tx.bookType}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${tx.transactionType === "Sale" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                          {tx.transactionType === "Sale" ? "Sale" : "Payment"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm font-mono text-[#3d4f6f]">{tx.checkNumber || "-"}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono">{tx.trouserQuantity || 0}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono font-semibold">
                        ₹ {parseFloat(tx.amount as string).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {tx.includeInReporting ? (
                          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(tx)} className="p-1.5 rounded hover:bg-[#f5f0e8] transition-colors">
                            <Pencil className="w-4 h-4 text-[#3d4f6f]" />
                          </button>
                          <button onClick={() => openDelete(tx.id)} className="p-1.5 rounded hover:bg-red-50 transition-colors">
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
                {(!isLoading && (!data?.items || data.items.length === 0)) && (
                  <tr>
                    <td colSpan={10} className="py-12 text-center">
                      <FileText className="w-12 h-12 mx-auto text-[#d9cfc0] mb-3" />
                      <p className="text-sm text-[#3d4f6f]">No transactions found</p>
                      <p className="text-xs text-[#3d4f6f] mt-1">Try adjusting filters or add a new transaction</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#e8e0d4]">
              <span className="text-xs text-[#3d4f6f]">
                Showing {((page - 1) * 25) + 1}-{Math.min(page * 25, data.total)} of {data.total} entries
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs text-[#3d4f6f] px-2">{page} / {data.totalPages}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                  disabled={page === data.totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-[#1e2a4a]">
              {editingId ? `Edit Transaction #${editingId}` : "New Transaction"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Buyer */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-[#1e2a4a]">
                Buyer <span className="text-red-500">*</span>
              </Label>
              <select
                value={form.buyerId}
                onChange={(e) => setForm({ ...form, buyerId: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-md border border-[#d9cfc0] bg-[#f5f0e8] text-sm text-[#1e2a4a] focus:outline-none focus:border-[#c4703f] focus:ring-1 focus:ring-[#c4703f]/20"
              >
                <option value={0}>Select Buyer</option>
                {buyersList?.items?.map((buyer) => (
                  <option key={buyer.id} value={buyer.id}>
                    {buyer.companyName} {buyer.contactPerson ? `(${buyer.contactPerson})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Book Type */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-[#1e2a4a]">Book Type</Label>
              <div className="flex gap-3">
                {(["CC", "CS"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setForm({ ...form, bookType: type })}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      form.bookType === type
                        ? type === "CC"
                          ? "bg-blue-100 text-blue-700 border-2 border-blue-400"
                          : "bg-green-100 text-green-700 border-2 border-green-400"
                        : "bg-[#f5f0e8] text-[#3d4f6f] border-2 border-transparent"
                    }`}
                  >
                    {type === "CC" ? "CC Book (Cheque)" : "CS Book (Cash)"}
                  </button>
                ))}
              </div>
            </div>

            {/* Transaction Type */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-[#1e2a4a]">Transaction Type</Label>
              <div className="flex gap-3">
                {(["Sale", "Payment_Received"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setForm({ ...form, transactionType: type })}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      form.transactionType === type
                        ? type === "Sale"
                          ? "bg-red-100 text-red-700 border-2 border-red-400"
                          : "bg-green-100 text-green-700 border-2 border-green-400"
                        : "bg-[#f5f0e8] text-[#3d4f6f] border-2 border-transparent"
                    }`}
                  >
                    {type === "Sale" ? "Sale" : "Payment Received"}
                  </button>
                ))}
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-[#1e2a4a]">
                  Transaction Date <span className="text-red-500">*</span>
                </Label>
                <SmartDateInput
                  value={form.transactionDate}
                  onChange={(val) => setForm({ ...form, transactionDate: val })}
                  placeholder="DD/MM/YYYY"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-[#1e2a4a]">Due Date</Label>
                <SmartDateInput
                  value={form.dueDate}
                  onChange={(val) => setForm({ ...form, dueDate: val })}
                  placeholder="DD/MM/YYYY (optional)"
                />
              </div>
            </div>

            {/* Quantity & Amount */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-[#1e2a4a]">Trouser Quantity</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.trouserQuantity}
                  onChange={(e) => setForm({ ...form, trouserQuantity: Number(e.target.value) })}
                  className="bg-[#f5f0e8] border-[#d9cfc0] font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-[#1e2a4a]">
                  Amount (₹) <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={form.amount || ""}
                  onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                  className="bg-[#f5f0e8] border-[#d9cfc0] font-mono"
                />
              </div>
            </div>

            {/* Include in reporting */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="includeInReporting"
                checked={form.includeInReporting}
                onChange={(e) => setForm({ ...form, includeInReporting: e.target.checked })}
                className="w-4 h-4 rounded border-[#d9cfc0] text-[#c4703f] focus:ring-[#c4703f]"
              />
              <Label htmlFor="includeInReporting" className="text-sm text-[#1e2a4a] cursor-pointer">
                Include in Total Sale Count
              </Label>
            </div>

            {/* Check Number (conditional) */}
            {form.bookType === "CC" && form.transactionType === "Sale" && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-[#1e2a4a]">Check Number</Label>
                <Input
                  value={form.checkNumber}
                  onChange={(e) => setForm({ ...form, checkNumber: e.target.value })}
                  placeholder="Enter cheque number"
                  className="bg-[#f5f0e8] border-[#d9cfc0]"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[#e8e0d4]">
            <span className="text-xs text-[#3d4f6f]">
              <kbd className="bg-[#1e2a4a] text-[#e8e0d4] px-1.5 py-0.5 rounded text-[10px] font-mono">Ctrl+S</kbd> to save
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setModalOpen(false)} className="border-[#d9cfc0]">
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-[#c4703f] hover:bg-[#a85d32] text-white"
              >
                <Save className="w-4 h-4 mr-1" />
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Transaction"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-[#1e2a4a] flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Delete Transaction?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#3d4f6f]">
            This action cannot be undone. The transaction will be archived for auditing purposes.
          </p>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-[#1e2a4a]">
              Reason for deletion <span className="text-red-500">*</span>
            </Label>
            <textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Enter reason..."
              className="w-full px-3 py-2 rounded-md border border-[#d9cfc0] bg-[#f5f0e8] text-sm text-[#1e2a4a] focus:outline-none focus:border-[#c4703f] focus:ring-1 focus:ring-[#c4703f]/20 min-h-[80px] resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)} className="border-[#d9cfc0]">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (deletingId && deleteReason) {
                  deleteMutation.mutate({ id: deletingId, reason: deleteReason });
                }
              }}
              disabled={!deleteReason || deleteMutation.isPending}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete & Archive"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
