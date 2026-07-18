import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { findAll, findById, insert, update, remove } from "../queries/connection";
import type { Item } from "../queries/connection";

export const itemRouter = createRouter({
  list: publicQuery
    .input(
      z.object({
        search: z.string().optional(),
        sortBy: z.string().optional(),
        sortOrder: z.enum(["asc", "desc"]).default("asc"),
      }).optional()
    )
    .query(async ({ input }) => {
      let items = findAll<Item>("items");

      if (input?.search) {
        const searchLower = input.search.toLowerCase();
        items = items.filter(
          (item) =>
            item.name.toLowerCase().includes(searchLower) ||
            item.hsnCode.toLowerCase().includes(searchLower)
        );
      }

      if (input?.sortBy) {
        const key = input.sortBy as keyof Item;
        items.sort((a, b) => {
          const valA = String(a[key] || "");
          const valB = String(b[key] || "");
          if (input.sortOrder === "desc") {
            return valB.localeCompare(valA, undefined, { numeric: true });
          }
          return valA.localeCompare(valB, undefined, { numeric: true });
        });
      } else {
        // Default sort by name ascending
        items.sort((a, b) => a.name.localeCompare(b.name));
      }

      return {
        items,
        total: items.length,
      };
    }),

  create: publicQuery
    .input(
      z.object({
        name: z.string().min(1),
        hsnCode: z.string().min(1),
        listPrice: z.number().min(0),
        unit: z.string().min(1),
        taxPercent: z.number().min(0).max(100),
      })
    )
    .mutation(async ({ input }) => {
      const now = new Date().toISOString();
      const result = insert<Item>("items", {
        name: input.name,
        hsnCode: input.hsnCode,
        listPrice: input.listPrice.toFixed(2),
        unit: input.unit,
        taxPercent: input.taxPercent.toFixed(2),
        createdAt: now,
        updatedAt: now,
      });

      return { id: result.id, item: result, message: "Item created successfully" };
    }),

  update: publicQuery
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        hsnCode: z.string().optional(),
        listPrice: z.number().optional(),
        unit: z.string().optional(),
        taxPercent: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...updateData } = input;
      const updateValues: Partial<Item> = {};

      if (updateData.name !== undefined) updateValues.name = updateData.name;
      if (updateData.hsnCode !== undefined) updateValues.hsnCode = updateData.hsnCode;
      if (updateData.listPrice !== undefined) updateValues.listPrice = updateData.listPrice.toFixed(2);
      if (updateData.unit !== undefined) updateValues.unit = updateData.unit;
      if (updateData.taxPercent !== undefined) updateValues.taxPercent = updateData.taxPercent.toFixed(2);
      updateValues.updatedAt = new Date().toISOString();

      const result = update<Item>("items", id, updateValues);
      if (!result) throw new Error("Item not found");

      return { id, item: result, message: "Item updated successfully" };
    }),

  delete: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const success = remove<Item>("items", input.id);
      if (!success) throw new Error("Item not found");

      return { message: "Item deleted successfully" };
    }),

  detail: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const item = findById<Item>("items", input.id);
      if (!item) throw new Error("Item not found");
      return item;
    }),
});
