"use client";

import { useState } from "react";
import {
  LayoutDashboard,
  Search,
  Users,
  KanbanSquare,
  Megaphone,
  FileText,
  Sparkles,
  BarChart3,
  Database,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface TourStep {
  icon: LucideIcon;
  title: string;
  body: string;
}

/** One step per sidebar section, in the order they appear in the nav. */
export const TOUR_STEPS: TourStep[] = [
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    body: "Your daily starting point: how many leads you've found, who's been contacted, what's in the pipeline, and which follow-ups are due today.",
  },
  {
    icon: Search,
    title: "Lead Finder",
    body: "Where leads come from. Pick a country and city anywhere in the world, choose a niche, and LeadForge pulls real businesses from our database — then checks whether each one actually has a working website.",
  },
  {
    icon: Users,
    title: "Leads",
    body: "Every business you've saved, in one sortable table. Filter by country, search by name or niche, and export the list to CSV whenever you need it.",
  },
  {
    icon: KanbanSquare,
    title: "CRM",
    body: "Your pipeline as a drag-and-drop board, from New through to Won. Drag a card between columns and the lead's status updates instantly.",
  },
  {
    icon: Megaphone,
    title: "Campaigns",
    body: "Send outreach in batches. Suppression lists, duplicate prevention and daily sending limits are enforced automatically, so you stay compliant without thinking about it.",
  },
  {
    icon: FileText,
    title: "Templates",
    body: "Reusable email templates with {{variables}} like company name and city, filled in per lead. Edit on the left, see a live preview on the right.",
  },
  {
    icon: Sparkles,
    title: "AI Assistant",
    body: "Pick a lead and ask for an analysis, a cold email, a call script, or a pricing suggestion — written around that specific business's situation.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    body: "The numbers behind the work: conversion rates, revenue, and where your leads are coming from by niche and by country.",
  },
  {
    icon: Database,
    title: "Data Sources",
    body: "Shows which providers are powering the app. Business data is free via LeadForge INC by default — swap in a paid provider here later without changing anything else.",
  },
  {
    icon: Settings,
    title: "Settings",
    body: "Rename your workspace, invite teammates, review usage, and manage your plan. There's also a danger zone to wipe all leads if you want a clean slate.",
  },
];

export function ProductTour({
  onClose,
}: {
  /** Called when the tour ends. `neverShowAgain` reflects the checkbox. */
  onClose: (neverShowAgain: boolean) => void;
}) {
  const [index, setIndex] = useState(0);
  const [neverShowAgain, setNeverShowAgain] = useState(true);

  const step = TOUR_STEPS[index];
  const isFirst = index === 0;
  const isLast = index === TOUR_STEPS.length - 1;
  const Icon = step.icon;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div className="glow-ring w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-brand-wash">
            <Icon className="h-5 w-5" style={{ color: "hsl(var(--glow-strong))" }} />
          </div>
          <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
            {index + 1} of {TOUR_STEPS.length}
          </span>
        </div>

        <h2 id="tour-title" className="mt-4 text-lg font-semibold tracking-tight">
          {step.title}
        </h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{step.body}</p>

        {/* progress dots */}
        <div className="mt-5 flex gap-1" aria-hidden="true">
          {TOUR_STEPS.map((s, i) => (
            <span
              key={s.title}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= index ? "bg-gradient-brand" : "bg-secondary"
              }`}
            />
          ))}
        </div>

        <label className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={neverShowAgain}
            onChange={(e) => setNeverShowAgain(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-input"
          />
          Don&apos;t show this tour again
        </label>

        <div className="mt-5 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => onClose(neverShowAgain)}>
            Skip
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIndex((i) => i - 1)}
              disabled={isFirst}
            >
              Back
            </Button>
            {isLast ? (
              <Button size="sm" onClick={() => onClose(neverShowAgain)}>
                Get started
              </Button>
            ) : (
              <Button size="sm" onClick={() => setIndex((i) => i + 1)}>
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
