"use client";

import { useState } from "react";
import { Sparkles, Send, Mail, PhoneCall, Instagram, FileText, DollarSign, MessageSquare, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApi } from "@/lib/use-api";
import { api, ApiError } from "@/lib/api";
import type { ApiLead } from "@/types/api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const ACTIONS = [
  { label: "Analyze this lead", icon: Sparkles },
  { label: "Generate an outreach email", icon: Mail },
  { label: "Generate a follow-up email", icon: Mail },
  { label: "Generate a call script", icon: PhoneCall },
  { label: "Generate an Instagram DM", icon: Instagram },
  { label: "Draft a proposal outline", icon: FileText },
  { label: "Suggest a website package", icon: FileText },
  { label: "Suggest a pricing strategy", icon: DollarSign },
  { label: "Summarize this conversation", icon: MessageSquare },
];

export default function AiAssistantPage() {
  const { data: leads } = useApi<ApiLead[]>("/api/leads");
  const [leadId, setLeadId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm your LeadForge AI Assistant. Pick a lead above, choose an action, or just ask me anything about outreach strategy.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  async function send(prompt?: string) {
    const content = prompt ?? input;
    if (!content.trim() || sending) return;
    setMessages((m) => [...m, { role: "user", content }]);
    setInput("");
    setSending(true);
    try {
      const response = await api.post<{ reply: string }>("/api/ai/assistant", {
        message: content,
        lead_id: leadId || undefined,
      });
      setMessages((m) => [...m, { role: "assistant", content: response.reply }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: err instanceof ApiError ? `Error: ${err.message}` : "Something went wrong — please try again." },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-8.5rem)] flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">AI Assistant</h1>
          <p className="text-sm text-muted-foreground">Your AI-powered co-pilot for lead analysis and outreach content.</p>
        </div>
        <select
          value={leadId}
          onChange={(e) => setLeadId(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">No lead selected</option>
          {leads?.map((l) => (
            <option key={l.id} value={l.id}>{l.company.name}</option>
          ))}
        </select>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Select a lead first for best results</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5">
            {ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => send(action.label)}
                disabled={sending}
                className="flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                <action.icon className="h-3.5 w-3.5" />
                {action.label}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="flex min-h-0 flex-1 flex-col">
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-accent/60 text-foreground"
                }`}
              >
                {m.content}
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-2 rounded-lg bg-accent/60 px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking...
              </div>
            )}
          </CardContent>
          <div className="flex items-center gap-2 border-t border-border p-3">
            <Input
              placeholder="Ask the AI assistant..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              disabled={sending}
            />
            <Button size="icon" onClick={() => send()} aria-label="Send" disabled={sending}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
