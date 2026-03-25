import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { corsOriginValidator, requireTrustedOrigin } from "./lib/security";

const app: Express = express();
const isProduction = process.env.NODE_ENV === "production";
const appDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDistDir = path.resolve(appDir, "..", "..", "aleryaf-hub", "dist", "public");
const frontendIndexPath = path.join(frontendDistDir, "index.html");
const hasFrontendBuild = fs.existsSync(frontendIndexPath);

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  cors({
    origin: corsOriginValidator,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Requested-With"],
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((_, res, next) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  next();
});
app.use("/api", requireTrustedOrigin);

app.use("/api", router);

if (isProduction && hasFrontendBuild) {
  app.use(express.static(frontendDistDir, { index: false }));

  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(frontendIndexPath);
  });
} else if (isProduction) {
  logger.warn({ frontendDistDir }, "Frontend build not found; backend will only serve API routes");
}

export default app;
