import { useState, useEffect } from "react";
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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { trpc } from "@/providers/trpc";
import { useToast } from "@/hooks/use-toast";

interface BuyerFormData {
  companyName: string;
  contactPerson: string;
  phone: string;
  gstNumber: string;
  creditLimit: number;
}

const emptyForm: BuyerFormData = {
  companyName: "",
  contactPerson: "",
  phone: "",
  gstNumber: "",
  creditLimit: 100000,
};

function RiskBadge({ score, level }: { score: number; level: string }) {
  const getColors = () => {
    if (score <= 3) return "bg-red-500 text-white";
    if (score <= 7) return "bg-yellow-500 text-white";
    return "bg-green-500 text-white";
  };

  return (
    <div className="flex items-center gap-1.5">
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
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<BuyerFormData>({ ...emptyForm });
  const [statementOpen, setStatementOpen] = useState(false);
  const [statementBuyerId, setStatementBuyerId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.buyer.list.useQuery({
    page,
    limit: 25,
    search: search || undefined,
  });

  const { data: riskData } = trpc.buyer.riskAnalysis.useQuery(search ? { search } : undefined);

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

  // Pre-select buyer from URL param
  useEffect(() => {
    const buyerId = searchParams.get("id");
    if (buyerId) {
      viewStatement(Number(buyerId));
      searchParams.delete("id");
      setSearchParams(searchParams);
    }
  }, [searchParams]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1e2a4a]">Buyers</h1>
          <p className="text-sm text-[#3d4f6f] mt-1">Manage buyer accounts</p>
        </div>
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

      {/* Search */}
      <div className="relative max-w-[300px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#3d4f6f]" />
        <Input
          placeholder="Search buyers..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-9 bg-white border-[#d9cfc0]"
        />
      </div>

      {/* Table */}
      <Card className="border-[#d9cfc0] bg-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f5f0e8] border-b border-[#e8e0d4] text-xs text-[#3d4f6f] uppercase tracking-wider">
                  <th className="text-left py-3 px-4 font-semibold">ID</th>
                  <th className="text-left py-3 px-4 font-semibold">Company</th>
                  <th className="text-left py-3 px-4 font-semibold">Contact</th>
                  <th className="text-left py-3 px-4 font-semibold">Phone</th>
                  <th className="text-left py-3 px-4 font-semibold">GST</th>
                  <th className="text-right py-3 px-4 font-semibold">Credit Limit</th>
                  <th className="text-right py-3 px-4 font-semibold">Outstanding</th>
                  <th className="text-center py-3 px-4 font-semibold">Risk</th>
                  <th className="text-center py-3 px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-[#f5f0e8]">
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} className="py-3 px-4">
                          <div className="h-4 bg-[#e8e0d4] rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  data?.items?.map((buyer) => {
                    const risk = riskData?.find((r) => r.buyer.id === buyer.id);
                    return (
                      <tr key={buyer.id} className="border-b border-[#f5f0e8] hover:bg-[#f5f0e8]/50 transition-colors">
                        <td className="py-3 px-4 text-sm font-mono text-[#3d4f6f]">#{buyer.id}</td>
                        <td className="py-3 px-4 text-sm font-medium text-[#1e2a4a]">{buyer.companyName}</td>
                        <td className="py-3 px-4 text-sm text-[#3d4f6f]">{buyer.contactPerson || "-"}</td>
                        <td className="py-3 px-4 text-sm text-[#3d4f6f] font-mono">{buyer.phone || "-"}</td>
                        <td className="py-3 px-4 text-sm text-[#3d4f6f] font-mono">{buyer.gstNumber || "-"}</td>
                        <td className="py-3 px-4 text-sm text-right font-mono">
                          ₹ {parseFloat(buyer.creditLimit as string).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-sm text-right font-mono font-semibold text-red-600">
                          ₹ {(buyer as any).outstanding?.toLocaleString("en-IN", { minimumFractionDigits: 2 }) || "0.00"}
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
                {(!isLoading && (!data?.items || data.items.length === 0)) && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center">
                      <UsersIcon className="w-12 h-12 mx-auto text-[#d9cfc0] mb-3" />
                      <p className="text-sm text-[#3d4f6f]">No buyers found</p>
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
                Showing {((page - 1) * 25) + 1}-{Math.min(page * 25, data.total)} of {data.total}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-8 w-8 p-0">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs text-[#3d4f6f] px-2">{page} / {data.totalPages}</span>
                <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages} className="h-8 w-8 p-0">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Buyer Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-[#1e2a4a]">
              {editingId ? "Edit Buyer" : "Add Buyer"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Company Name <span className="text-red-500">*</span></Label>
              <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="Enter company name" className="bg-[#f5f0e8] border-[#d9cfc0]" />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Person</Label>
              <Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} placeholder="Enter contact person" className="bg-[#f5f0e8] border-[#d9cfc0]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="10-digit number" className="bg-[#f5f0e8] border-[#d9cfc0]" />
              </div>
              <div className="space-y-1.5">
                <Label>GST Number</Label>
                <Input value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} placeholder="15 characters" className="bg-[#f5f0e8] border-[#d9cfc0] font-mono text-xs" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Credit Limit (₹)</Label>
              <Input type="number" min={0} value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: Number(e.target.value) })} className="bg-[#f5f0e8] border-[#d9cfc0] font-mono" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-[#e8e0d4]">
            <Button variant="outline" onClick={() => setModalOpen(false)} className="border-[#d9cfc0]">Cancel</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} className="bg-[#c4703f] hover:bg-[#a85d32] text-white">
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Buyer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Statement Modal */}
      {statementBuyerId && (
        <BuyerStatementModal
          buyerId={statementBuyerId}
          open={statementOpen}
          onClose={() => { setStatementOpen(false); setStatementBuyerId(null); }}
        />
      )}
    </div>
  );
}

function UsersIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function BuyerStatementModal({ buyerId, open, onClose }: { buyerId: number; open: boolean; onClose: () => void }) {
  const { data, isLoading } = trpc.buyer.statement.useQuery({ id: buyerId });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-[#1e2a4a]">
            Buyer Statement - {data?.buyer?.companyName || "Loading..."}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-[#3d4f6f]">Loading statement...</div>
        ) : (
          <div className="space-y-4">
            {/* Buyer Info */}
            <div className="bg-[#f5f0e8] rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-[#3d4f6f] text-xs">Company</p>
                <p className="font-medium text-[#1e2a4a]">{data?.buyer?.companyName}</p>
              </div>
              <div>
                <p className="text-[#3d4f6f] text-xs">Contact</p>
                <p className="font-medium text-[#1e2a4a]">{data?.buyer?.contactPerson || "-"}</p>
              </div>
              <div>
                <p className="text-[#3d4f6f] text-xs">Phone</p>
                <p className="font-medium text-[#1e2a4a] font-mono">{data?.buyer?.phone || "-"}</p>
              </div>
              <div>
                <p className="text-[#3d4f6f] text-xs">GST</p>
                <p className="font-medium text-[#1e2a4a] font-mono">{data?.buyer?.gstNumber || "-"}</p>
              </div>
            </div>

            {/* Summary */}
            <div className="flex items-center justify-between bg-[#1e2a4a] text-white rounded-lg px-6 py-3">
              <div>
                <p className="text-xs text-[#8b9bb4]">Opening Balance</p>
                <p className="font-mono font-semibold">₹ {data?.openingBalance?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#8b9bb4]">Closing Balance</p>
                <p className="font-mono font-semibold text-lg">₹ {data?.closingBalance?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
              </div>
            </div>

            {/* Statement Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-[#1e2a4a] text-xs uppercase tracking-wider">
                    <th className="text-left py-2 px-3 font-semibold">Date</th>
                    <th className="text-left py-2 px-3 font-semibold">Description</th>
                    <th className="text-left py-2 px-3 font-semibold">Book</th>
                    <th className="text-right py-2 px-3 font-semibold text-red-600">Debit</th>
                    <th className="text-right py-2 px-3 font-semibold text-green-600">Credit</th>
                    <th className="text-right py-2 px-3 font-semibold">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items?.map((item: any, idx: number) => (
                    <tr key={idx} className="border-b border-[#f5f0e8] hover:bg-[#f5f0e8]/50">
                      <td className="py-2 px-3 text-[#3d4f6f]">
                        {item.date ? new Date(item.date).toLocaleDateString("en-IN") : "-"}
                      </td>
                      <td className="py-2 px-3 font-medium text-[#1e2a4a]">{item.description}</td>
                      <td className="py-2 px-3">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-semibold ${item.bookType === "CC" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                          {item.bookType}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-red-600">
                        {item.debit > 0 ? `₹ ${item.debit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "-"}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-green-600">
                        {item.credit > 0 ? `₹ ${item.credit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "-"}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-[#1e2a4a]">
                        ₹ {item.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  {(!data?.items || data.items.length === 0) && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#3d4f6f]">No transactions found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
