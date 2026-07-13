import { authRouter } from "./auth-router";
import { createRouter, publicQuery } from "./middleware";
import { dashboardRouter } from "./routers/dashboard";
import { transactionRouter } from "./routers/transaction";
import { buyerRouter } from "./routers/buyer";
import { reportRouter } from "./routers/report";
import { auditRouter } from "./routers/audit";
import { settingsRouter } from "./routers/settings";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  dashboard: dashboardRouter,
  transaction: transactionRouter,
  buyer: buyerRouter,
  report: reportRouter,
  audit: auditRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
