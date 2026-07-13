import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import Papa from "papaparse";
import {
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  X,
  FileSpreadsheet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { useToast } from "@/hooks/use-toast";

interface CsvRow {
  buyer_name: string;
  book_type: string;
  transaction_date: string;
  due_date?: string;
  transaction_type: string;
  quantity: string;
  amount: string;
  check_number?: string;
  include_in_reporting?: string;
}

interface ParsedRow extends CsvRow {
  rowNumber: number;
  errors: string[];
  isValid: boolean;
}

const templateHeaders = [
  "buyer_name",
  "book_type",
  "transaction_date",
  "due_date",
  "transaction_type",
  "quantity",
  "amount",
  "check_number",
  "include_in_reporting",
];

const templateExample = [
  {
    buyer_name: "Sharma Garments Pvt Ltd",
    book_type: "CC",
    transaction_date: "26/07/2026",
    due_date: "25/08/2026",
    transaction_type: "Sale",
    quantity: "50",
    amount: "5000.00",
    check_number: "CHQ123456",
    include_in_reporting: "TRUE",
  },
  {
    buyer_name: "Gupta Textile Traders",
    book_type: "CS",
    transaction_date: "26/07/2026",
    due_date: "",
    transaction_type: "Payment_Received",
    quantity: "0",
    amount: "3500.00",
    check_number: "",
    include_in_reporting: "TRUE",
  },
];

export default function BulkUpload() {
  const { toast } = useToast();
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const utils = trpc.useUtils();

  const bulkCreateMutation = trpc.transaction.bulkCreate.useMutation({
    onSuccess: (result) => {
      setImportResult(result);
      utils.transaction.list.invalidate();
      utils.dashboard.stats.invalidate();
      utils.buyer.list.invalidate();
      toast({
        title: "Import Complete",
        description: `${result.imported} transactions imported, ${result.newBuyers} new buyers created`,
      });
      setImporting(false);
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setImporting(false);
    },
  });

  const downloadTemplate = () => {
    const csv = Papa.unparse({
      fields: templateHeaders,
      data: templateExample,
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "alpha-transaction-template.csv";
    a.click();
  };

  const validateRow = (row: CsvRow, rowNumber: number): ParsedRow => {
    const errors: string[] = [];

    if (!row.buyer_name?.trim()) errors.push("Buyer name is required");
    if (!row.book_type || !["CC", "CS"].includes(row.book_type.toUpperCase())) {
      errors.push("Book type must be CC or CS");
    }
    if (!row.transaction_date?.trim()) errors.push("Transaction date is required");
    if (!row.transaction_type || !["Sale", "Payment_Received"].includes(row.transaction_type)) {
      errors.push("Transaction type must be Sale or Payment_Received");
    }
    const amount = parseFloat(row.amount);
    if (isNaN(amount) || amount <= 0) errors.push("Amount must be a positive number");

    const isSale = row.transaction_type === "Sale";
    const qty = parseInt(row.quantity) || 0;
    if (isSale && qty <= 0) errors.push("Quantity is required for sales");

    return {
      ...row,
      rowNumber,
      errors,
      isValid: errors.length === 0,
    };
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setFileName(file.name);
    setImportResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows: ParsedRow[] = results.data.map((row: any, index: number) =>
          validateRow(row, index + 2) // +2 because row 1 is header
        );
        setParsedRows(rows);
      },
      error: (err) => {
        toast({ title: "Parse Error", description: err.message, variant: "destructive" });
      },
    });
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    multiple: false,
  });

  const handleImport = () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      toast({ title: "No valid rows", description: "Please fix errors before importing", variant: "destructive" });
      return;
    }

    setImporting(true);
    const transactions = validRows.map((row) => ({
      buyerName: row.buyer_name.trim(),
      bookType: row.book_type.toUpperCase() as "CC" | "CS",
      transactionDate: row.transaction_date.trim(),
      dueDate: row.due_date?.trim() || undefined,
      transactionType: row.transaction_type as "Sale" | "Payment_Received",
      quantity: parseInt(row.quantity) || 0,
      amount: parseFloat(row.amount),
      checkNumber: row.check_number?.trim() || undefined,
      includeInReporting: row.include_in_reporting?.toUpperCase() !== "FALSE",
    }));

    bulkCreateMutation.mutate({ transactions });
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1e2a4a]">Bulk Upload</h1>
          <p className="text-sm text-[#3d4f6f] mt-1">Import multiple transactions via CSV</p>
        </div>
      </div>

      {/* Template Download */}
      <Card className="border-[#d9cfc0] bg-white">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-[#1e2a4a]">Step 1: Download Template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[#3d4f6f]">
            Download the CSV template file and fill in your transaction data. Ensure all required fields are completed.
          </p>

          {/* Field Reference Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#f5f0e8] border-b border-[#e8e0d4]">
                  <th className="text-left py-2 px-3 font-semibold">Column</th>
                  <th className="text-left py-2 px-3 font-semibold">Required</th>
                  <th className="text-left py-2 px-3 font-semibold">Format</th>
                  <th className="text-left py-2 px-3 font-semibold">Example</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#f5f0e8]"><td className="py-1.5 px-3 font-mono">buyer_name</td><td className="py-1.5 px-3 text-red-600 font-semibold">Yes</td><td className="py-1.5 px-3">Text</td><td className="py-1.5 px-3 font-mono">ABC Garments</td></tr>
                <tr className="border-b border-[#f5f0e8]"><td className="py-1.5 px-3 font-mono">book_type</td><td className="py-1.5 px-3 text-red-600 font-semibold">Yes</td><td className="py-1.5 px-3">CC or CS</td><td className="py-1.5 px-3 font-mono">CC</td></tr>
                <tr className="border-b border-[#f5f0e8]"><td className="py-1.5 px-3 font-mono">transaction_date</td><td className="py-1.5 px-3 text-red-600 font-semibold">Yes</td><td className="py-1.5 px-3">DD/MM/YYYY</td><td className="py-1.5 px-3 font-mono">26/07/2026</td></tr>
                <tr className="border-b border-[#f5f0e8]"><td className="py-1.5 px-3 font-mono">due_date</td><td className="py-1.5 px-3 text-[#3d4f6f]">No</td><td className="py-1.5 px-3">DD/MM/YYYY</td><td className="py-1.5 px-3 font-mono">25/08/2026</td></tr>
                <tr className="border-b border-[#f5f0e8]"><td className="py-1.5 px-3 font-mono">transaction_type</td><td className="py-1.5 px-3 text-red-600 font-semibold">Yes</td><td className="py-1.5 px-3">Sale or Payment_Received</td><td className="py-1.5 px-3 font-mono">Sale</td></tr>
                <tr className="border-b border-[#f5f0e8]"><td className="py-1.5 px-3 font-mono">quantity</td><td className="py-1.5 px-3 text-[#3d4f6f]">For Sales</td><td className="py-1.5 px-3">Number</td><td className="py-1.5 px-3 font-mono">50</td></tr>
                <tr className="border-b border-[#f5f0e8]"><td className="py-1.5 px-3 font-mono">amount</td><td className="py-1.5 px-3 text-red-600 font-semibold">Yes</td><td className="py-1.5 px-3">Decimal</td><td className="py-1.5 px-3 font-mono">5000.00</td></tr>
                <tr className="border-b border-[#f5f0e8]"><td className="py-1.5 px-3 font-mono">check_number</td><td className="py-1.5 px-3 text-[#3d4f6f]">No</td><td className="py-1.5 px-3">Text</td><td className="py-1.5 px-3 font-mono">CHQ123456</td></tr>
                <tr className="border-b border-[#f5f0e8]"><td className="py-1.5 px-3 font-mono">include_in_reporting</td><td className="py-1.5 px-3 text-[#3d4f6f]">No</td><td className="py-1.5 px-3">TRUE or FALSE</td><td className="py-1.5 px-3 font-mono">TRUE</td></tr>
              </tbody>
            </table>
          </div>

          <Button onClick={downloadTemplate} variant="outline" className="border-[#c4703f] text-[#c4703f] hover:bg-[#c4703f]/10">
            <Download className="w-4 h-4 mr-2" />
            Download CSV Template
          </Button>
        </CardContent>
      </Card>

      {/* Upload Zone */}
      {!importResult && (
        <Card className="border-[#d9cfc0] bg-white">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-[#1e2a4a]">Step 2: Upload CSV File</CardTitle>
          </CardHeader>
          <CardContent>
            {!fileName ? (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl h-[200px] flex flex-col items-center justify-center cursor-pointer transition-colors ${
                  isDragActive
                    ? "border-[#c4703f] bg-[#c4703f]/5"
                    : "border-[#d9cfc0] hover:border-[#c4703f]/50 hover:bg-[#f5f0e8]/50"
                }`}
              >
                <input {...getInputProps()} />
                <Upload className={`w-12 h-12 mb-3 ${isDragActive ? "text-[#c4703f]" : "text-[#d9cfc0]"}`} />
                <p className="text-sm text-[#1e2a4a] font-medium">
                  {isDragActive ? "Drop the CSV file here" : "Drag & drop your CSV file here"}
                </p>
                <p className="text-xs text-[#3d4f6f] mt-1">or click to browse</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-[#f5f0e8] rounded-lg">
                  <FileSpreadsheet className="w-8 h-8 text-green-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#1e2a4a]">{fileName}</p>
                    <p className="text-xs text-[#3d4f6f]">{parsedRows.length} rows found</p>
                  </div>
                  <button onClick={() => { setFileName(""); setParsedRows([]); }} className="p-1.5 rounded hover:bg-[#e8e0d4] transition-colors">
                    <X className="w-4 h-4 text-[#3d4f6f]" />
                  </button>
                </div>

                {/* Validation Summary */}
                {parsedRows.length > 0 && (
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-700 font-medium">{validCount} valid</span>
                    </div>
                    {invalidCount > 0 && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <span className="text-sm text-red-700 font-medium">{invalidCount} invalid</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Preview Table */}
                {parsedRows.length > 0 && (
                  <div className="overflow-x-auto max-h-[400px]">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0">
                        <tr className="bg-[#f5f0e8] border-b border-[#e8e0d4]">
                          <th className="text-left py-2 px-2 font-semibold">Row</th>
                          <th className="text-left py-2 px-2 font-semibold">Buyer</th>
                          <th className="text-left py-2 px-2 font-semibold">Book</th>
                          <th className="text-left py-2 px-2 font-semibold">Date</th>
                          <th className="text-left py-2 px-2 font-semibold">Type</th>
                          <th className="text-right py-2 px-2 font-semibold">Qty</th>
                          <th className="text-right py-2 px-2 font-semibold">Amount</th>
                          <th className="text-left py-2 px-2 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.slice(0, 20).map((row) => (
                          <tr key={row.rowNumber} className={`border-b border-[#f5f0e8] ${!row.isValid ? "bg-red-50" : ""}`}>
                            <td className="py-2 px-2 font-mono text-[#3d4f6f]">{row.rowNumber}</td>
                            <td className="py-2 px-2 font-medium text-[#1e2a4a]">{row.buyer_name}</td>
                            <td className="py-2 px-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${row.book_type?.toUpperCase() === "CC" ? "bg-blue-100 text-blue-700" : row.book_type?.toUpperCase() === "CS" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                                {row.book_type?.toUpperCase() || "?"}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-[#3d4f6f]">{row.transaction_date}</td>
                            <td className="py-2 px-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${row.transaction_type === "Sale" ? "bg-red-100 text-red-700" : row.transaction_type === "Payment_Received" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                                {row.transaction_type || "?"}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-right font-mono">{row.quantity}</td>
                            <td className="py-2 px-2 text-right font-mono">{row.amount}</td>
                            <td className="py-2 px-2">
                              {row.isValid ? (
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                              ) : (
                                <div className="flex items-center gap-1 text-red-600">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span className="text-[10px]">{row.errors[0]}</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {parsedRows.length > 20 && (
                      <p className="text-xs text-[#3d4f6f] text-center py-2">
                        Showing first 20 of {parsedRows.length} rows
                      </p>
                    )}
                  </div>
                )}

                {validCount > 0 && (
                  <Button
                    onClick={handleImport}
                    disabled={importing}
                    className="bg-[#c4703f] hover:bg-[#a85d32] text-white w-full"
                  >
                    {importing ? "Importing..." : `Import ${validCount} Valid Rows`}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Import Results */}
      {importResult && (
        <Card className="border-green-300 bg-green-50">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-green-800 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Import Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{importResult.imported}</p>
                <p className="text-xs text-[#3d4f6f]">Transactions Imported</p>
              </div>
              <div className="bg-white rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{importResult.newBuyers}</p>
                <p className="text-xs text-[#3d4f6f]">New Buyers Created</p>
              </div>
              <div className="bg-white rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-red-600">{importResult.failed}</p>
                <p className="text-xs text-[#3d4f6f]">Failed Imports</p>
              </div>
            </div>
            {importResult.errors?.length > 0 && (
              <div className="bg-white rounded-lg p-4">
                <p className="text-sm font-medium text-red-600 mb-2">Errors:</p>
                <div className="space-y-1 max-h-[150px] overflow-y-auto">
                  {importResult.errors.map((err: any, idx: number) => (
                    <p key={idx} className="text-xs text-red-600">Row {err.row}: {err.message}</p>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setImportResult(null); setFileName(""); setParsedRows([]); }} className="border-[#d9cfc0]">
                Upload Another File
              </Button>
              <Button onClick={() => window.location.href = "/transactions"} className="bg-[#c4703f] hover:bg-[#a85d32] text-white">
                View Transactions
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
