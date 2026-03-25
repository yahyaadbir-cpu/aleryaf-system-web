import { Router, type IRouter } from "express";
import {
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  EMPLOYEE_BOOTSTRAP_PASSWORD,
  HAS_CONFIGURED_ADMIN_PASSWORD,
  requireAdmin,
} from "../lib/auth";

const router: IRouter = Router();

router.use(requireAdmin);

router.get("/status", (_req, res) => {
  res.json({
    enabled: Boolean(process.env.HANDBOOK_MASTER_PASSWORD?.trim()),
  });
});

router.post("/unlock", (req, res) => {
  const submittedPassword = typeof req.body?.password === "string" ? req.body.password.trim() : "";
  const configuredPassword = process.env.HANDBOOK_MASTER_PASSWORD?.trim() ?? "";

  if (!submittedPassword) {
    res.status(400).json({ error: "Password is required" });
    return;
  }

  if (!configuredPassword) {
    res.status(503).json({ error: "Secure handbook password is not configured on the server" });
    return;
  }

  if (submittedPassword !== configuredPassword) {
    res.status(403).json({ error: "Invalid handbook password" });
    return;
  }

  res.json({
    secrets: {
      login: {
        adminUsername: ADMIN_USERNAME,
        adminPassword: HAS_CONFIGURED_ADMIN_PASSWORD ? ADMIN_PASSWORD : "Not configured on the server",
        employeeBootstrapPassword: EMPLOYEE_BOOTSTRAP_PASSWORD || "معطّل",
      },
      infrastructure: {
        appDomain: "https://aleryaf.store",
        localFrontend: "http://localhost:5173",
        localApi: "http://localhost:3000",
      },
      operations: {
        databaseMigrationsCommand: "pnpm db:push",
        frontendDevCommand: "pnpm --filter @workspace/aleryaf-hub run dev",
        apiDevCommand: "pnpm --filter @workspace/api-server run dev",
      },
      notes: [
        "المتغيرات الحساسة الكاملة مثل DATABASE_URL ومفاتيح VAPID تبقى في Railway Variables أو ملف .env المحلي ولا يفضّل نسخها داخل الواجهة.",
        "تعديل المستخدمين والصلاحيات يتم من إدارة المستخدمين أو من مركز الأوامر.",
        "الطباعة التركية صلاحية مستقلة لكل مستخدم ولا تظهر إلا بعد منحها.",
      ],
    },
  });
});

export default router;
