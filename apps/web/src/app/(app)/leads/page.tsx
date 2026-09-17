"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LeadStatusBadge, ScorePill, WebsiteStatusBadge } from "@/components/leads/badges";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/state";
import { formatNumber } from "@/lib/utils";
import { useApi } from "@/lib/use-api";
import { adaptLead } from "@/lib/adapters";
import type { ApiLead } from "@/types/api";
import type { Lead } from "@/types/lead";
import { Users } from "lucide-react";

const PAGE_SIZE = 10;

type SortKey = "company" | "score" | "rating" | "reviews" | "createdAt";

function exportToCsv(leads: Lead[]) {
  const headers = ["Company", "Niche", "City", "Country", "Rating", "Reviews", "Website", "Phone", "Email", "Score", "Status"];
  const rows = leads.map((l) => [
    l.company, l.niche, l.city, l.country, l.rating ?? "", l.reviews ?? "",
    l.website ?? "", l.phone ?? "", l.email ?? "", l.score.score, l.status,
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "leadforge-leads.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function LeadsPage() {
  const { data: leadsRaw, loading, error, refetch } = useApi<ApiLead[]>("/api/leads");
  const allLeads = useMemo(() => (leadsRaw ?? []).map(adaptLead), [leadsRaw]);

  const [query, setQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Only offer countries actually present in the saved leads — a dropdown of
  // 195 mostly-empty options would be noise.
  const availableCountries = useMemo(
    () => [...new Set(allLeads.map((l) => l.country).filter(Boolean))].sort(),
    [allLeads]
  );

  const filtered = useMemo(() => {
    let items = allLeads.filter((l) =>
      `${l.company} ${l.niche} ${l.city} ${l.country}`.toLowerCase().includes(query.toLowerCase())
    );
    if (countryFilter) {
      items = items.filter((l) => l.country === countryFilter);
    }
    items = [...items].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "company") cmp = a.company.localeCompare(b.company);
      else if (sortKey === "score") cmp = a.score.score - b.score.score;
      else if (sortKey === "rating") cmp = (a.rating ?? 0) - (b.rating ?? 0);
      else if (sortKey === "reviews") cmp = (a.reviews ?? 0) - (b.reviews ?? 0);
      else if (sortKey === "createdAt") cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
    return items;
  }, [allLeads, query, countryFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === pageItems.length) setSelected(new Set());
    else setSelected(new Set(pageItems.map((l) => l.id)));
  }

  if (loading) return <LoadingState label="Loading leads..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (allLeads.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No leads yet"
        description="Run a search in Lead Finder or import a CSV to start building your list."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} leads · {selected.size} selected</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => exportToCsv(selected.size ? allLeads.filter((l) => selected.has(l.id)) : filtered)}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>All Leads</CardTitle>
            <CardDescription>Saved leads across all searches and imports</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <select
              aria-label="Filter by country"
              value={countryFilter}
              onChange={(e) => { setCountryFilter(e.target.value); setPage(1); }}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">All countries</option>
              {availableCountries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="relative w-56">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search company, niche, city..."
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-y border-border text-xs text-muted-foreground">
                  <th className="w-10 px-4 py-2">
                    <input
                      type="checkbox"
                      checked={pageItems.length > 0 && selected.size === pageItems.length}
                      onChange={toggleSelectAll}
                      className="h-3.5 w-3.5 rounded border-input"
                    />
                  </th>
                  <th className="cursor-pointer px-4 py-2 font-medium" onClick={() => toggleSort("company")}>Company</th>
                  <th className="px-4 py-2 font-medium">Niche</th>
                  <th className="px-4 py-2 font-medium">Location</th>
                  <th className="cursor-pointer px-4 py-2 font-medium" onClick={() => toggleSort("rating")}>Rating</th>
                  <th className="cursor-pointer px-4 py-2 font-medium" onClick={() => toggleSort("reviews")}>Reviews</th>
                  <th className="px-4 py-2 font-medium">Website</th>
                  <th className="px-4 py-2 font-medium">Phone</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Instagram</th>
                  <th className="cursor-pointer px-4 py-2 font-medium" onClick={() => toggleSort("score")}>Score</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((lead) => (
                  <tr key={lead.id} className="row-hover border-b border-border last:border-0">
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(lead.id)}
                        onChange={() => toggleSelect(lead.id)}
                        className="h-3.5 w-3.5 rounded border-input"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/leads/${lead.id}`} className="font-medium hover:text-primary">{lead.company}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{lead.niche}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{lead.city}, {lead.country}</td>
                    <td className="px-4 py-2.5 tabular-nums">{lead.rating ?? "—"}</td>
                    <td className="px-4 py-2.5 tabular-nums">{lead.reviews ? formatNumber(lead.reviews) : "—"}</td>
                    <td className="px-4 py-2.5"><WebsiteStatusBadge status={lead.websiteStatus} /></td>
                    <td className="px-4 py-2.5 text-muted-foreground">{lead.phone ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{lead.email ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{lead.social.instagram ? `@${lead.social.instagram}` : "—"}</td>
                    <td className="px-4 py-2.5"><ScorePill score={lead.score.score} /></td>
                    <td className="px-4 py-2.5"><LeadStatusBadge status={lead.status} /></td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href={`/leads/${lead.id}`}>
                        <Button size="sm" variant="outline">View</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
