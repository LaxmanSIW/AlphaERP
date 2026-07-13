import { useMemo, useState } from "react";
import { AlertTriangle, RefreshCw, BookOpen, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/providers/trpc";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { toast } = useToast();
  const [resettingBuyer, setResettingBuyer] = useState(false);
  const [resettingTransaction, setResettingTransaction] = useState(false);

  const summaryQuery = trpc.settings.summary.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const resetBuyerMutation = trpc.settings.resetBuyerIds.useMutation({
    onSuccess: (data) => {
      setResettingBuyer(false);
      toast({ title: "Buyer IDs reset", description: `Next buyer ID is now ${data.nextBuyerId}` });
      void summaryQuery.refetch();
    },
    onError: (err) => {
      setResettingBuyer(false);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
  const resetTransactionMutation = trpc.settings.resetTransactionIds.useMutation({
    onSuccess: (data) => {
      setResettingTransaction(false);
      toast({ title: "Transaction IDs reset", description: `Next transaction ID is now ${data.nextTransactionId}` });
      void summaryQuery.refetch();
    },
    onError: (err) => {
      setResettingTransaction(false);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const summary = useMemo(() => summaryQuery.data ?? { buyerCount: 0, transactionCount: 0, nextBuyerId: 1, nextTransactionId: 1 }, [summaryQuery.data]);

  return (
    <div className="min-h-screen bg-[#f5f0e8] p-4 lg:p-6 text-[#1e2a4a]">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl border border-[#d9cfc0] bg-white/80 p-6 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
              <p className="text-sm text-[#3d4f6f]">Reset sequential IDs for buyers and transactions based on the current maximum record ID.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-[#d9cfc0] shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#1e2a4a]">
                <Users className="h-5 w-5 text-[#c4703f]" />
                Buyer ID counter
              </CardTitle>
              <CardDescription>Recompute the next buyer ID from the highest existing buyer record.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-[#d9cfc0] bg-[#f5f0e8] p-4 text-sm text-[#3d4f6f]">
                <p><span className="font-medium text-[#1e2a4a]">Current buyer count:</span> {summary.buyerCount}</p>
                <p><span className="font-medium text-[#1e2a4a]">Next buyer ID:</span> {summary.nextBuyerId}</p>
              </div>
              <Button
                className="w-full bg-[#c4703f] hover:bg-[#a85d32] text-white"
                onClick={() => {
                  setResettingBuyer(true);
                  resetBuyerMutation.mutate();
                }}
                disabled={resettingBuyer || resetBuyerMutation.isPending}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {resettingBuyer || resetBuyerMutation.isPending ? "Resetting..." : "Reset buyer IDs"}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-[#d9cfc0] shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#1e2a4a]">
                <BookOpen className="h-5 w-5 text-[#c4703f]" />
                Transaction ID counter
              </CardTitle>
              <CardDescription>Recompute the next transaction ID from the highest existing transaction record.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-[#d9cfc0] bg-[#f5f0e8] p-4 text-sm text-[#3d4f6f]">
                <p><span className="font-medium text-[#1e2a4a]">Current transaction count:</span> {summary.transactionCount}</p>
                <p><span className="font-medium text-[#1e2a4a]">Next transaction ID:</span> {summary.nextTransactionId}</p>
              </div>
              <Button
                className="w-full bg-[#1e2a4a] hover:bg-[#152038] text-white"
                onClick={() => {
                  setResettingTransaction(true);
                  resetTransactionMutation.mutate();
                }}
                disabled={resettingTransaction || resetTransactionMutation.isPending}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {resettingTransaction || resetTransactionMutation.isPending ? "Resetting..." : "Reset transaction IDs"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="border-[#d9cfc0] shadow-sm">
          <CardContent className="flex items-start gap-3 py-5">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-[#c4703f]" />
            <div className="text-sm text-[#3d4f6f]">
              <p className="font-medium text-[#1e2a4a]">How it works</p>
              <p className="mt-1">Each reset reads the highest existing record ID in the selected table and sets the next ID to that value plus one. If there are no rows, the next ID starts at 1.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
