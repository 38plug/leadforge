"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Search, ArrowUpDown, Radar, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { LeadStatusBadge, ScorePill, WebsiteStatusBadge } from "@/components/leads/badges";
import { ErrorState, EmptyState, SkeletonRows } from "@/components/ui/state";
import { formatNumber } from "@/lib/utils";
import { useApi } from "@/lib/use-api";
import { adaptLead } from "@/lib/adapters";
import type { ApiLead } from "@/types/api";
import type { Lead } from "@/types/lead";

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

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Leads" description="Every business you have saved." />
        <Card className="p-4">
          <SkeletonRows rows={8} />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Leads" description="Every business you have saved." />
        <Card>
          <ErrorState title="Your leads could not be loaded" message={error} onRetry={refetch} />
        </Card>
      </div>
    );
  }

  if (allLeads.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Leads" description="Every business you have saved." />
        <Card>
          <EmptyState
            icon={Radar}
            title="No leads yet"
            description="Your next client could be one search away. Run a search and LeadForge will save what it finds here."
            action={
              <Button asChild>
                <Link href="/lead-finder">Discover businesses</Link>
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Leads"
        description={`${filtered.length} ${filtered.length === 1 ? "lead" : "leads"} in your workspace.`}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/lead-finder">
                <Radar className="h-4 w-4" />
                Discover more
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                exportToCsv(selected.size ? allLeads.filter((l) => selected.has(l.id)) : filtered)
              }
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </>
        }
      />

      {/* Bulk bar appears only with a selection, so the toolbar is not
          permanently occupied by actions that cannot be used. */}
      {selected.size > 0 && (
        <div className="animate-rise-in flex flex-wrap items-center gap-3 rounded-lg border border-primary/25 bg-primary/[0.07] px-4 py-2.5">
          <span className="text-[13px] font-medium">
            <span className="numeric">{selected.size}</span> selected
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => exportToCsv(allLeads.filter((l) => selected.has(l.id)))}
            >
              <Download className="h-3.5 w-3.5" />
              Export selection
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 border-b border-border">
          <div className="min-w-0">
            <CardTitle>All leads</CardTitle>
            <CardDescription>Saved from every search you have run.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Filter by country"
              value={countryFilter}
              onChange={(e) => { setCountryFilter(e.target.value); setPage(1); }}
              className="w-auto min-w-[140px]"
            >
              <option value="">All countries</option>
              {availableCountries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
            <div className="relative w-full sm:w-60">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-foreground" />
              <Input
                placeholder="Search business, niche, city..."
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                className="pl-8"
                aria-label="Search leads"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="w-10 px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={pageItems.length > 0 && selected.size === pageItems.length}
                      onChange={toggleSelectAll}
                      className="h-3.5 w-3.5 rounded-sm border-border accent-[hsl(var(--primary))]"
                    />
                  </th>
                  <th scope="col" className="px-4 py-2.5"><button type="button" onClick={() => toggleSort("company")} className="label-caps flex items-center gap-1 transition-colors hover:text-foreground">Company<ArrowUpDown className="h-3 w-3 opacity-50" aria-hidden="true" /></button></th>
                  <th scope="col" className="label-caps px-4 py-2.5">Niche</th>
                  <th scope="col" className="label-caps px-4 py-2.5">Location</th>
                  
                  
                  <th scope="col" className="label-caps px-4 py-2.5">Website</th>
                  <th scope="col" className="label-caps px-4 py-2.5">Phone</th>
                  <th scope="col" className="label-caps px-4 py-2.5">Email</th>
                  <th scope="col" className="label-caps px-4 py-2.5">Instagram</th>
                  <th scope="col" className="px-4 py-2.5"><button type="button" onClick={() => toggleSort("score")} className="label-caps flex items-center gap-1 transition-colors hover:text-foreground">Score<ArrowUpDown className="h-3 w-3 opacity-50" aria-hidden="true" /></button></th>
                  <th scope="col" className="label-caps px-4 py-2.5">Status</th>
                  <th scope="col" className="label-caps px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((lead) => (
                  <tr key={lead.id} className="row-hover border-b border-border/60 last:border-0">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(lead.id)}
                        onChange={() => toggleSelect(lead.id)}
                        className="h-3.5 w-3.5 rounded-sm border-border accent-[hsl(var(--primary))]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/leads/${lead.id}`} className="font-medium transition-colors hover:text-primary">{lead.company}</Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{lead.niche}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{lead.city}, {lead.country}</td>
                    
                    
                    <td className="px-4 py-3"><WebsiteStatusBadge status={lead.websiteStatus} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{lead.phone ?? "—"}</td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-xs text-muted-foreground">{lead.email ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{lead.social.instagram ? `@${lead.social.instagram}` : "—"}</td>
                    <td className="px-4 py-3"><ScorePill score={lead.score.score} /></td>
                    <td className="px-4 py-3"><LeadStatusBadge status={lead.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/leads/${lead.id}`}>
                        <Button size="sm" variant="secondary">View</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span className="numeric">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button size="sm" variant="secondary" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
