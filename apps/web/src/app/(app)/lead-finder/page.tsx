"use client";

import { useState } from "react";
import { Search, Loader2, SlidersHorizontal, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LeadStatusBadge, ScorePill, WebsiteStatusBadge } from "@/components/leads/badges";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { adaptLead } from "@/lib/adapters";
import type { LeadSearchFilters, LeadSearchResult } from "@/types/api";
import type { Lead, WebsiteStatus } from "@/types/lead";
import { formatNumber } from "@/lib/utils";
import { COUNTRIES } from "@/lib/countries";
import Link from "next/link";

const NICHES = [
  "Restaurant", "Barber", "Beauty Salon", "Dentist", "Gym", "Hotel", "Real Estate",
  "Auto Repair", "Plumber", "Electrician", "Law Firm", "Accountant", "Photographer",
  "Construction", "Cleaning", "Dental Clinic", "Medical Clinic", "Cafe", "Retail",
  "E-commerce", "Fitness", "Professional Services",
];

const WEBSITE_OPTIONS: { value: WebsiteStatus | "ANY"; label: string }[] = [
  { value: "ANY", label: "Any" },
  { value: "NO_WEBSITE", label: "No website" },
  { value: "ACTIVE", label: "Website detected" },
  { value: "OUTDATED", label: "Website appears outdated" },
  { value: "INACCESSIBLE", label: "Website inaccessible" },
  { value: "UNKNOWN", label: "Unknown" },
];

const SCORE_OPTIONS = [
  { value: 0, label: "Any score" },
  { value: 70, label: "70+" },
  { value: 80, label: "80+" },
  { value: 90, label: "90+" },
];

