import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Bot,
  BrainCircuit,
  Layers3,
  LoaderCircle,
  MessageSquare,
  Send,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/http";

type JaxRole = "user" | "assistant";

type JaxChatItem = {
  role: JaxRole;
  content: string;
};

type JaxContext = {
  assistantName: string;
  companyName: string;
  projectName: string;
  ownerName: string;
  defaultLanguage: string;
  mission: string;
  capabilities: string[];
  constraints: string[];
  model: string;
  hasProjectContext: boolean;
};

const starterPrompts = [
  "What do you know about this project?",
  "Summarize ALERYAF System Web clearly.",
  "What should you help users with inside this product?",
  "How can we teach you more about this project?",
];

async function fetchJaxContext() {
  const response = await apiFetch("/api/jax/context");
  if (!response.ok) {
    throw new Error("Failed to load Jax context");
  }

  return (await response.json()) as JaxContext;
}

async function sendJaxMessage(message: string, history: JaxChatItem[]) {
  const response = await apiFetch("/api/jax/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Jax could not reply");
  }

  return (await response.json()) as {
    reply: string;
    model: string;
    assistantName: string;
    projectName: string;
  };
}

export function JaxPage() {
  const { toast } = useToast();
  const [context, setContext] = useState<JaxContext | null>(null);
  const [contextLoading, setContextLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<JaxChatItem[]>([
    {
      role: "assistant",
      content:
        "I’m Jax, ALERYAF’s embedded AI module. I learn the current project, explain what it does, and help inside the product instead of acting like a generic chatbot.",
    },
  ]);

  useEffect(() => {
    let alive = true;

    fetchJaxContext()
      .then((data) => {
        if (!alive) return;
        setContext(data);
      })
      .catch((error) => {
        if (!alive) return;
        toast({
          title: "Jax context failed",
          description: error instanceof Error ? error.message : "Could not load Jax context",
          variant: "destructive",
        });
      })
      .finally(() => {
        if (!alive) return;
        setContextLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [toast]);

  const statCards = useMemo(
    () => [
      {
        label: "Role",
        value: "Project AI module",
        icon: <Bot className="h-5 w-5 text-cyan-300" />,
      },
      {
        label: "Runtime model",
        value: context?.model ?? "Loading...",
        icon: <BrainCircuit className="h-5 w-5 text-emerald-300" />,
      },
      {
        label: "Project context",
        value: context?.hasProjectContext ? "Connected" : "Missing",
        icon: <Layers3 className="h-5 w-5 text-blue-300" />,
      },
      {
        label: "Default language",
        value: context?.defaultLanguage ?? "English",
        icon: <ShieldCheck className="h-5 w-5 text-violet-300" />,
      },
    ],
    [context],
  );

  const submit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    const trimmed = message.trim();
    if (!trimmed || sending) return;

    const nextUserMessage: JaxChatItem = { role: "user", content: trimmed };
    const nextHistory = [...messages, nextUserMessage];

    setMessages(nextHistory);
    setMessage("");
    setSending(true);

    try {
      const result = await sendJaxMessage(trimmed, nextHistory);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: result.reply || "I understood the request, but I do not have a reply yet.",
        },
      ]);
    } catch (error) {
      const description =
        error instanceof Error ? error.message : "Jax could not answer right now.";

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `I hit a project-side error while replying: ${description}`,
        },
      ]);

      toast({
        title: "Jax reply failed",
        description,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015)),rgba(8,12,18,0.96)] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.45)] sm:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200">
                <Sparkles className="h-3.5 w-3.5" />
                Embedded AI Layer
              </div>
              <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
                JAX
              </h1>
              <p className="mt-3 text-lg text-blue-200">
                Project-aware AI for ALERYAF products.
              </p>
              <p className="mt-4 max-w-2xl text-sm leading-8 text-slate-300 sm:text-base">
                This page is the reusable Jax module inside the web app. It is meant to learn this
                project, answer with product context, and later power AI inside future ALERYAF web,
                app, and internal systems.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[420px] xl:max-w-[460px]">
              {statCards.map((item) => (
                <div
                  key={item.label}
                  className="rounded-[24px] border border-white/10 bg-black/20 p-4 backdrop-blur-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      {item.icon}
                    </div>
                    <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                      {item.label}
                    </span>
                  </div>
                  <div className="mt-4 text-base font-semibold text-white">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <Card className="glass-panel overflow-hidden rounded-[28px] border-white/10 bg-card/80">
            <CardHeader className="border-b border-white/6 pb-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-2xl text-white">Jax identity</CardTitle>
                  <p className="mt-2 text-sm text-slate-400">
                    The project-specific profile this assistant is using right now.
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="rounded-full border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200"
                >
                  {contextLoading ? "Loading..." : "Live"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Mission</div>
                <p className="mt-3 text-sm leading-8 text-slate-200">
                  {context?.mission ??
                    "Loading Jax mission from the project configuration..."}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <InfoBlock label="Assistant" value={context?.assistantName ?? "Jax"} />
                <InfoBlock label="Company" value={context?.companyName ?? "ALERYAF"} />
                <InfoBlock label="Project" value={context?.projectName ?? "ALERYAF System Web"} />
                <InfoBlock label="Owner" value={context?.ownerName ?? "Yahya"} />
              </div>

              <div className="grid gap-4">
                <ListBlock
                  title="What Jax should do"
                  items={context?.capabilities ?? ["Loading project capabilities..."]}
                />
                <ListBlock
                  title="Guardrails"
                  items={context?.constraints ?? ["Loading project constraints..."]}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-panel overflow-hidden rounded-[28px] border-white/10 bg-card/80">
            <CardHeader className="border-b border-white/6 pb-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-2xl text-white">Conversation deck</CardTitle>
                  <p className="mt-2 text-sm text-slate-400">
                    Ask Jax about the product, the mission, future features, or what context it
                    still needs to learn better.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Project chat
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5 p-6">
              <div className="grid gap-2 sm:grid-cols-2">
                {starterPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setMessage(prompt)}
                    className="rounded-[20px] border border-white/8 bg-white/[0.035] px-4 py-3 text-left text-sm text-slate-200 transition hover:border-primary/30 hover:bg-primary/10"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              <div className="min-h-[360px] space-y-3 rounded-[26px] border border-white/8 bg-black/20 p-4">
                {messages.map((item, index) => {
                  const isAssistant = item.role === "assistant";
                  return (
                    <div
                      key={`${item.role}-${index}`}
                      className={`max-w-[88%] rounded-[22px] border px-4 py-3 text-sm leading-8 shadow-sm ${
                        isAssistant
                          ? "border-primary/20 bg-primary/10 text-slate-100"
                          : "ml-auto border-white/8 bg-white/[0.04] text-white"
                      }`}
                    >
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                        {isAssistant ? "Jax" : "You"}
                      </div>
                      <div>{item.content}</div>
                    </div>
                  );
                })}

                {sending ? (
                  <div className="flex max-w-[88%] items-center gap-3 rounded-[22px] border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-slate-200">
                    <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
                    Jax is thinking through the project context...
                  </div>
                ) : null}
              </div>

              <form onSubmit={submit} className="space-y-4">
                <Textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Ask Jax about this project..."
                  className="min-h-[120px] rounded-[24px] border-white/10 bg-black/25 px-4 py-4 text-sm text-white placeholder:text-slate-500 focus-visible:ring-primary"
                />

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="submit"
                    disabled={sending || !message.trim()}
                    className="rounded-2xl bg-primary px-6 text-white hover:bg-primary/90"
                  >
                    {sending ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Send to Jax
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setMessages([
                        {
                          role: "assistant",
                          content:
                            "I’m Jax, ALERYAF’s embedded AI module. I learn the current project, explain what it does, and help inside the product instead of acting like a generic chatbot.",
                        },
                      ])
                    }
                    className="rounded-2xl border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/10"
                  >
                    Reset thread
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </section>
      </div>
    </Layout>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div
            key={item}
            className="rounded-[18px] border border-white/6 bg-white/[0.03] px-3 py-2 text-sm leading-7 text-slate-300"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
