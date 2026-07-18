import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { findAll, findById, findOne, insert, update, remove } from "../queries/connection";
import type { Bill, BillItem, Company, Buyer } from "../queries/connection";

// Helper to auto-generate bill number
function generateNextBillNumber(): string {
  const bills = findAll<Bill>("bills");
  const companies = findAll<Company>("companies");
  const company = companies[0];
  const startingStr = company?.startingBillNumber || "0001";
  
  // Parse startingStr
  const matchStart = startingStr.match(/^(\d+)/);
  const startNum = matchStart ? parseInt(matchStart[1], 10) : 1;
  const padLen = startingStr.length;

  if (bills.length === 0) {
    return String(startNum).padStart(padLen, "0");
  }

  // Get the last bill by id descending
  const sortedBills = [...bills].sort((a, b) => b.id - a.id);
  const lastBill = sortedBills[0];
  const lastNumStr = lastBill.billNumber;

  // Extract leading digits from last bill number (ignoring any trailing / or date if it exists)
  const matchDigits = lastNumStr.match(/^(\d+)/);
  if (matchDigits) {
    const lastSeq = parseInt(matchDigits[1], 10);
    const nextSeq = Math.max(lastSeq + 1, startNum);
    return String(nextSeq).padStart(padLen, "0");
  }

  const nextSeq = Math.max(bills.length + 1, startNum);
  return String(nextSeq).padStart(padLen, "0");
}