export default function LeadFinderPage() {
  const { toast } = useToast();
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [niche, setNiche] = useState("");
  const [customNiche, setCustomNiche] = useState("");
  const [websiteStatus, setWebsiteStatus] = useState<WebsiteStatus | "ANY">("ANY");
  const [minRating, setMinRating] = useState(0);
  const [minScore, setMinScore] = useState(0);
  const [requirePhone, setRequirePhone] = useState(false);
  const [requireEmail, setRequireEmail] = useState(false);
  const [requireInstagram, setRequireInstagram] = useState(false);

  const [searching, setSearching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [results, setResults] = useState<Lead[]>([]);
  // Captured at search time so the results header keeps showing what was
  // actually searched, even if the filters are edited afterwards.
  const [searchedLocation, setSearchedLocation] = useState("");

  const effectiveNiche = customNiche.trim() || niche;

  async function runSearch() {
    // A search needs somewhere to look, but a city is no longer required:
    // with only a country, results are drawn from across it.
    if (!city.trim() && !country) return;

    setSearching(true);
    setProgress(15);
    setHasSearched(false);
    setSearchError(null);
    setSearchedLocation([city.trim(), country].filter(Boolean).join(", ") || "anywhere");

    const progressTimer = setInterval(() => {
      setProgress((p) => (p < 85 ? p + 15 : p));
    }, 300);

    const filters: LeadSearchFilters = {
      country: country || undefined,
      city: city || undefined,
      niche: niche || undefined,
      custom_niche: customNiche || undefined,
      website_status: websiteStatus !== "ANY" ? websiteStatus : undefined,
      min_rating: minRating || undefined,
      min_score: minScore || undefined,
      require_phone: requirePhone,
      require_email: requireEmail,
      require_instagram: requireInstagram,
    };

    try {
      const result = await api.post<LeadSearchResult>("/api/leads/search", { filters });
      setResults(result.leads.map(adaptLead));
      setProgress(100);
      setTimeout(() => {
        setSearching(false);
        setHasSearched(true);
      }, 250);
    } catch (err) {
      clearInterval(progressTimer);
      setSearching(false);
      const message = err instanceof ApiError ? err.message : "Please try again";
      // Kept on screen as well as toasted: a provider outage must never be
      // mistaken for "this city has no businesses", and a toast disappears.
      setSearchError({ message, retryable: err instanceof ApiError ? Boolean(err.retryable) : false });
      toast({ title: "Search failed", description: message, variant: "error" });
    } finally {
      clearInterval(progressTimer);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Lead Finder</h1>
        <p className="text-sm text-muted-foreground">
          Discover businesses that are ready for a better website.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[340px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <CardTitle>Filters</CardTitle>
            </div>
            <CardDescription>Data source: configured Business Provider</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="country">
                Country
              </label>
              <select
                id="country"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              >
                <option value="">Any country</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <label className="mt-1 text-xs font-medium text-muted-foreground" htmlFor="city">
                City <span className="font-normal opacity-70">(optional)</span>
              </label>
              <Input
                id="city"
                placeholder="e.g. Lisbon"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Search anywhere in the world. A city gives the most thorough results; leave it blank to search a
                whole country and get a spread of businesses from across it. Chain and franchise outlets are left
                out — their websites are decided at corporate, so there&apos;s no local owner to pitch.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground">Industry / Niche</label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
              >
                <option value="">Any industry</option>
                {NICHES.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <Input
                placeholder="Custom niche (overrides dropdown)"
                value={customNiche}
                onChange={(e) => setCustomNiche(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground">Website Status</label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={websiteStatus}
                onChange={(e) => setWebsiteStatus(e.target.value as WebsiteStatus | "ANY")}
              >
                {WEBSITE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground">Minimum Rating</label>
              <Input
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={minRating || ""}
                placeholder="e.g. 4.0"
                onChange={(e) => setMinRating(Number(e.target.value) || 0)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground">Lead Score</label>
              <div className="flex flex-wrap gap-1.5">
                {SCORE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setMinScore(opt.value)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                      minScore === opt.value
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground">Contact Availability</label>
              <div className="flex flex-col gap-1.5">
                {[
                  { key: "phone", label: "Phone", value: requirePhone, set: setRequirePhone },
                  { key: "email", label: "Email", value: requireEmail, set: setRequireEmail },
                  { key: "instagram", label: "Instagram", value: requireInstagram, set: setRequireInstagram },
                ].map((item) => (
                  <label key={item.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={item.value}
                      onChange={(e) => item.set(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-input"
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </div>

            <Button onClick={runSearch} disabled={searching || (!city.trim() && !country)} className="w-full">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {searching ? "Searching..." : "Find Leads"}
            </Button>
            {!city.trim() && !country && !searching && (
              <p className="-mt-3 text-[11px] text-muted-foreground">
                Pick a country, or enter a city, to run a search.
              </p>
            )}

            {searching && (
              <div className="flex flex-col gap-1.5">
                <Progress value={progress} />
                <p className="text-[11px] text-muted-foreground">
                  {progress < 40 && "Querying business data providers..."}
                  {progress >= 40 && progress < 70 && "Detecting website status..."}
                  {progress >= 70 && progress < 100 && "Scoring opportunities..."}
                  {progress === 100 && "Done"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Results</CardTitle>
              <CardDescription>
                {hasSearched
                  ? `${results.length} businesses saved as leads${searchedLocation ? ` in ${searchedLocation}` : ""}`
                  : "Run a search to see results"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5">
              {hasSearched && searchedLocation && <Badge variant="outline">{searchedLocation}</Badge>}
              {hasSearched && effectiveNiche && <Badge variant="secondary">{effectiveNiche}</Badge>}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!hasSearched && !searching && !searchError && (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center">
                <Search className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm font-medium">No search run yet</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Set your filters and click &ldquo;Find Leads&rdquo; to discover businesses that are ready for a better website.
                </p>
              </div>
            )}

            {searchError && !searching && (
              <div className="animate-rise-in flex flex-col items-center justify-center gap-2 px-6 py-20 text-center">
                <AlertTriangle className="h-7 w-7 text-warning" />
                <p className="text-sm font-medium">The search could not be completed</p>
                <p className="max-w-md text-xs leading-relaxed text-muted-foreground">{searchError.message}</p>
                {searchError.retryable && (
                  <Button size="sm" variant="outline" className="mt-2" onClick={runSearch}>
                    Try again
                  </Button>
                )}
              </div>
            )}

            {hasSearched && !searchError && results.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center">
                <p className="text-sm font-medium">No businesses matched</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Try widening your filters — fewer requirements, a different niche, or a nearby larger city.
                  Double-check the city spelling matches the selected country.
                </p>
              </div>
            )}

            {hasSearched && results.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-y border-border text-xs text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Company</th>
                      <th className="px-4 py-2 font-medium">Niche</th>
                      <th className="px-4 py-2 font-medium">Location</th>
                      <th className="px-4 py-2 font-medium">Rating</th>
                      <th className="px-4 py-2 font-medium">Reviews</th>
                      <th className="px-4 py-2 font-medium">Website</th>
                      <th className="px-4 py-2 font-medium">Score</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((lead) => (
                      <tr key={lead.id} className="row-hover border-b border-border last:border-0">
                        <td className="px-4 py-2.5">
                          <Link href={`/leads/${lead.id}`} className="font-medium hover:text-primary">
                            {lead.company}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{lead.niche}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{lead.city}, {lead.country}</td>
                        <td className="px-4 py-2.5 tabular-nums">{lead.rating ?? "—"}</td>
                        <td className="px-4 py-2.5 tabular-nums">{lead.reviews ? formatNumber(lead.reviews) : "—"}</td>
                        <td className="px-4 py-2.5"><WebsiteStatusBadge status={lead.websiteStatus} /></td>
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
