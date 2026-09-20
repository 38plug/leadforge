import type { ApiLead, ApiLeadPreview } from "@/types/api";
import type { Lead, LeadPreview } from "@/types/lead";

/**
 * Maps the API's normalized Lead+Company shape onto the flatter `Lead`
 * shape the UI components were built against, so dashboard/table/detail
 * components don't need to change when swapping mock data for live data.
 */
export function adaptLead(apiLead: ApiLead): Lead {
  const { company } = apiLead;
  const primaryContact = company.contacts[0];
  const instagram = company.social_profiles.find((p) => p.platform === "instagram");
  const facebook = company.social_profiles.find((p) => p.platform === "facebook");

  return {
    id: apiLead.id,
    company: company.name,
    niche: company.niche,
    city: company.city,
    country: company.country,
    address: company.address ?? undefined,
    mapsUrl: company.maps_url ?? undefined,
    rating: company.rating ?? undefined,
    reviews: company.reviews_count ?? undefined,
    phone: primaryContact?.phone ?? undefined,
    email: primaryContact?.email ?? undefined,
    website: company.website?.website_url ?? undefined,
    websiteStatus: company.website?.status ?? "UNKNOWN",
    social: {
      instagram: instagram?.handle,
      facebook: facebook?.handle,
    },
    score: {
      score: apiLead.score,
      breakdown: apiLead.score_breakdown,
      recommendation: apiLead.score_recommendation ?? "",
      priority: apiLead.priority,
    },
    status: apiLead.status,
    owner: undefined,
    estimatedValue: apiLead.estimated_value ?? undefined,
    source: apiLead.source,
    campaign: undefined,
    lastContacted: apiLead.last_contacted_at ?? undefined,
    followUpDate: apiLead.follow_up_date ?? undefined,
    contactAttempts: apiLead.contact_attempts,
    createdAt: apiLead.created_at,
    description: company.description ?? undefined,
    hours: company.hours ?? undefined,
  };
}

export function adaptLeadPreview(apiPreview: ApiLeadPreview): LeadPreview {
  return {
    external_ref: apiPreview.external_ref,
    name: apiPreview.name,
    niche: apiPreview.niche,
    country: apiPreview.country,
    city: apiPreview.city,
    address: apiPreview.address,
    phone: apiPreview.phone,
    email: apiPreview.email,
    instagram: apiPreview.instagram,
    website: apiPreview.website,
    maps_url: apiPreview.maps_url,
    rating: apiPreview.rating,
    reviews_count: apiPreview.reviews_count,
    hours: apiPreview.hours,
    description: apiPreview.description,
    website_status: apiPreview.website_status,
    score: {
      score: apiPreview.score.score,
      breakdown: apiPreview.score.breakdown,
      recommendation: apiPreview.score.recommendation,
      priority: apiPreview.score.priority,
    },
    saved: false,
  };
}
