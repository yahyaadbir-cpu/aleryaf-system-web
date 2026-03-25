import { Router, type IRouter } from "express";
import {
  ADMIN_USERNAME,
  HAS_CONFIGURED_ADMIN_BOOTSTRAP,
  requireAdmin,
} from "../lib/auth";
import { appEnv } from "../lib/env";

const router: IRouter = Router();

export function buildSafeHandbookResponse() {
  return {
    secrets: {
      login: {
        adminBootstrapConfigured: HAS_CONFIGURED_ADMIN_BOOTSTRAP,
        adminBootstrapUsername: ADMIN_USERNAME || null,
      },
      infrastructure: {
        appDomain: appEnv.allowedAppOrigins[0] ?? "Not configured",
        localFrontend: "http://localhost:5173",
        localApi: "http://localhost:3000",
      },
      operations: {
        databaseMigrationsCommand: "pnpm db:push",
        frontendDevCommand: "pnpm --filter @workspace/aleryaf-hub run dev",
        apiDevCommand: "pnpm --filter @workspace/api-server run dev",
      },
      notes: [
        "الأسرار الفعلية لا تُعرض في الواجهة إطلاقًا، وتبقى داخل منصة إدارة الأسرار فقط.",
        "إنشاء المستخدمين الجدد يتم عبر دعوات إدارية مؤقتة وصالحة لمرة واحدة.",
        "أي تغيير في كلمة المرور أو الصلاحيات أو حالة الحساب يؤدي إلى إبطال الجلسات القديمة فورًا.",
      ],
    },
  };
}

router.use(requireAdmin);

router.get("/status", (_req, res) => {
  res.json({
    enabled: Boolean(appEnv.HANDBOOK_MASTER_PASSWORD?.trim()),
  });
});

router.post("/unlock", (req, res) => {
  const submittedPassword = typeof req.body?.password === "string" ? req.body.password.trim() : "";
  const configuredPassword = appEnv.HANDBOOK_MASTER_PASSWORD?.trim() ?? "";

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

  res.json(buildSafeHandbookResponse());
});

export default router;
