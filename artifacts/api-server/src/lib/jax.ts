import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appEnv } from "./env";

type JaxRole = "system" | "user" | "assistant";

export interface JaxMessage {
  role: JaxRole;
  content: string;
}

interface JaxConfig {
  assistantName?: string;
  companyName?: string;
  projectName?: string;
  ownerName?: string;
  defaultLanguage?: string;
  defaultModel?: string;
  mission?: string;
  capabilities?: string[];
  constraints?: string[];
}

interface OllamaGenerateResponse {
  response?: string;
}

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, "../../../../");
const configPath = path.join(repoRoot, "jax.config.json");
const projectContextPath = path.join(repoRoot, "jax.project.md");

const defaultConfig: Required<JaxConfig> = {
  assistantName: "Jax",
  companyName: "ALERYAF",
  projectName: "ALERYAF System Web",
  ownerName: "Yahya",
  defaultLanguage: "English",
  defaultModel: "llama3.2:3b",
  mission:
    "Act as ALERYAF's reusable project AI module. Help with this project's workflows, explain features, guide users, and stay aware of the current product context.",
  capabilities: [
    "Answer questions about the current project",
    "Help users navigate project features and workflows",
    "Draft product text, support replies, and internal explanations",
    "Adapt to this project's identity, rules, and documentation",
  ],
  constraints: [
    "Do not claim to run desktop actions unless the current project explicitly supports them",
    "Do not invent project features that are not in the provided context",
    "If information is missing, say what context you need",
  ],
};

async function readOptionalText(filePath: string) {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function loadConfig(): Promise<Required<JaxConfig>> {
  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as JaxConfig;
    return {
      ...defaultConfig,
      ...parsed,
      capabilities: parsed.capabilities ?? defaultConfig.capabilities,
      constraints: parsed.constraints ?? defaultConfig.constraints,
    };
  } catch {
    return defaultConfig;
  }
}

function buildSystemPrompt(config: Required<JaxConfig>, projectContext: string) {
  const capabilities = config.capabilities.map((item) => `- ${item}`).join("\n");
  const constraints = config.constraints.map((item) => `- ${item}`).join("\n");

  return [
    `You are ${config.assistantName}, the embedded AI assistant for ${config.companyName}.`,
    `Project: ${config.projectName}`,
    `Owner: ${config.ownerName}`,
    `Default language: ${config.defaultLanguage}`,
    "",
    `Mission: ${config.mission}`,
    "",
    "Capabilities:",
    capabilities,
    "",
    "Rules:",
    constraints,
    "",
    "Style:",
    "- Be direct, useful, and product-aware.",
    "- Prefer practical answers over generic AI filler.",
    "- Speak like a built-in assistant that belongs to this project.",
    "- If the user asks about this project, answer from the provided project context first.",
    "",
    "Project context:",
    projectContext.trim() || "No extra project context file has been provided yet.",
  ].join("\n");
}

function buildPrompt(systemPrompt: string, history: JaxMessage[], userMessage: string) {
  const safeHistory = history
    .filter((item) => item && typeof item.content === "string" && item.content.trim())
    .slice(-8)
    .map((item) => `${item.role.toUpperCase()}: ${item.content.trim()}`)
    .join("\n");

  return [
    `SYSTEM: ${systemPrompt}`,
    safeHistory ? `\nRECENT CHAT:\n${safeHistory}` : "",
    `\nUSER: ${userMessage.trim()}`,
    "\nASSISTANT:",
  ].join("\n");
}

export async function getJaxProjectSnapshot() {
  const config = await loadConfig();
  const projectContext = await readOptionalText(projectContextPath);

  return {
    config,
    projectContext,
    ollamaUrl: appEnv.OLLAMA_URL ?? "http://127.0.0.1:11434",
    ollamaModel: appEnv.OLLAMA_MODEL ?? config.defaultModel,
  };
}

export async function chatWithJax(userMessage: string, history: JaxMessage[] = []) {
  const snapshot = await getJaxProjectSnapshot();
  const systemPrompt = buildSystemPrompt(snapshot.config, snapshot.projectContext);
  const prompt = buildPrompt(systemPrompt, history, userMessage);

  const response = await fetch(`${snapshot.ollamaUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: snapshot.ollamaModel,
      prompt,
      stream: false,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`Ollama request failed (${response.status}): ${bodyText}`);
  }

  const data = (await response.json()) as OllamaGenerateResponse;

  return {
    reply: (data.response ?? "").trim(),
    model: snapshot.ollamaModel,
    assistantName: snapshot.config.assistantName,
    projectName: snapshot.config.projectName,
  };
}