export const billRouter = createRouter({
  list: publicQuery
    .input(
      z.object({
        search: z.string().optional(),
        sortBy: z.string().optional(),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
      }).optional()
    )
    .query(async ({ input }) => {
      let bills = findAll<Bill>("bills");

      if (input?.search) {
        const searchLower = input.search.toLowerCase();
        bills = bills.filter(
          (b) =>
            b.billNumber.toLowerCase().includes(searchLower) ||
            b.buyerName.toLowerCase().includes(searchLower) ||
            (b.buyerGst && b.buyerGst.toLowerCase().includes(searchLower))
        );
      }

      if (input?.sortBy) {
        const key = input.sortBy as keyof Bill;
        bills.sort((a, b) => {
          let valA = a[key];
          let valB = b[key];

          if (key === "totalAmount" || key === "subtotal" || key === "id") {
            const numA = parseFloat(String(valA || 0));
            const numB = parseFloat(String(valB || 0));
            return input.sortOrder === "desc" ? numB - numA : numA - numB;
          }

          const strA = String(valA || "");
          const strB = String(valB || "");
          if (input.sortOrder === "desc") {
            return strB.localeCompare(strA, undefined, { numeric: true });
          }
          return strA.localeCompare(strB, undefined, { numeric: true });
        });
      } else {
        // Default sort by id desc
        bills.sort((a, b) => b.id - a.id);
      }

      return {
        bills,
        total: bills.length,
      };
    }),

  create: publicQuery
    .input(
      z.object({
        buyerId: z.number(),
        billDate: z.string(),
        dueDate: z.string().nullable(),
        placeOfSupply: z.string(),
        reverseCharge: z.enum(["Yes", "No"]).default("No"),
        items: z.array(
          z.object({
            itemId: z.number(),
            qty: z.number().min(1),
            discountPercent: z.number().min(0).max(100).default(0),
            listPrice: z.number().optional(),
          })
        ),
        roundOff: z.number().default(0),
        transportId: z.number().nullable().optional(),
        parcel: z.number().min(0).default(1),
      })
    )
    .mutation(async ({ input }) => {
      const now = new Date().toISOString();

      // Retrieve buyer
      const buyer = findById<Buyer>("buyers", input.buyerId);
      if (!buyer) throw new Error("Buyer not found");

      // Resolve Transport
      let transportId = input.transportId !== undefined ? input.transportId : null;
      let transportName = "N/A";
      
      if (transportId === null) {
        // Try fallback to buyer default transport
        if (buyer.defaultTransportId) {
          transportId = buyer.defaultTransportId;
          transportName = buyer.defaultTransportName || "N/A";
        }
      } else {
        const tr = findById<any>("transports", transportId);
        if (tr) {
          transportName = tr.name;
        } else {
          transportId = null;
        }
      }

      // Retrieve company for tax determination
      const companies = findAll<Company>("companies");
      const company = companies[0] || {
        companyName: "Alpha Wholesale",
        address: "",
        phone: "",
        email: "",
        gstNumber: "",
        state: "Uttar Pradesh",
        stateCode: "09",
      };

      // Compile items with prices & calculations
      let subtotal = 0;
      let totalTax = 0;
      let totalDiscount = 0;
      let cgstTotal = 0;
      let sgstTotal = 0;
      let igstTotal = 0;

      const companyState = company.address?.toLowerCase().includes("uttar pradesh") || company.gstNumber?.startsWith("09") ? "09" : "09"; // Default Uttar Pradesh (09)
      const isInterState = !input.placeOfSupply.toLowerCase().includes("uttar pradesh") && !input.placeOfSupply.includes("09");

      const compiledItems: BillItem[] = input.items.map((entry) => {
        const catalogItem = findById<any>("items", entry.itemId);
        if (!catalogItem) throw new Error(`Item ID ${entry.itemId} not found`);

        const price = entry.listPrice !== undefined ? entry.listPrice : parseFloat(catalogItem.listPrice);
        const qty = entry.qty;
        const discPercent = entry.discountPercent;
        const taxPercent = parseFloat(catalogItem.taxPercent);

        const grossAmount = price * qty;
        const discountAmount = grossAmount * (discPercent / 100);
        const taxableAmount = grossAmount - discountAmount;
        const taxAmount = taxableAmount * (taxPercent / 100);
        const finalAmount = taxableAmount + taxAmount;

        subtotal += grossAmount;
        totalDiscount += discountAmount;
        totalTax += taxAmount;

        if (isInterState) {
          igstTotal += taxAmount;
        } else {
          cgstTotal += taxAmount / 2;
          sgstTotal += taxAmount / 2;
        }

        return {
          itemId: entry.itemId,
          name: catalogItem.name,
          hsnCode: catalogItem.hsnCode,
          qty,
          unit: catalogItem.unit,
          listPrice: price.toFixed(2),
          discountPercent: discPercent.toFixed(2),
          taxPercent: catalogItem.taxPercent,
          amount: finalAmount.toFixed(2),
        };
      });

      const calculatedSubtotal = subtotal - totalDiscount;
      const calculatedTotalBeforeRound = calculatedSubtotal + totalTax;
      
      // Auto-round off if roundOff is 0 or auto calculated
      let finalRoundOff = input.roundOff;
      if (finalRoundOff === 0) {
        const roundedTotal = Math.round(calculatedTotalBeforeRound);
        finalRoundOff = roundedTotal - calculatedTotalBeforeRound;
      }
      const totalAmount = calculatedTotalBeforeRound + finalRoundOff;

      const billNumber = generateNextBillNumber();

      const result = insert<Bill>("bills", {
        billNumber,
        billDate: input.billDate,
        dueDate: input.dueDate,
        buyerId: input.buyerId,
        buyerName: buyer.companyName,
        buyerGst: buyer.gstNumber,
        buyerAddress: buyer.address,
        buyerPhone: buyer.phone,
        buyerEmail: buyer.phone ? `${buyer.phone}@gmail.com` : null, // Fallback placeholder
        placeOfSupply: input.placeOfSupply,
        reverseCharge: input.reverseCharge,
        items: compiledItems,
        cgstAmount: cgstTotal.toFixed(2),
        sgstAmount: sgstTotal.toFixed(2),
        igstAmount: igstTotal.toFixed(2),
        totalTax: totalTax.toFixed(2),
        subtotal: subtotal.toFixed(2),
        discountAmount: totalDiscount.toFixed(2),
        roundOff: finalRoundOff.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        transportId,
        transportName,
        parcel: input.parcel,
        createdAt: now,
        updatedAt: now,
      });

      // Synchronize transaction
      const totalQty = compiledItems.reduce((sum, item) => sum + item.qty, 0);
      insert<any>("transactions", {
        buyerId: input.buyerId,
        bookType: "CC",
        transactionDate: input.billDate,
        dueDate: input.dueDate,
        amount: totalAmount.toFixed(2),
        trouserQuantity: totalQty,
        checkNumber: `INV-${billNumber}`,
        transactionType: "Sale",
        includeInReporting: true,
        billId: result.id,
        deleted: false,
        deletedReason: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      return { id: result.id, bill: result, message: "Bill created successfully" };
    }),

  update: publicQuery
    .input(
      z.object({
        id: z.number(),
        buyerId: z.number().optional(),
        billDate: z.string().optional(),
        dueDate: z.string().nullable().optional(),
        placeOfSupply: z.string().optional(),
        reverseCharge: z.enum(["Yes", "No"]).optional(),
        items: z.array(
          z.object({
            itemId: z.number(),
            qty: z.number().min(1),
            discountPercent: z.number().min(0).max(100).default(0),
            listPrice: z.number().optional(),
          })
        ).optional(),
        roundOff: z.number().optional(),
        transportId: z.number().nullable().optional(),
        parcel: z.number().min(0).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const existingBill = findById<Bill>("bills", input.id);
      if (!existingBill) throw new Error("Bill not found");

      const updateValues: Partial<Bill> = {};

      let buyerId = input.buyerId !== undefined ? input.buyerId : existingBill.buyerId;
      let billDate = input.billDate !== undefined ? input.billDate : existingBill.billDate;
      let dueDate = input.dueDate !== undefined ? input.dueDate : existingBill.dueDate;
      let placeOfSupply = input.placeOfSupply !== undefined ? input.placeOfSupply : existingBill.placeOfSupply;
      let reverseCharge = input.reverseCharge !== undefined ? input.reverseCharge : existingBill.reverseCharge;

      const buyer = findById<Buyer>("buyers", buyerId);
      if (!buyer) throw new Error("Buyer not found");

      updateValues.buyerId = buyerId;
      updateValues.buyerName = buyer.companyName;
      updateValues.buyerGst = buyer.gstNumber;
      updateValues.buyerAddress = buyer.address;
      updateValues.buyerPhone = buyer.phone;
      updateValues.billDate = billDate;
      updateValues.dueDate = dueDate;
      updateValues.placeOfSupply = placeOfSupply;
      updateValues.reverseCharge = reverseCharge;

      // Handle Transport Update
      if (input.transportId !== undefined) {
        if (input.transportId === null) {
          updateValues.transportId = null;
          updateValues.transportName = "N/A";
        } else {
          const tr = findById<any>("transports", input.transportId);
          if (tr) {
            updateValues.transportId = input.transportId;
            updateValues.transportName = tr.name;
          } else {
            updateValues.transportId = null;
            updateValues.transportName = "N/A";
          }
        }
      }

      if (input.parcel !== undefined) {
        updateValues.parcel = input.parcel;
      }

      if (input.items !== undefined) {
        // Retrieve company
        const companies = findAll<Company>("companies");
        const company = companies[0] || { companyName: "Alpha Wholesale", address: "", phone: "", email: "", gstNumber: "" };

        let subtotal = 0;
        let totalTax = 0;
        let totalDiscount = 0;
        let cgstTotal = 0;
        let sgstTotal = 0;
        let igstTotal = 0;

        const isInterState = !placeOfSupply.toLowerCase().includes("uttar pradesh") && !placeOfSupply.includes("09");

        const compiledItems: BillItem[] = input.items.map((entry) => {
          const catalogItem = findById<any>("items", entry.itemId);
          if (!catalogItem) throw new Error(`Item ID ${entry.itemId} not found`);

          const price = entry.listPrice !== undefined ? entry.listPrice : parseFloat(catalogItem.listPrice);
          const qty = entry.qty;
          const discPercent = entry.discountPercent;
          const taxPercent = parseFloat(catalogItem.taxPercent);

          const grossAmount = price * qty;
          const discountAmount = grossAmount * (discPercent / 100);
          const taxableAmount = grossAmount - discountAmount;
          const taxAmount = taxableAmount * (taxPercent / 100);
          const finalAmount = taxableAmount + taxAmount;

          subtotal += grossAmount;
          totalDiscount += discountAmount;
          totalTax += taxAmount;

          if (isInterState) {
            igstTotal += taxAmount;
          } else {
            cgstTotal += taxAmount / 2;
            sgstTotal += taxAmount / 2;
          }

          return {
            itemId: entry.itemId,
            name: catalogItem.name,
            hsnCode: catalogItem.hsnCode,
            qty,
            unit: catalogItem.unit,
            listPrice: price.toFixed(2),
            discountPercent: discPercent.toFixed(2),
            taxPercent: catalogItem.taxPercent,
            amount: finalAmount.toFixed(2),
          };
        });

        const calculatedSubtotal = subtotal - totalDiscount;
        const calculatedTotalBeforeRound = calculatedSubtotal + totalTax;

        let finalRoundOff = input.roundOff !== undefined ? input.roundOff : parseFloat(existingBill.roundOff);
        if (input.roundOff === undefined) {
          const roundedTotal = Math.round(calculatedTotalBeforeRound);
          finalRoundOff = roundedTotal - calculatedTotalBeforeRound;
        }

        const totalAmount = calculatedTotalBeforeRound + finalRoundOff;

        updateValues.items = compiledItems;
        updateValues.cgstAmount = cgstTotal.toFixed(2);
        updateValues.sgstAmount = sgstTotal.toFixed(2);
        updateValues.igstAmount = igstTotal.toFixed(2);
        updateValues.totalTax = totalTax.toFixed(2);
        updateValues.subtotal = subtotal.toFixed(2);
        updateValues.discountAmount = totalDiscount.toFixed(2);
        updateValues.roundOff = finalRoundOff.toFixed(2);
        updateValues.totalAmount = totalAmount.toFixed(2);
      } else if (input.roundOff !== undefined) {
        // Only roundOff changed, recalculate totalAmount
        const subtotalVal = parseFloat(existingBill.subtotal) - parseFloat(existingBill.discountAmount);
        const beforeRound = subtotalVal + parseFloat(existingBill.totalTax);
        const totalVal = beforeRound + input.roundOff;

        updateValues.roundOff = input.roundOff.toFixed(2);
        updateValues.totalAmount = totalVal.toFixed(2);
      }

      updateValues.updatedAt = new Date().toISOString();

      const result = update<Bill>("bills", input.id, updateValues);
      if (!result) throw new Error("Bill not found");

      // Synchronize associated transaction
      const associatedTx = findOne<any>("transactions", (t) => t.billId === existingBill.id && !t.deleted);
      const totalQty = (updateValues.items || existingBill.items).reduce((sum, item) => sum + item.qty, 0);
      const updatedAmt = updateValues.totalAmount !== undefined ? parseFloat(updateValues.totalAmount) : parseFloat(existingBill.totalAmount);
      
      if (associatedTx) {
        update<any>("transactions", associatedTx.id, {
          buyerId,
          transactionDate: billDate,
          dueDate,
          amount: updatedAmt.toFixed(2),
          trouserQuantity: totalQty,
          checkNumber: `INV-${existingBill.billNumber}`,
          updatedAt: new Date().toISOString(),
        });
      } else {
        // If not found, insert one
        insert<any>("transactions", {
          buyerId,
          bookType: "CC",
          transactionDate: billDate,
          dueDate,
          amount: updatedAmt.toFixed(2),
          trouserQuantity: totalQty,
          checkNumber: `INV-${existingBill.billNumber}`,
          transactionType: "Sale",
          includeInReporting: true,
          billId: existingBill.id,
          deleted: false,
          deletedReason: null,
          deletedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      return { id: input.id, bill: result, message: "Bill updated successfully" };
    }),

  delete: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const success = remove<Bill>("bills", input.id);
      if (!success) throw new Error("Bill not found");

      // Soft delete synchronized transaction
      const associatedTx = findOne<any>("transactions", (t) => t.billId === input.id && !t.deleted);
      if (associatedTx) {
        update<any>("transactions", associatedTx.id, {
          deleted: true,
          deletedReason: "Bill Deleted",
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      return { message: "Bill deleted successfully" };
    }),

  detail: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const bill = findById<Bill>("bills", input.id);
      if (!bill) throw new Error("Bill not found");
      return bill;
    }),
});
