"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Search, Loader2, SlidersHorizontal, Radar, Globe2, Info, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { DiscoveryResultCard } from "@/components/leads/discovery-result-card";
import { EmptyState, ErrorState, ProgressSteps, SkeletonRows } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { adaptLeadPreview } from "@/lib/adapters";
import type { LeadSearchFilters, LeadSearchResult, LeadSaveResponse, ApiUsage } from "@/types/api";
import type { LeadPreview, WebsiteStatus } from "@/types/lead";
import { COUNTRIES } from "@/lib/countries";
import { cn } from "@/lib/utils";

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
  { value: "INACCESSIBLE", label: "Website unreachable" },
  { value: "UNKNOWN", label: "Unknown" },
];

const SCORE_OPTIONS = [
  { value: 0, label: "Any" },
  { value: 70, label: "70+" },
  { value: 80, label: "80+" },
  { value: 90, label: "90+" },
];

const SEARCH_STEPS = [
  "Querying LeadForge INC",
  "Checking website status",
  "Scoring opportunities",
];

const RESULTS_PER_PAGE = 25;

export default function DiscoverPage() {
  const { toast } = useToast();
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [niche, setNiche] = useState("");
  const [customNiche, setCustomNiche] = useState("");
  const [websiteStatus, setWebsiteStatus] = useState<WebsiteStatus | "ANY">("ANY");
  const [minScore, setMinScore] = useState(0);
  const [searching, setSearching] = useState(false);
  const [step, setStep] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [results, setResults] = useState<LeadPreview[]>([]);
  const [searchedLocation, setSearchedLocation] = useState("");
  const [searchedNiche, setSearchedNiche] = useState("");
  const [usage, setUsage] = useState<ApiUsage | null>(null);
  const [searchLimit, setSearchLimit] = useState(50);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get<ApiUsage>("/api/workspace/usage").then(setUsage).catch(() => {});
  }, []);

  const effectiveNiche = customNiche.trim() || niche;
  const canSearch = Boolean(city.trim() || country);

  const runSearch = useCallback(async () => {
    if (!canSearch) return;

    setSearching(true);
    setStep(0);
    setHasSearched(false);
    setSearchError(null);
    setPage(1);
    setSearchedLocation([city.trim(), country].filter(Boolean).join(", ") || "anywhere");
    setSearchedNiche(effectiveNiche);

    const stepTimer = setInterval(() => {
      setStep((current) => (current < SEARCH_STEPS.length - 1 ? current + 1 : current));
    }, 4000);

    const filters: LeadSearchFilters = {
      country: country || undefined,
      city: city || undefined,
      niche: niche || undefined,
      custom_niche: customNiche || undefined,
      website_status: websiteStatus !== "ANY" ? websiteStatus : undefined,
      min_score: minScore || undefined,
      limit: searchLimit,
    };

    try {
      const result = await api.post<LeadSearchResult>("/api/leads/search", { filters });
      setResults(result.leads.map(adaptLeadPreview));
      setStep(SEARCH_STEPS.length);
      setHasSearched(true);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Please try again";
      setSearchError({
        message,
        retryable: err instanceof ApiError ? Boolean(err.retryable) : false,
      });
      toast({ title: "Search failed", description: message, variant: "error" });
    } finally {
      clearInterval(stepTimer);
      setSearching(false);
    }
  }, [country, city, niche, customNiche, websiteStatus, minScore, searchLimit, canSearch, toast]);

  const handleSaveLead = useCallback(async (preview: LeadPreview) => {
    try {
      const response = await api.post<LeadSaveResponse>("/api/leads/save", { leads: [preview] });
      if (response.saved > 0) {
        setResults((prev) =>
          prev.map((r) =>
            r.external_ref === preview.external_ref ? { ...r, saved: true } : r
          )
        );
        toast({ title: "Lead saved", description: `${preview.name} added to your leads`, variant: "success" });
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not save lead";
      toast({ title: "Save failed", description: message, variant: "error" });
    }
  }, [toast]);

  const noWebsiteCount = results.filter((lead) => lead.website_status === "NO_WEBSITE").length;
  const strongCount = results.filter((lead) => lead.score.score >= 80).length;

  const totalPages = Math.max(1, Math.ceil(results.length / RESULTS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginatedResults = useMemo(
    () => results.slice((safePage - 1) * RESULTS_PER_PAGE, safePage * RESULTS_PER_PAGE),
    [results, safePage]
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Discover opportunities"
        description="Find real businesses that may need a better web presence. Results come from LeadForge INC and are checked live."
      />

      {usage?.quota_exhausted && (
        <div className="rounded-lg border border-warning/25 bg-warning/[0.07] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
            <p className="text-sm text-warning">
              You&apos;ve reached your weekly usage. To keep searching, buy more leads or upgrade your plan.
            </p>
          </div>
          <div className="mt-2 flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/settings?tab=billing">Buy more leads</Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href="/settings?tab=billing">Upgrade plan</Link>
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[330px_minmax(0,1fr)]">
        {/* ---------------------------------------------------------- filters */}
        <div className="surface h-fit rounded-xl xl:sticky xl:top-20">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <SlidersHorizontal className="h-4 w-4 text-subtle-foreground" aria-hidden="true" />
            <h3 className="text-sm font-semibold">Search</h3>
          </div>

          <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-1.5">
              <label className="label-caps" htmlFor="country">Country</label>
              <Select id="country" value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="">Any country</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="label-caps" htmlFor="city">
                City <span className="normal-case tracking-normal opacity-70">(optional)</span>
              </label>
              <Input
                id="city"
                placeholder="e.g. Lisbon"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <p className="text-2xs leading-relaxed text-subtle-foreground">
                A city gives the most thorough results. Leave it blank to search a whole country.
                Chains and franchises are excluded — their websites are decided at corporate.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="label-caps" htmlFor="niche">Industry</label>
              <Select id="niche" value={niche} onChange={(e) => setNiche(e.target.value)}>
                <option value="">Any industry</option>
                {NICHES.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </Select>
              <Input
                placeholder="Or type a custom niche"
                value={customNiche}
                onChange={(e) => setCustomNiche(e.target.value)}
                aria-label="Custom niche, overrides the dropdown"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="label-caps" htmlFor="website-status">Website status</label>
              <Select
                id="website-status"
                value={websiteStatus}
                onChange={(e) => setWebsiteStatus(e.target.value as WebsiteStatus | "ANY")}
              >
                {WEBSITE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="label-caps">Minimum score</span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Minimum opportunity score">
                {SCORE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={minScore === option.value}
                    onClick={() => setMinScore(option.value)}
                    className={cn(
                      "rounded-sm border px-2.5 py-1 text-2xs font-medium transition-colors",
                      minScore === option.value
                        ? "border-primary/40 bg-primary/12 text-primary"
                        : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="label-caps" htmlFor="results-limit">Results to fetch</label>
              <Select id="results-limit" value={searchLimit} onChange={(e) => setSearchLimit(Number(e.target.value))}>
                <option value={25}>25 leads</option>
                <option value={50}>50 leads</option>
                <option value={100}>100 leads</option>
              </Select>
            </div>

            <Button onClick={runSearch} disabled={searching || !canSearch} className="w-full">
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {searching ? "Searching..." : "Find opportunities"}
            </Button>
            {!canSearch && !searching && (
              <p className="-mt-2 flex items-start gap-1.5 text-2xs text-subtle-foreground">
                <Info className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
                <span>
                  Choose a country or type a city first — a search needs somewhere to look.
                  Either one on its own is enough.
                </span>
              </p>
            )}
          </div>
        </div>

        {/* ---------------------------------------------------------- results */}
        <div className="surface flex min-h-[520px] flex-col rounded-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">Results</h3>
              <p className="mt-0.5 truncate text-2xs text-subtle-foreground">
                {hasSearched
                  ? `${results.length} opportunities found in ${searchedLocation}`
                  : "Set your filters and run a search"}
              </p>
            </div>
            {hasSearched && results.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {noWebsiteCount > 0 && (
                  <Badge variant="signal" dot>{noWebsiteCount} with no website</Badge>
                )}
                {strongCount > 0 && <Badge variant="default">{strongCount} scoring 80+</Badge>}
                {searchedNiche && <Badge variant="outline">{searchedNiche}</Badge>}
              </div>
            )}
          </div>

          <div className="flex-1 p-4">
            {searching && (
              <div className="flex flex-col gap-5">
                <div className="rounded-lg border border-border bg-background/40 p-4">
                  <ProgressSteps steps={SEARCH_STEPS} activeIndex={step} />
                  <p className="mt-3 border-t border-border pt-3 text-2xs text-subtle-foreground">
                    Live searches against LeadForge INC can take up to a minute.
                  </p>
                </div>
                <SkeletonRows rows={4} />
              </div>
            )}

            {!searching && searchError && (
              <ErrorState
                title="This search could not be completed"
                message={searchError.message}
                retryable={searchError.retryable}
                onRetry={runSearch}
              />
            )}

            {!searching && !searchError && !hasSearched && (
              <EmptyState
                icon={Radar}
                title="No search run yet"
                description="Pick a country — or a specific city — and run a search. Businesses without a website score highest, because they're the clearest opportunity."
              />
            )}

            {!searching && !searchError && hasSearched && results.length === 0 && (
              <EmptyState
                icon={Globe2}
                title="No businesses matched"
                description={
                  searchedLocation && !city.trim()
                    ? "The search completed, but nothing matched. A country-wide search covers specific trades — plumbers, accountants, law firms, estate agents, builders — in full. Broader categories like restaurants or retail are too numerous to scan a whole country, so those need a city. Add one and try again."
                    : "The search completed, but nothing in this area matched your filters. Try fewer requirements, a different industry, or a nearby larger city."
                }
              />
            )}

            {!searching && !searchError && results.length > 0 && (
              <>
                <ul className="stagger flex flex-col gap-2.5">
                  {paginatedResults.map((preview) => (
                    <li key={preview.external_ref}>
                      <DiscoveryResultCard preview={preview} onSave={handleSaveLead} />
                    </li>
                  ))}
                </ul>
                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                    <p className="text-2xs text-subtle-foreground">
                      Page {safePage} of {totalPages} ({results.length} results)
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={safePage <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={safePage >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      >
                        Next
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
