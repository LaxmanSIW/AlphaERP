import { useState, useEffect } from "react";
import { Plus, Search, Pencil, Trash2, FileText, Printer, ChevronLeft, ArrowLeft, Trash, Tag } from "lucide-react";
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

// Helper to convert number to Indian currency words
function numberToWords(num: number): string {
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function g(n: number): string {
    if (n < 20) return a[n];
    const digit = n % 10;
    return b[Math.floor(n / 10)] + (digit ? " " + a[digit] : "");
  }

  function h(n: number): string {
    if (n < 100) return g(n);
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    return a[hundred] + " Hundred" + (rest ? " " + g(rest) : "");
  }

  const amt = Math.floor(num);
  if (amt === 0) return "Zero Rupees Only";

  let str = "";
  let temp = amt;

  if (Math.floor(temp / 10000000) > 0) {
    str += h(Math.floor(temp / 10000000)) + " Crore ";
    temp %= 10000000;
  }
  if (Math.floor(temp / 100000) > 0) {
    str += h(Math.floor(temp / 100000)) + " Lakh ";
    temp %= 100000;
  }
  if (Math.floor(temp / 1000) > 0) {
    str += h(Math.floor(temp / 1000)) + " Thousand ";
    temp %= 1000;
  }
  if (temp > 0) {
    str += h(temp);
  }

  return "Rs. " + str.trim() + " Only";
}

interface BillItemInput {
  itemId: number;
  qty: number;
  discountPercent: number;
  listPrice?: number;
}

interface BillFormData {
  buyerId: number;
  billDate: string;
  dueDate: string | null;
  placeOfSupply: string;
  reverseCharge: "Yes" | "No";
  items: BillItemInput[];
  roundOff: number;
  transportId: number | null;
  parcel: number;
}

const emptyForm = (): BillFormData => ({
  buyerId: 0,
  billDate: new Date().toISOString().split("T")[0],
  dueDate: null,
  placeOfSupply: "Uttar Pradesh",
  reverseCharge: "No",
  items: [],
  roundOff: 0,
  transportId: null,
  parcel: 1,
});

