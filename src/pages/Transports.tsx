import { useState } from "react";
import { Plus, Search, Pencil, Trash2, Truck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { trpc } from "@/providers/trpc";
import { useToast } from "@/hooks/use-toast";
import { useTableState } from "@/hooks/useTableState";
import { SortableHeader } from "@/components/SortableHeader";

interface TransportFormData {
  name: string;
  phone: string;
  vehicleNumber: string;
}

const emptyForm: TransportFormData = {
  name: "",
  phone: "",
  vehicleNumber: "",
};

export default function Transports() {
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TransportFormData>({ ...emptyForm });

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.transport.list.useQuery();

  const table = useTableState({
    data: data?.transports || [],
    searchFields: ["name", "phone", "vehicleNumber"],
    defaultSortKey: "name",
    defaultSortDirection: "asc",
  });

  const createMutation = trpc.transport.create.useMutation({
    onSuccess: () => {
      utils.transport.list.invalidate();
      toast({ title: "Success", description: "Transport agency created successfully" });
      setModalOpen(false);
      setForm({ ...emptyForm });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = trpc.transport.update.useMutation({
    onSuccess: () => {
      utils.transport.list.invalidate();
      toast({ title: "Success", description: "Transport agency updated successfully" });
      setModalOpen(false);
      setEditingId(null);
      setForm({ ...emptyForm });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = trpc.transport.delete.useMutation({
    onSuccess: () => {
      utils.transport.list.invalidate();
      toast({ title: "Success", description: "Transport agency deleted successfully" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openEdit = (item: any) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      phone: item.phone || "",
      vehicleNumber: item.vehicleNumber || "",
    });
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: "Validation Error", description: "Transport name is required", variant: "destructive" });
      return;
    }

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      vehicleNumber: form.vehicleNumber.trim() || null,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this transport agency?")) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1e2a4a] flex items-center gap-2">
            <Truck className="w-6 h-6 text-[#c4703f]" /> Transport Directory
          </h1>
          <p className="text-[#6b7280] text-sm">Manage logistics partners, vehicles, and contact details.</p>
        </div>
        <Button
          onClick={() => {
            setEditingId(null);
            setForm({ ...emptyForm });
            setModalOpen(true);
          }}
          className="bg-[#c4703f] hover:bg-[#b05e2f] text-white self-end sm:self-auto"
        >
          <Plus className="w-4 h-4 mr-1.5" /> New Transport
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
                placeholder="Search transport or vehicle..."
                value={table.search}
                onChange={(e) => table.setSearch(e.target.value)}
                className="pl-9 bg-white border-[#dfd5c6] focus-visible:ring-[#c4703f]"
              />
            </div>
            <div className="text-xs text-gray-500 font-mono">
              Total Transports: {table.totalFiltered}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f0e8dc] text-[#1e2a4a] text-xs uppercase font-semibold">
                  <SortableHeader
                    label="Transport Name"
                    sortKey="name"
                    currentSortKey={table.sortConfig?.key as string}
                    sortDirection={table.sortConfig?.direction || null}
                    onSort={table.handleSort}
                  />
                  <SortableHeader
                    label="Phone / Contact"
                    sortKey="phone"
                    currentSortKey={table.sortConfig?.key as string}
                    sortDirection={table.sortConfig?.direction || null}
                    onSort={table.handleSort}
                  />
                  <SortableHeader
                    label="Vehicle Number"
                    sortKey="vehicleNumber"
                    currentSortKey={table.sortConfig?.key as string}
                    sortDirection={table.sortConfig?.direction || null}
                    onSort={table.handleSort}
                  />
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ebdcc5]/20 text-sm">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-400">
                      Loading transports from database...
                    </td>
                  </tr>
                ) : table.filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-400">
                      No transports found.
                    </td>
                  </tr>
                ) : (
                  table.filteredData.map((item: any) => (
                    <tr key={item.id} className="hover:bg-[#fbf9f5] transition-colors">
                      <td className="py-3.5 px-4 font-medium text-[#1e2a4a]">{item.name}</td>
                      <td className="py-3.5 px-4 text-gray-600 font-mono">{item.phone || "—"}</td>
                      <td className="py-3.5 px-4 text-gray-600 font-mono uppercase">{item.vehicleNumber || "—"}</td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(item)}
                            className="h-8 w-8 text-gray-500 hover:text-[#c4703f] hover:bg-orange-50"
                            title="Edit Transport"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(item.id)}
                            className="h-8 w-8 text-gray-500 hover:text-red-600 hover:bg-red-50"
                            title="Delete Transport"
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

      {/* Transport Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md bg-[#fbfaf7]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#1e2a4a]">
              {editingId ? "Edit Transport Details" : "Create New Transport Partner"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-[#1e2a4a]">Transport Name / Agency</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Speed Cargo Logistics"
                required
                className="bg-white border-[#dfd5c6] focus-visible:ring-[#c4703f]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-[#1e2a4a]">Contact Phone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="e.g. +91 9876543210"
                  className="bg-white border-[#dfd5c6] focus-visible:ring-[#c4703f]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vehicleNumber" className="text-[#1e2a4a]">Vehicle Number</Label>
                <Input
                  id="vehicleNumber"
                  value={form.vehicleNumber}
                  onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value })}
                  placeholder="e.g. DL-1CA-1234"
                  className="bg-white border-[#dfd5c6] focus-visible:ring-[#c4703f] uppercase"
                />
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
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Transport"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
