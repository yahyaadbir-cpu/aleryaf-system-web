import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import branchesRouter from "./branches";
import warehousesRouter from "./warehouses";
import invoicesRouter from "./invoices";
import itemsRouter from "./items";
import inventoryRouter from "./inventory";
import profitRouter from "./profit";
import activityLogRouter from "./activity-log";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/dashboard", dashboardRouter);
router.use("/branches", branchesRouter);
router.use("/warehouses", warehousesRouter);
router.use("/invoices", invoicesRouter);
router.use("/items", itemsRouter);
router.use("/inventory", inventoryRouter);
router.use("/profit", profitRouter);
router.use("/activity-log", activityLogRouter);
router.use("/notifications", notificationsRouter);

export default router;