export default function Bills() {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<"list" | "form" | "print">("list");
  const [selectedBillId, setSelectedBillId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<BillFormData>(emptyForm());

  // Nested item creation state
  const [newItemModalOpen, setNewItemModalOpen] = useState(false);
  const [newItemForm, setNewItemForm] = useState({
    name: "",
    hsnCode: "",
    listPrice: 0,
    unit: "Pcs.",
    taxPercent: 18,
  });

  const utils = trpc.useUtils();
  const { data: billsData, isLoading: billsLoading } = trpc.bill.list.useQuery();
  const { data: buyersData } = trpc.buyer.list.useQuery();
  const { data: itemsData } = trpc.item.list.useQuery();
  const { data: companyData } = trpc.settings.getCompany.useQuery();
  const { data: transportsData } = trpc.transport.list.useQuery();
  const transports = transportsData?.transports || [];

  const table = useTableState({
    data: billsData?.bills || [],
    searchFields: ["billNumber", "buyerName", "buyerGst"],
    defaultSortKey: "id",
    defaultSortDirection: "desc",
  });

  const createMutation = trpc.bill.create.useMutation({
    onSuccess: (res) => {
      utils.bill.list.invalidate();
      toast({ title: "Success", description: "Invoice created successfully" });
      if (res && res.id) {
        setSelectedBillId(res.id);
        setViewMode("print");
        setTimeout(() => {
          window.focus();
          window.print();
        }, 600);
      } else {
        setViewMode("list");
      }
      setForm(emptyForm());
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = trpc.bill.update.useMutation({
    onSuccess: (res) => {
      utils.bill.list.invalidate();
      toast({ title: "Success", description: "Invoice updated successfully" });
      if (res && res.id) {
        setSelectedBillId(res.id);
        setViewMode("print");
        setTimeout(() => {
          window.focus();
          window.print();
        }, 600);
      } else {
        setViewMode("list");
      }
      setEditingId(null);
      setForm(emptyForm());
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = trpc.bill.delete.useMutation({
    onSuccess: () => {
      utils.bill.list.invalidate();
      toast({ title: "Success", description: "Invoice deleted successfully" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createItemMutation = trpc.item.create.useMutation({
    onSuccess: (res) => {
      utils.item.list.invalidate();
      toast({ title: "Success", description: "New item added to catalog" });
      setNewItemModalOpen(false);
      // Auto-append the newly created item to the bill
      if (res.item) {
        handleAddLineItem(res.item.id, parseFloat(res.item.listPrice) || 0);
      }
      setNewItemForm({ name: "", hsnCode: "", listPrice: 0, unit: "Pcs.", taxPercent: 18 });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleCreateNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemForm.name.trim() || !newItemForm.hsnCode.trim()) {
      toast({ title: "Error", description: "All fields are required", variant: "destructive" });
      return;
    }
    createItemMutation.mutate(newItemForm);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setViewMode("form");
  };

  const openEdit = (bill: any) => {
    setEditingId(bill.id);
    setForm({
      buyerId: bill.buyerId,
      billDate: bill.billDate,
      dueDate: bill.dueDate,
      placeOfSupply: bill.placeOfSupply,
      reverseCharge: bill.reverseCharge,
      items: bill.items.map((it: any) => ({
        itemId: it.itemId,
        qty: it.qty,
        discountPercent: parseFloat(it.discountPercent) || 0,
        listPrice: parseFloat(it.listPrice) || 0,
      })),
      roundOff: parseFloat(bill.roundOff) || 0,
      transportId: bill.transportId || null,
      parcel: bill.parcel !== undefined ? (bill.parcel ?? 1) : 1,
    });
    setViewMode("form");
  };

  const openPrint = (billId: number) => {
    setSelectedBillId(billId);
    setViewMode("print");
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this invoice? This action is irreversible.")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleAddLineItem = (itemId: number, customPrice?: number) => {
    if (form.items.some((line) => line.itemId === itemId)) {
      toast({ title: "Duplicate Line", description: "This item is already in the invoice list." });
      return;
    }
    const catItem = itemsData?.items?.find((it: any) => it.id === itemId);
    const price = customPrice !== undefined ? customPrice : (catItem ? parseFloat(catItem.listPrice) || 0 : 0);
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { itemId, qty: 1, discountPercent: 0, listPrice: price }],
    }));
  };

  const handleUpdateLineItem = (index: number, key: keyof BillItemInput, value: number) => {
    const updated = [...form.items];
    updated[index] = { ...updated[index], [key]: value };
    setForm((prev) => ({ ...prev, items: updated }));
  };

  const handleRemoveLineItem = (index: number) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.buyerId === 0) {
      toast({ title: "Validation Error", description: "Please select a buyer", variant: "destructive" });
      return;
    }
    if (form.items.length === 0) {
      toast({ title: "Validation Error", description: "Please add at least one line item", variant: "destructive" });
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  // Perform dynamic, reactive computations for the currently edited bill
  const selectedBuyer = buyersData?.items?.find((b: any) => b.id === form.buyerId);
  const calculatedStats = () => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;

    const isInterState = !form.placeOfSupply.toLowerCase().includes("uttar pradesh") && !form.placeOfSupply.includes("09");

    form.items.forEach((line) => {
      const item = itemsData?.items?.find((it: any) => it.id === line.itemId);
      if (item) {
        const price = line.listPrice !== undefined ? line.listPrice : (parseFloat(item.listPrice) || 0);
        const gross = price * line.qty;
        const disc = gross * (line.discountPercent / 100);
        const taxable = gross - disc;
        const tax = taxable * ((parseFloat(item.taxPercent) || 0) / 100);

        subtotal += gross;
        totalDiscount += disc;
        totalTax += tax;

        if (isInterState) {
          igstTotal += tax;
        } else {
          cgstTotal += tax / 2;
          sgstTotal += tax / 2;
        }
      }
    });

    const netSubtotal = subtotal - totalDiscount;
    const rawTotal = netSubtotal + totalTax;
    const rounded = Math.round(rawTotal);
    const autoRoundOff = rounded - rawTotal;

    return {
      subtotal,
      totalDiscount,
      netSubtotal,
      cgstTotal,
      sgstTotal,
      igstTotal,
      totalTax,
      rawTotal,
      autoRoundOff,
      totalAmount: rounded,
    };
  };

  const stats = calculatedStats();

  // Find active print bill details
  const activePrintBill = billsData?.bills?.find((b: any) => b.id === selectedBillId);

  // Setup print command
  const triggerNativePrint = () => {
    window.print();
  };

  useEffect(() => {
    if (selectedBuyer) {
      setForm((prev) => ({
        ...prev,
        placeOfSupply: selectedBuyer.state || "Uttar Pradesh",
        transportId: selectedBuyer.defaultTransportId || prev.transportId || null,
      }));
    }
  }, [form.buyerId, selectedBuyer]);

  if (viewMode === "form") {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewMode("list")}
            className="h-9 w-9 border border-[#dfd5c6] text-[#1e2a4a] hover:bg-gray-100"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-[#1e2a4a]">
              {editingId ? "Edit Tax Invoice" : "Create Tax Invoice"}
            </h1>
            <p className="text-[#6b7280] text-sm">Add company details, buyer info, catalog products, and taxes.</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left side: Invoice Meta & Buyer */}
            <div className="lg:col-span-2 space-y-6">
              {/* Card 1: Header details */}
              <Card className="border-none shadow-sm bg-white p-5 rounded-xl space-y-4">
                <h3 className="font-semibold text-sm uppercase text-[#c4703f] tracking-wider border-b border-gray-100 pb-2">
                  Invoice Specifications
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[#1e2a4a]">Select Billing Buyer</Label>
                    <Select
                      value={String(form.buyerId)}
                      onValueChange={(val) => setForm((prev) => ({ ...prev, buyerId: parseInt(val) }))}
                    >
                      <SelectTrigger className="bg-white border-[#dfd5c6]">
                        <SelectValue placeholder="Choose Buyer..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {buyersData?.items?.map((b: any) => (
                          <SelectItem key={b.id} value={String(b.id)}>
                            {b.companyName} {b.gstNumber ? `(${b.gstNumber})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[#1e2a4a]">Place of Supply</Label>
                    <Input
                      value={form.placeOfSupply}
                      onChange={(e) => setForm((prev) => ({ ...prev, placeOfSupply: e.target.value }))}
                      placeholder="e.g. Uttar Pradesh"
                      className="bg-white border-[#dfd5c6]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[#1e2a4a]">Invoice Date</Label>
                    <Input
                      type="date"
                      value={form.billDate}
                      onChange={(e) => setForm((prev) => ({ ...prev, billDate: e.target.value }))}
                      className="bg-white border-[#dfd5c6]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[#1e2a4a]">Due Date</Label>
                    <Input
                      type="date"
                      value={form.dueDate || ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value || null }))}
                      className="bg-white border-[#dfd5c6]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[#1e2a4a]">Reverse Charge</Label>
                    <Select
                      value={form.reverseCharge}
                      onValueChange={(val: "Yes" | "No") => setForm((prev) => ({ ...prev, reverseCharge: val }))}
                    >
                      <SelectTrigger className="bg-white border-[#dfd5c6]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="No">No</SelectItem>
                        <SelectItem value="Yes">Yes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-100 pt-3">
                  <div className="space-y-1.5">
                    <Label className="text-[#1e2a4a]">Transport Partner</Label>
                    <Select
                      value={form.transportId ? String(form.transportId) : "NA"}
                      onValueChange={(val) => setForm((prev) => ({ ...prev, transportId: val === "NA" ? null : parseInt(val) }))}
                    >
                      <SelectTrigger className="bg-white border-[#dfd5c6]">
                        <SelectValue placeholder="Choose Transport..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="NA">NA (No Transport / Use Default)</SelectItem>
                        {transports.map((t: any) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {t.name} {t.vehicleNumber ? `(${t.vehicleNumber})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[#1e2a4a]">Parcel Quantity</Label>
                    <Input
                      type="number"
                      min="0"
                      value={form.parcel}
                      onChange={(e) => setForm((prev) => ({ ...prev, parcel: parseInt(e.target.value) || 0 }))}
                      className="bg-white border-[#dfd5c6]"
                    />
                  </div>
                </div>
              </Card>

              {/* Card 2: Invoice Line Items */}
              <Card className="border-none shadow-sm bg-white p-5 rounded-xl space-y-4">
                <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                  <h3 className="font-semibold text-sm uppercase text-[#c4703f] tracking-wider">
                    Line Item Details
                  </h3>
                  <div className="flex gap-2">
                    {/* Select Item Trigger Dropdown */}
                    <Select onValueChange={(val) => handleAddLineItem(parseInt(val))}>
                      <SelectTrigger className="w-[180px] h-8 text-xs bg-[#fbfaf7] border-[#dfd5c6]">
                        <SelectValue placeholder="Add Line Item..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white text-xs">
                        {itemsData?.items?.map((it: any) => (
                          <SelectItem key={it.id} value={String(it.id)}>
                            {it.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Quick Add New Catalog Item button */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setNewItemModalOpen(true)}
                      className="h-8 text-xs border-[#dfd5c6] text-[#c4703f] hover:bg-orange-50"
                    >
                      + Custom Item
                    </Button>
                  </div>
                </div>

                {form.items.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-sm">
                    No line items added yet. Click "Add Line Item" above to populate products.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 text-[#1e2a4a] pb-2 font-semibold">
                          <th className="py-2 pr-2">Sr.</th>
                          <th className="py-2">Item Description</th>
                          <th className="py-2 font-mono">HSN/SAC</th>
                          <th className="py-2 text-right">Qty</th>
                          <th className="py-2 pl-3">Unit</th>
                          <th className="py-2 text-right">List Price</th>
                          <th className="py-2 text-right">Disc %</th>
                          <th className="py-2 text-right">GST %</th>
                          <th className="py-2 text-right">Total (₹)</th>
                          <th className="py-2 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {form.items.map((line, idx) => {
                          const catItem = itemsData?.items?.find((it: any) => it.id === line.itemId);
                          if (!catItem) return null;

                          const price = line.listPrice !== undefined ? line.listPrice : (parseFloat(catItem.listPrice) || 0);
                          const gross = price * line.qty;
                          const disc = gross * (line.discountPercent / 100);
                          const taxRate = parseFloat(catItem.taxPercent) || 0;
                          const taxable = gross - disc;
                          const lineTax = taxable * (taxRate / 100);
                          const total = taxable + lineTax;

                          return (
                            <tr key={idx} className="hover:bg-gray-50/50">
                              <td className="py-3 pr-2 text-gray-500">{idx + 1}</td>
                              <td className="py-3 font-medium text-[#1e2a4a]">{catItem.name}</td>
                              <td className="py-3 font-mono text-gray-500">{catItem.hsnCode}</td>
                              <td className="py-3 text-right">
                                <Input
                                  type="number"
                                  min="1"
                                  value={line.qty}
                                  onChange={(e) => handleUpdateLineItem(idx, "qty", parseInt(e.target.value) || 1)}
                                  className="w-16 h-7 text-right p-1 text-xs border-[#dfd5c6] bg-white font-mono"
                                  id={`bill-qty-${idx}`}
                                />
                              </td>
                              <td className="py-3 pl-3 text-gray-500">{catItem.unit}</td>
                              <td className="py-3 text-right font-mono">
                                <div className="flex items-center justify-end gap-1">
                                  <span className="text-gray-400 text-[10px]">₹</span>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={line.listPrice !== undefined ? line.listPrice : price}
                                    onChange={(e) => handleUpdateLineItem(idx, "listPrice", parseFloat(e.target.value) || 0)}
                                    className="w-20 h-7 text-right p-1 text-xs border-[#dfd5c6] bg-white font-mono"
                                    id={`bill-price-${idx}`}
                                  />
                                </div>
                              </td>
                              <td className="py-3 text-right">
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={line.discountPercent}
                                  onChange={(e) => handleUpdateLineItem(idx, "discountPercent", parseFloat(e.target.value) || 0)}
                                  className="w-16 h-7 text-right p-1 text-xs border-[#dfd5c6] bg-white font-mono"
                                />
                              </td>
                              <td className="py-3 text-right font-mono text-gray-500">{catItem.taxPercent}%</td>
                              <td className="py-3 text-right font-semibold font-mono text-[#1e2a4a]">
                                ₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-3 text-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveLineItem(idx)}
                                  className="h-6 w-6 text-gray-400 hover:text-red-500"
                                >
                                  <Trash className="w-3.5 h-3.5" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>

            {/* Right side: Calculations / Totals panel */}
            <div className="space-y-6">
              <Card className="border-none shadow-sm bg-white p-5 rounded-xl space-y-4">
                <h3 className="font-semibold text-sm uppercase text-[#1e2a4a] tracking-wider border-b border-gray-100 pb-2">
                  Invoice Financial Summary
                </h3>

                <div className="space-y-3.5 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>Gross Subtotal:</span>
                    <span className="font-semibold font-mono text-[#1e2a4a]">₹{stats.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>Discount Deducted:</span>
                    <span className="font-semibold font-mono">-₹{stats.totalDiscount.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-dashed border-gray-100 my-1"></div>
                  <div className="flex justify-between">
                    <span>Net Taxable Amount:</span>
                    <span className="font-semibold font-mono text-[#1e2a4a]">₹{stats.netSubtotal.toFixed(2)}</span>
                  </div>

                  {stats.cgstTotal > 0 && (
                    <div className="flex justify-between text-gray-500 pl-3">
                      <span>CGST Total:</span>
                      <span className="font-mono">₹{stats.cgstTotal.toFixed(2)}</span>
                    </div>
                  )}
                  {stats.sgstTotal > 0 && (
                    <div className="flex justify-between text-gray-500 pl-3">
                      <span>SGST Total:</span>
                      <span className="font-mono">₹{stats.sgstTotal.toFixed(2)}</span>
                    </div>
                  )}
                  {stats.igstTotal > 0 && (
                    <div className="flex justify-between text-gray-500 pl-3">
                      <span>IGST Total:</span>
                      <span className="font-mono text-orange-600">₹{stats.igstTotal.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span>Total Tax (GST):</span>
                    <span className="font-semibold font-mono text-[#1e2a4a]">₹{stats.totalTax.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span>Manual / Auto Roundoff:</span>
                    <span className="font-mono text-gray-500 font-medium">₹{stats.autoRoundOff.toFixed(2)}</span>
                  </div>

                  <div className="border-t border-gray-200 pt-3 flex justify-between items-center text-sm font-bold text-[#1e2a4a]">
                    <span>Grand Total Due:</span>
                    <span className="text-[#c4703f] font-mono text-base">₹{stats.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>

                  <div className="text-[10px] text-gray-400 text-center leading-relaxed font-serif italic pt-2">
                    "{numberToWords(stats.totalAmount)}"
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 flex flex-col gap-2">
                  <Button
                    type="submit"
                    className="w-full bg-[#c4703f] hover:bg-[#b05e2f] text-white font-semibold"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {createMutation.isPending || updateMutation.isPending ? "Generating Invoice..." : editingId ? "Update Invoice" : "Generate Invoice"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setViewMode("list")}
                    className="w-full border-[#dfd5c6] hover:bg-gray-100 text-[#1e2a4a]"
                  >
                    Cancel / Go Back
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </form>

        {/* Nested Add Item Dialog */}
        <Dialog open={newItemModalOpen} onOpenChange={setNewItemModalOpen}>
          <DialogContent className="sm:max-w-md bg-[#fbfaf7]">
            <DialogHeader>
              <DialogTitle className="text-[#1e2a4a] font-bold">Quick Catalog Addition</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateNewItem} className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label htmlFor="nested-name">Item Name / Description</Label>
                <Input
                  id="nested-name"
                  value={newItemForm.name}
                  onChange={(e) => setNewItemForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Silk Shirt"
                  required
                  className="bg-white border-[#dfd5c6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="nested-hsn">HSN/SAC Code</Label>
                  <Input
                    id="nested-hsn"
                    value={newItemForm.hsnCode}
                    onChange={(e) => setNewItemForm((prev) => ({ ...prev, hsnCode: e.target.value }))}
                    placeholder="39231020"
                    required
                    className="bg-white border-[#dfd5c6]"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="nested-unit">Unit</Label>
                  <Select
                    value={newItemForm.unit}
                    onValueChange={(val) => setNewItemForm((prev) => ({ ...prev, unit: val }))}
                  >
                    <SelectTrigger className="bg-white border-[#dfd5c6]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="Pcs.">Pcs.</SelectItem>
                      <SelectItem value="Mtrs">Mtrs</SelectItem>
                      <SelectItem value="Kg">Kg</SelectItem>
                      <SelectItem value="Box">Box</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="nested-price">List Price (₹)</Label>
                  <Input
                    id="nested-price"
                    type="number"
                    step="0.01"
                    value={newItemForm.listPrice}
                    onChange={(e) => setNewItemForm((prev) => ({ ...prev, listPrice: parseFloat(e.target.value) || 0 }))}
                    required
                    className="bg-white border-[#dfd5c6]"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="nested-tax">GST Rate (%)</Label>
                  <Select
                    value={String(newItemForm.taxPercent)}
                    onValueChange={(val) => setNewItemForm((prev) => ({ ...prev, taxPercent: parseFloat(val) }))}
                  >
                    <SelectTrigger className="bg-white border-[#dfd5c6]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="0">0%</SelectItem>
                      <SelectItem value="5">5%</SelectItem>
                      <SelectItem value="12">12%</SelectItem>
                      <SelectItem value="18">18%</SelectItem>
                      <SelectItem value="28">28%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setNewItemModalOpen(false)}
                  className="border-[#dfd5c6]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-[#c4703f] hover:bg-[#b05e2f] text-white"
                  disabled={createItemMutation.isPending}
                >
                  {createItemMutation.isPending ? "Adding..." : "Add to Catalog & Invoice"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Visual TAX INVOICE Printable Render Mode
  if (viewMode === "print" && activePrintBill) {
    const totalWords = numberToWords(parseFloat(activePrintBill.totalAmount || "0"));
    const finalComp = {
      companyName: companyData?.companyName || "Alpha Wholesale",
      address: companyData?.address || "123 Commercial Belt, Sector 4, Noida, Uttar Pradesh",
      phone: companyData?.phone || "+91 9999999999",
      email: companyData?.email || "company@gmail.com",
      gstNumber: companyData?.gstNumber || "09AAAAA1234A1Z2",
      bankName: companyData?.bankName || "ICICI Bank",
      accountNumber: companyData?.accountNumber || "123456789",
      ifscCode: companyData?.ifscCode || "ICIC11222",
      branchName: companyData?.branchName || "Noida",
      authorizedSignatory: companyData?.authorizedSignatory || "Add Name",
      terms: companyData?.terms || [
        "1. Goods once sold will not be taken back.",
        "2. Interest @ 18% p.a. will be charged if the payment for Company Name is not made within the stipulated time.",
        "3. Subject to 'Delhi' Jurisdiction only."
      ]
    };

    return (
      <div className="space-y-6">
        {/* Actions bar - hidden during native print */}
        <div className="flex justify-between items-center print:hidden bg-white p-4 rounded-xl border border-[#ebdcc5]/40 shadow-sm">
          <Button
            variant="ghost"
            onClick={() => setViewMode("list")}
            className="border border-[#dfd5c6] text-[#1e2a4a] hover:bg-gray-100"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Back to List
          </Button>
          <Button
            onClick={triggerNativePrint}
            className="bg-[#c4703f] hover:bg-[#b05e2f] text-white flex items-center gap-1.5 font-semibold"
          >
            <Printer className="w-4 h-4" /> Print / Save PDF
          </Button>
        </div>

        {/* Printable Tax Invoice Frame */}
        <div className="bg-white text-black p-6 md:p-8 rounded-xl shadow-lg border border-gray-300 max-w-[850px] mx-auto print:border-none print:shadow-none print:p-0 print:m-0 font-sans leading-tight">
          {/* Printable CSS Injection */}
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              body * {
                visibility: hidden;
              }
              aside, header, nav, .print\\:hidden {
                display: none !important;
              }
              .print-container, .print-container * {
                visibility: visible;
              }
              .print-container {
                position: absolute;
                left: 0;
                top: 0;
                width: 100% !important;
                max-width: 100% !important;
                padding: 0px !important;
                margin: 0px !important;
                font-size: 11px !important;
                line-height: 1.2 !important;
              }
              th, td {
                padding: 4px 6px !important;
              }
            }
          ` }} />

          <div className="print-container space-y-4">
            {/* Header: TAX INVOICE */}
            <div className="flex justify-between items-center border-b-2 border-black pb-2">
              <span className="text-xs font-mono font-bold">Page No. 1 of 1</span>
              <h1 className="text-lg font-bold uppercase tracking-wider text-center">TAX INVOICE</h1>
              <span className="text-xs font-mono font-bold">Original Copy</span>
            </div>

            {/* Company Block */}
            <div className="text-center space-y-1">
              <h2 className="text-xl font-black tracking-tight uppercase">{finalComp.companyName}</h2>
              <p className="text-xs font-medium text-gray-700">{finalComp.address}</p>
              <p className="text-xs text-gray-700 font-mono">
                Mobile: {finalComp.phone} | Email: {finalComp.email}
              </p>
              <p className="text-xs font-bold tracking-wider uppercase font-mono">
                GSTIN - {finalComp.gstNumber}
              </p>
            </div>

            {/* Specifications Matrix */}
            <div className="grid grid-cols-2 border border-black text-xs">
              <div className="p-2 border-r border-black space-y-1">
                <div className="flex"><span className="w-28 font-bold">Invoice Number</span><span>: {activePrintBill.billNumber}</span></div>
                <div className="flex"><span className="w-28 font-bold">Invoice Date</span><span>: {activePrintBill.billDate ? new Date(activePrintBill.billDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) : "N/A"}</span></div>
                {activePrintBill.dueDate && (
                  <div className="flex"><span className="w-28 font-bold">Due Date</span><span>: {new Date(activePrintBill.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}</span></div>
                )}
                <div className="flex"><span className="w-28 font-bold">Place of Supply</span><span>: {activePrintBill.placeOfSupply}</span></div>
                <div className="flex"><span className="w-28 font-bold">Reverse Charge</span><span>: {activePrintBill.reverseCharge}</span></div>
                {activePrintBill.transportName && activePrintBill.transportName !== "NA" && (
                  <div className="flex"><span className="w-28 font-bold">Transport Partner</span><span>: {activePrintBill.transportName}</span></div>
                )}
              </div>
              <div className="p-2 space-y-1.5">
                <h4 className="font-bold border-b border-gray-300 pb-0.5">Billing & Shipping Details</h4>
                <div className="text-xs font-bold">{activePrintBill.buyerName}</div>
                {activePrintBill.buyerAddress && <div className="text-gray-700">{activePrintBill.buyerAddress}</div>}
                <div className="font-mono text-xs">
                  {activePrintBill.buyerGst && <span className="font-bold mr-3">GSTIN: {activePrintBill.buyerGst}</span>}
                  {activePrintBill.buyerPhone && <span>Mobile: {activePrintBill.buyerPhone}</span>}
                </div>
              </div>
            </div>

            {/* Items table */}
            <div className="border border-black overflow-hidden">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b border-black text-[11px] font-bold">
                    <th className="py-1 px-2 border-r border-black w-8 text-center">Sr.</th>
                    <th className="py-1 px-2 border-r border-black">Item Description</th>
                    <th className="py-1 px-2 border-r border-black w-20 text-center">HSN/SAC</th>
                    <th className="py-1 px-2 border-r border-black w-10 text-right">Qty</th>
                    <th className="py-1 px-2 border-r border-black w-10">Unit</th>
                    <th className="py-1 px-2 border-r border-black w-16 text-right">List Price</th>
                    <th className="py-1 px-2 border-r border-black w-14 text-right">Disc. %</th>
                    <th className="py-1 px-2 border-r border-black w-16 text-right">CGST</th>
                    <th className="py-1 px-2 border-r border-black w-16 text-right">SGST</th>
                    <th className="py-1 px-2 border-r border-black w-16 text-right">IGST</th>
                    <th className="py-1 px-2 text-right w-20">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300">
                  {(activePrintBill.items || []).map((it: any, index: number) => {
                    const isInterState = !(activePrintBill.placeOfSupply || "").toLowerCase().includes("uttar pradesh") && !(activePrintBill.placeOfSupply || "").includes("09");
                    const price = parseFloat(it.listPrice || "0");
                    const qty = parseFloat(it.qty || "0");
                    const gross = price * qty;
                    const discountPercent = parseFloat(it.discountPercent || "0");
                    const discAmount = gross * (discountPercent / 100);
                    const taxable = gross - discAmount;
                    const taxPercent = parseFloat(it.taxPercent || "0");
                    const taxAmount = taxable * (taxPercent / 100);

                    const cgstPct = isInterState ? 0 : taxPercent / 2;
                    const cgstAmt = isInterState ? 0 : taxAmount / 2;

                    const sgstPct = isInterState ? 0 : taxPercent / 2;
                    const sgstAmt = isInterState ? 0 : taxAmount / 2;

                    const igstPct = isInterState ? taxPercent : 0;
                    const igstAmt = isInterState ? taxAmount : 0;

                    return (
                      <tr key={index} className="text-[11px]">
                        <td className="py-1 px-2 border-r border-black text-center font-mono">{index + 1}</td>
                        <td className="py-1 px-2 border-r border-black font-medium">{it.name}</td>
                        <td className="py-1 px-2 border-r border-black text-center font-mono">{it.hsnCode}</td>
                        <td className="py-1 px-2 border-r border-black text-right font-mono">{it.qty}.00</td>
                        <td className="py-1 px-2 border-r border-black">{it.unit}</td>
                        <td className="py-1 px-2 border-r border-black text-right font-mono">₹{price.toFixed(2)}</td>
                        <td className="py-1 px-2 border-r border-black text-right font-mono">{discountPercent.toFixed(1)}%</td>
                        <td className="py-1 px-2 border-r border-black text-right font-mono">
                          {cgstAmt > 0 ? `${cgstPct}% (₹${cgstAmt.toFixed(2)})` : "—"}
                        </td>
                        <td className="py-1 px-2 border-r border-black text-right font-mono">
                          {sgstAmt > 0 ? `${sgstPct}% (₹${sgstAmt.toFixed(2)})` : "—"}
                        </td>
                        <td className="py-1 px-2 border-r border-black text-right font-mono">
                          {igstAmt > 0 ? `${igstPct}% (₹${igstAmt.toFixed(2)})` : "—"}
                        </td>
                        <td className="py-1 px-2 text-right font-semibold font-mono">₹{parseFloat(it.amount || "0").toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    );
                  })}
                  {/* Fill empty spaces to maintain structural density */}
                  {(activePrintBill.items || []).length < 5 && Array.from({ length: 5 - (activePrintBill.items || []).length }).map((_, i) => (
                    <tr key={`empty-${i}`} className="h-6 text-[11px]">
                      <td className="py-1 px-2 border-r border-black"></td>
                      <td className="py-1 px-2 border-r border-black"></td>
                      <td className="py-1 px-2 border-r border-black"></td>
                      <td className="py-1 px-2 border-r border-black"></td>
                      <td className="py-1 px-2 border-r border-black"></td>
                      <td className="py-1 px-2 border-r border-black"></td>
                      <td className="py-1 px-2 border-r border-black"></td>
                      <td className="py-1 px-2 border-r border-black"></td>
                      <td className="py-1 px-2 border-r border-black"></td>
                      <td className="py-1 px-2 border-r border-black"></td>
                      <td className="py-1 px-2 text-right"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total Financial Section */}
            <div className="border border-black grid grid-cols-3 text-xs">
              <div className="col-span-2 p-2 border-r border-black flex flex-col justify-between">
                <div>
                  <h4 className="font-bold uppercase tracking-wider text-gray-700 text-[10px] mb-1 border-b border-gray-200">Amount Charged in Words</h4>
                  <p className="font-serif italic font-semibold text-xs text-gray-900">
                    {totalWords}
                  </p>
                </div>
                {parseFloat(activePrintBill.discountAmount || "0") > 0 && (
                  <div className="text-green-700 font-medium font-mono text-[11px] pt-1 mt-2 border-t border-dashed border-gray-200">
                    * Total Discount saved on this invoice: ₹{parseFloat(activePrintBill.discountAmount || "0").toFixed(2)}
                  </div>
                )}
              </div>
              <div className="p-2 space-y-1 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span>Gross Subtotal:</span>
                  <span>₹{parseFloat(activePrintBill.subtotal || "0").toFixed(2)}</span>
                </div>
                {parseFloat(activePrintBill.discountAmount || "0") > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Discount:</span>
                    <span>-₹{parseFloat(activePrintBill.discountAmount || "0").toFixed(2)}</span>
                  </div>
                )}
                {parseFloat(activePrintBill.cgstAmount || "0") > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>CGST:</span>
                    <span>₹{parseFloat(activePrintBill.cgstAmount || "0").toFixed(2)}</span>
                  </div>
                )}
                {parseFloat(activePrintBill.sgstAmount || "0") > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>SGST:</span>
                    <span>₹{parseFloat(activePrintBill.sgstAmount || "0").toFixed(2)}</span>
                  </div>
                )}
                {parseFloat(activePrintBill.igstAmount || "0") > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span>IGST:</span>
                    <span>₹{parseFloat(activePrintBill.igstAmount || "0").toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-300 pt-1">
                  <span>Round Off:</span>
                  <span>₹{parseFloat(activePrintBill.roundOff || "0").toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t-2 border-black pt-1 font-bold text-xs text-black">
                  <span>Total Amount:</span>
                  <span>₹{parseFloat(activePrintBill.totalAmount || "0").toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Parcel Details Row */}
            <div className="border-l border-r border-b border-black p-2 flex justify-between items-center text-xs bg-[#fdfcfb]">
              <div className="flex items-center gap-1.5">
                <span className="font-bold uppercase tracking-wider text-[10px] text-gray-700">Parcel Qty:</span>
                <span className="font-mono font-bold text-xs bg-orange-100/50 px-2 py-0.5 rounded text-orange-800 border border-orange-200">
                  {activePrintBill.parcel !== undefined ? (activePrintBill.parcel ?? 1) : 1}
                </span>
              </div>
              {activePrintBill.transportName && activePrintBill.transportName !== "N/A" && (
                <div className="text-[10px] text-gray-600 font-mono">
                  <span className="font-semibold text-black uppercase text-[9px] mr-1">Transport:</span>
                  {activePrintBill.transportName}
                </div>
              )}
            </div>

            {/* Terms, Settlement bank, and Signature Footer */}
            <div className="grid grid-cols-3 border-l border-r border-b border-black text-xs">
              <div className="col-span-2 p-2 border-r border-black space-y-1">
                <h4 className="font-bold border-b border-gray-200 pb-0.5 uppercase tracking-wider text-[10px]">Terms and Conditions</h4>
                <ul className="list-none space-y-0.5 text-[10px] text-gray-600 font-serif leading-relaxed">
                  {(finalComp.terms || []).map((term: string, i: number) => (
                    <li key={i}>{term}</li>
                  ))}
                </ul>
              </div>
              <div className="p-2 space-y-1">
                <h4 className="font-bold border-b border-gray-200 pb-0.5 uppercase tracking-wider text-[10px]">Settlement Account</h4>
                <div className="text-[10px] font-mono text-gray-700 leading-tight space-y-0.5">
                  <div><span className="font-bold text-black">Bank:</span> {finalComp.bankName}</div>
                  <div><span className="font-bold text-black">A/c:</span> {finalComp.accountNumber}</div>
                  <div><span className="font-bold text-black">IFSC:</span> {finalComp.ifscCode}</div>
                  <div><span className="font-bold text-black">Branch:</span> {finalComp.branchName}</div>
                  <div className="pt-1"><span className="font-bold text-black">Name:</span> {finalComp.authorizedSignatory}</div>
                </div>
              </div>
            </div>

            {/* Signature Block */}
            <div className="flex justify-between items-end pt-8 px-2 text-xs">
              <span className="text-gray-400 font-mono text-[9px]">Invoice Created via Alpha Wholesale ERP</span>
              <div className="text-center w-52 border-t border-black pt-1">
                <p className="text-[10px] font-bold">Authorized Signatory</p>
                <p className="text-[10px] text-gray-500 italic mt-1">For {finalComp.companyName}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // LIST MODE (Main Dashboard)
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1e2a4a] flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#c4703f]" /> Tax Invoices
          </h1>
          <p className="text-[#6b7280] text-sm">Create and print legal tax bills split with dynamic CGST, SGST, and IGST.</p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-[#c4703f] hover:bg-[#b05e2f] text-white font-semibold self-end sm:self-auto"
        >
          <Plus className="w-4 h-4 mr-1.5" /> New Bill
        </Button>
      </div>

      {/* Main Dashboard Grid */}
      <Card className="border-none shadow-sm bg-white overflow-hidden rounded-xl">
        <CardContent className="p-0">
          {/* Filters Bar */}
          <div className="p-4 border-b border-[#ebdcc5]/40 bg-[#fbfaf7] flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by Bill No, Buyer, GSTIN..."
                value={table.search}
                onChange={(e) => table.setSearch(e.target.value)}
                className="pl-9 bg-white border-[#dfd5c6] focus-visible:ring-[#c4703f]"
              />
            </div>
            <div className="text-xs text-gray-500 font-mono">
              Total Invoices: {table.totalFiltered}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f0e8dc] text-[#1e2a4a] text-xs uppercase font-semibold">
                  <SortableHeader
                    label="Bill Number"
                    sortKey="billNumber"
                    currentSortKey={table.sortConfig?.key as string}
                    sortDirection={table.sortConfig?.direction || null}
                    onSort={table.handleSort}
                  />
                  <SortableHeader
                    label="Date"
                    sortKey="billDate"
                    currentSortKey={table.sortConfig?.key as string}
                    sortDirection={table.sortConfig?.direction || null}
                    onSort={table.handleSort}
                  />
                  <SortableHeader
                    label="Buyer Company"
                    sortKey="buyerName"
                    currentSortKey={table.sortConfig?.key as string}
                    sortDirection={table.sortConfig?.direction || null}
                    onSort={table.handleSort}
                  />
                  <SortableHeader
                    label="GSTIN"
                    sortKey="buyerGst"
                    currentSortKey={table.sortConfig?.key as string}
                    sortDirection={table.sortConfig?.direction || null}
                    onSort={table.handleSort}
                  />
                  <SortableHeader
                    label="Invoice Total"
                    sortKey="totalAmount"
                    currentSortKey={table.sortConfig?.key as string}
                    sortDirection={table.sortConfig?.direction || null}
                    onSort={table.handleSort}
                    align="right"
                  />
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ebdcc5]/20 text-sm">
                {billsLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-400">
                      Loading bills from database...
                    </td>
                  </tr>
                ) : table.filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-400">
                      No tax invoices generated yet. Click "New Bill" to create your first bill!
                    </td>
                  </tr>
                ) : (
                  table.filteredData.map((bill: any) => (
                    <tr key={bill.id} className="hover:bg-[#fbf9f5] transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-[#1e2a4a] font-mono">{bill.billNumber}</td>
                      <td className="py-3.5 px-4 text-gray-600">
                        {new Date(bill.billDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-[#1e2a4a]">{bill.buyerName}</td>
                      <td className="py-3.5 px-4 font-mono text-xs text-gray-500">{bill.buyerGst || "N/A"}</td>
                      <td className="py-3.5 px-4 text-right font-black font-mono text-[#c4703f]">
                        ₹{parseFloat(bill.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openPrint(bill.id)}
                            className="h-8 w-8 text-gray-500 hover:text-green-600 hover:bg-green-50"
                            title="View / Print Tax Invoice"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(bill)}
                            className="h-8 w-8 text-gray-500 hover:text-[#c4703f] hover:bg-orange-50"
                            title="Edit Invoice"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(bill.id)}
                            className="h-8 w-8 text-gray-500 hover:text-red-600 hover:bg-red-50"
                            title="Delete Invoice"
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
    </div>
  );
}
