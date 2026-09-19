"use client";

import { useState } from "react";
import { Search, Loader2, SlidersHorizontal, Radar, Globe2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { DiscoveryResultCard } from "@/components/leads/discovery-result-card";
import { EmptyState, ErrorState, ProgressSteps, SkeletonRows } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { adaptLead } from "@/lib/adapters";
import type { LeadSearchFilters, LeadSearchResult } from "@/types/api";
import type { Lead, WebsiteStatus } from "@/types/lead";
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

/** The stages the backend actually performs, in the order it performs them. */
const SEARCH_STEPS = [
  "Querying OpenStreetMap",
  "Checking website status",
  "Scoring opportunities",
  "Saving leads",
];

export default function DiscoverPage() {
  const { toast } = useToast();
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [niche, setNiche] = useState("");
  const [customNiche, setCustomNiche] = useState("");
  const [websiteStatus, setWebsiteStatus] = useState<WebsiteStatus | "ANY">("ANY");
  const [minScore, setMinScore] = useState(0);
  const [requirePhone, setRequirePhone] = useState(false);
  const [requireEmail, setRequireEmail] = useState(false);
  const [requireInstagram, setRequireInstagram] = useState(false);

  const [searching, setSearching] = useState(false);
  const [step, setStep] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [results, setResults] = useState<Lead[]>([]);
  // Captured at search time so the results header keeps describing what was
  // actually searched, even if the filters are edited afterwards.
  const [searchedLocation, setSearchedLocation] = useState("");
  const [searchedNiche, setSearchedNiche] = useState("");

  const effectiveNiche = customNiche.trim() || niche;
  const canSearch = Boolean(city.trim() || country);

  async function runSearch() {
    if (!canSearch) return;

    setSearching(true);
    setStep(0);
    setHasSearched(false);
    setSearchError(null);
    setSearchedLocation([city.trim(), country].filter(Boolean).join(", ") || "anywhere");
    setSearchedNiche(effectiveNiche);

    // The API performs these stages in order but does not stream progress, so
    // the indicator advances on elapsed time. It never reaches the final step
    // on its own - only a real response completes it - so it cannot claim the
    // work finished when it did not.
    const stepTimer = setInterval(() => {
      setStep((current) => (current < SEARCH_STEPS.length - 2 ? current + 1 : current));
    }, 4000);

    const filters: LeadSearchFilters = {
      country: country || undefined,
      city: city || undefined,
      niche: niche || undefined,
      custom_niche: customNiche || undefined,
      website_status: websiteStatus !== "ANY" ? websiteStatus : undefined,
      min_score: minScore || undefined,
      require_phone: requirePhone,
      require_email: requireEmail,
      require_instagram: requireInstagram,
    };

    try {
      const result = await api.post<LeadSearchResult>("/api/leads/search", { filters });
      setResults(result.leads.map(adaptLead));
      setStep(SEARCH_STEPS.length);
      setHasSearched(true);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Please try again";
      // Kept on screen as well as toasted: a provider outage must never be
      // mistaken for "this city has no businesses", and a toast disappears.
      setSearchError({
        message,
        retryable: err instanceof ApiError ? Boolean(err.retryable) : false,
      });
      toast({ title: "Search failed", description: message, variant: "error" });
    } finally {
      clearInterval(stepTimer);
      setSearching(false);
    }
  }

  const noWebsiteCount = results.filter((lead) => lead.websiteStatus === "NO_WEBSITE").length;
  const strongCount = results.filter((lead) => lead.score.score >= 80).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Discover opportunities"
        description="Find real businesses that may need a better web presence. Results come from OpenStreetMap and are checked live."
      />

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

            {/* A minimum-rating filter used to sit here. It was removed rather
                than disabled: OpenStreetMap does not record ratings or review
                counts, so the control was only implemented by the mock
                provider and silently changed nothing against real data. A
                filter that does nothing is worse than no filter. */}

            <div className="flex flex-col gap-2">
              <span className="label-caps">Must have</span>
              {[
                { key: "phone", label: "Phone number", value: requirePhone, set: setRequirePhone },
                { key: "email", label: "Email address", value: requireEmail, set: setRequireEmail },
                { key: "instagram", label: "Instagram", value: requireInstagram, set: setRequireInstagram },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex cursor-pointer items-center gap-2.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  <input
                    type="checkbox"
                    checked={item.value}
                    onChange={(e) => item.set(e.target.checked)}
                    className="h-3.5 w-3.5 rounded-sm border-border accent-[hsl(var(--primary))]"
                  />
                  {item.label}
                </label>
              ))}
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
                  ? `${results.length} saved as leads in ${searchedLocation}`
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
                    Live searches against OpenStreetMap can take up to a minute.
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
                description="The search completed, but nothing in this area matched your filters. Try fewer requirements, a different industry, or a nearby larger city."
              />
            )}

            {!searching && !searchError && results.length > 0 && (
              <ul className="stagger flex flex-col gap-2.5">
                {results.map((lead) => (
                  <li key={lead.id}>
                    <DiscoveryResultCard lead={lead} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
