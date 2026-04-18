import { Router, type IRouter } from "express";
import { z } from "zod";
import { chatWithJax, getJaxProjectSnapshot } from "../lib/jax";

const router: IRouter = Router();

const JaxChatSchema = z.object({
  message: z.string().trim().min(1).max(6000),
  history: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string().max(6000),
      }),
    )
    .max(20)
    .optional(),
});

router.get("/jax/context", async (req, res) => {
  try {
    const snapshot = await getJaxProjectSnapshot();
    res.json({
      assistantName: snapshot.config.assistantName,
      companyName: snapshot.config.companyName,
      projectName: snapshot.config.projectName,
      ownerName: snapshot.config.ownerName,
      defaultLanguage: snapshot.config.defaultLanguage,
      mission: snapshot.config.mission,
      capabilities: snapshot.config.capabilities,
      constraints: snapshot.config.constraints,
      model: snapshot.ollamaModel,
      hasProjectContext: Boolean(snapshot.projectContext.trim()),
    });
  } catch (err) {
    req.log.error({ err }, "Error loading Jax project context");
    res.status(500).json({ error: "Failed to load Jax context" });
  }
});

router.post("/jax/chat", async (req, res) => {
  try {
    const parsed = JaxChatSchema.parse(req.body);
    const result = await chatWithJax(parsed.message, parsed.history ?? []);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error generating Jax reply");
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to generate Jax reply",
    });
  }
});

export default router;
