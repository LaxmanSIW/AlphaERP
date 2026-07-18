import { useState } from "react";
import { Plus, Search, Pencil, Trash2, Tag } from "lucide-react";
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

interface ItemFormData {
  name: string;
  hsnCode: string;
  listPrice: number;
  unit: string;
  taxPercent: number;
}

const emptyForm: ItemFormData = {
  name: "",
  hsnCode: "",
  listPrice: 0,
  unit: "Pcs.",
  taxPercent: 18,
};

export default function Items() {
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ItemFormData>({ ...emptyForm });

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.item.list.useQuery();

  const table = useTableState({
    data: data?.items || [],
    searchFields: ["name", "hsnCode", "unit"],
    defaultSortKey: "name",
    defaultSortDirection: "asc",
  });

  const createMutation = trpc.item.create.useMutation({
    onSuccess: () => {
      utils.item.list.invalidate();
      toast({ title: "Success", description: "Item created successfully" });
      setModalOpen(false);
      setForm({ ...emptyForm });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = trpc.item.update.useMutation({
    onSuccess: () => {
      utils.item.list.invalidate();
      toast({ title: "Success", description: "Item updated successfully" });
      setModalOpen(false);
      setEditingId(null);
      setForm({ ...emptyForm });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = trpc.item.delete.useMutation({
    onSuccess: () => {
      utils.item.list.invalidate();
      toast({ title: "Success", description: "Item deleted successfully" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openEdit = (item: any) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      hsnCode: item.hsnCode,
      listPrice: parseFloat(item.listPrice) || 0,
      unit: item.unit,
      taxPercent: parseFloat(item.taxPercent) || 0,
    });
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: "Validation Error", description: "Item name is required", variant: "destructive" });
      return;
    }
    if (!form.hsnCode.trim()) {
      toast({ title: "Validation Error", description: "HSN Code is required", variant: "destructive" });
      return;
    }
    if (form.listPrice < 0) {
      toast({ title: "Validation Error", description: "List price cannot be negative", variant: "destructive" });
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this item?")) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1e2a4a] flex items-center gap-2">
            <Tag className="w-6 h-6 text-[#c4703f]" /> Item Catalog
          </h1>
          <p className="text-[#6b7280] text-sm">Manage products, HSN codes, tax structures, and price lists.</p>
        </div>
        <Button
          onClick={() => {
            setEditingId(null);
            setForm({ ...emptyForm });
            setModalOpen(true);
          }}
          className="bg-[#c4703f] hover:bg-[#b05e2f] text-white self-end sm:self-auto"
        >
          <Plus className="w-4 h-4 mr-1.5" /> New Item
        </Button>
      </div>

      {/* Main Card */}
      <Card className="border-none shadow-sm bg-white overflow-hidden rounded-xl">
        <CardContent className="p-0">
          {/* Filters Bar */}
          <div className="p-4 border-b border-[#ebdcc5]/40 bg-[#fbfaf7] flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name or HSN..."
                value={table.search}
                onChange={(e) => table.setSearch(e.target.value)}
                className="pl-9 bg-white border-[#dfd5c6] focus-visible:ring-[#c4703f]"
              />
            </div>
            <div className="text-xs text-gray-500 font-mono">
              Total Items: {table.totalFiltered}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f0e8dc] text-[#1e2a4a] text-xs uppercase font-semibold">
                  <SortableHeader
                    label="Item Name"
                    sortKey="name"
                    currentSortKey={table.sortConfig?.key as string}
                    sortDirection={table.sortConfig?.direction || null}
                    onSort={table.handleSort}
                  />
                  <SortableHeader
                    label="HSN/SAC Code"
                    sortKey="hsnCode"
                    currentSortKey={table.sortConfig?.key as string}
                    sortDirection={table.sortConfig?.direction || null}
                    onSort={table.handleSort}
                  />
                  <SortableHeader
                    label="List Price"
                    sortKey="listPrice"
                    currentSortKey={table.sortConfig?.key as string}
                    sortDirection={table.sortConfig?.direction || null}
                    onSort={table.handleSort}
                    align="right"
                  />
                  <SortableHeader
                    label="Unit"
                    sortKey="unit"
                    currentSortKey={table.sortConfig?.key as string}
                    sortDirection={table.sortConfig?.direction || null}
                    onSort={table.handleSort}
                  />
                  <SortableHeader
                    label="Tax Rate"
                    sortKey="taxPercent"
                    currentSortKey={table.sortConfig?.key as string}
                    sortDirection={table.sortConfig?.direction || null}
                    onSort={table.handleSort}
                    align="right"
                  />
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ebdcc5]/20 text-sm">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-400">
                      Loading items from database...
                    </td>
                  </tr>
                ) : table.filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-400">
                      No items found matching search filters.
                    </td>
                  </tr>
                ) : (
                  table.filteredData.map((item: any) => (
                    <tr key={item.id} className="hover:bg-[#fbf9f5] transition-colors">
                      <td className="py-3.5 px-4 font-medium text-[#1e2a4a]">{item.name}</td>
                      <td className="py-3.5 px-4 font-mono text-gray-600">{item.hsnCode}</td>
                      <td className="py-3.5 px-4 text-right font-semibold font-mono text-[#1e2a4a]">
                        ₹{parseFloat(item.listPrice).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-gray-600">{item.unit}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-gray-600">{parseFloat(item.taxPercent)}%</td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(item)}
                            className="h-8 w-8 text-gray-500 hover:text-[#c4703f] hover:bg-orange-50"
                            title="Edit Item"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(item.id)}
                            className="h-8 w-8 text-gray-500 hover:text-red-600 hover:bg-red-50"
                            title="Delete Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!table.isSearchActive && table.totalPages > 1 && (
            <div className="p-4 border-t border-[#ebdcc5]/40 flex justify-between items-center bg-[#fbfaf7]">
              <span className="text-xs text-gray-500">
                Page {table.page} of {table.totalPages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.setPage(table.page - 1)}
                  disabled={table.page === 1}
                  className="h-8 px-2 border-[#dfd5c6]"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.setPage(table.page + 1)}
                  disabled={table.page === table.totalPages}
                  className="h-8 px-2 border-[#dfd5c6]"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Item Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md bg-[#fbfaf7]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#1e2a4a]">
              {editingId ? "Edit Catalog Item" : "Create New Catalog Item"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-[#1e2a4a]">Item Name / Description</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Denim Trousers Slim Fit"
                required
                className="bg-white border-[#dfd5c6] focus-visible:ring-[#c4703f]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="hsnCode" className="text-[#1e2a4a]">HSN/SAC Code</Label>
                <Input
                  id="hsnCode"
                  value={form.hsnCode}
                  onChange={(e) => setForm({ ...form, hsnCode: e.target.value })}
                  placeholder="e.g. 39231020"
                  required
                  className="bg-white border-[#dfd5c6] focus-visible:ring-[#c4703f]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unit" className="text-[#1e2a4a]">Unit of Measure</Label>
                <Select
                  value={form.unit}
                  onValueChange={(val) => setForm({ ...form, unit: val })}
                >
                  <SelectTrigger className="bg-white border-[#dfd5c6]">
                    <SelectValue placeholder="Select Unit" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="Pcs.">Pcs. (Pieces)</SelectItem>
                    <SelectItem value="Mtrs">Mtrs (Meters)</SelectItem>
                    <SelectItem value="Kg">Kg (Kilograms)</SelectItem>
                    <SelectItem value="Box">Box</SelectItem>
                    <SelectItem value="Doz">Doz (Dozen)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="listPrice" className="text-[#1e2a4a]">List Price (₹)</Label>
                <Input
                  id="listPrice"
                  type="number"
                  step="0.01"
                  value={form.listPrice}
                  onChange={(e) => setForm({ ...form, listPrice: parseFloat(e.target.value) || 0 })}
                  placeholder="e.g. 800.00"
                  required
                  className="bg-white border-[#dfd5c6] focus-visible:ring-[#c4703f]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="taxPercent" className="text-[#1e2a4a]">GST Rate (%)</Label>
                <Select
                  value={String(form.taxPercent)}
                  onValueChange={(val) => setForm({ ...form, taxPercent: parseFloat(val) })}
                >
                  <SelectTrigger className="bg-white border-[#dfd5c6]">
                    <SelectValue placeholder="Select GST" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="0">0% (GST Exempted)</SelectItem>
                    <SelectItem value="5">5% GST</SelectItem>
                    <SelectItem value="12">12% GST</SelectItem>
                    <SelectItem value="18">18% GST</SelectItem>
                    <SelectItem value="28">28% GST</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="border-[#dfd5c6] hover:bg-gray-100 text-[#1e2a4a]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-[#c4703f] hover:bg-[#b05e2f] text-white"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Item"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
