export type WebsiteStatus =
  | "NO_WEBSITE"
  | "ACTIVE"
  | "INACCESSIBLE"
  | "REDIRECTED"
  | "OUTDATED"
  | "UNKNOWN";

export type LeadStatus =
  | "NEW"
  | "RESEARCHED"
  | "CONTACTED"
  | "REPLIED"
  | "INTERESTED"
  | "MEETING"
  | "PROPOSAL"
  | "WON"
  | "LOST";

export type ContactAvailability = "PHONE" | "EMAIL" | "INSTAGRAM" | "MULTIPLE";

export interface ScoreBreakdownItem {
  label: string;
  points: number;
}

export interface LeadScore {
  score: number;
  breakdown: ScoreBreakdownItem[];
  recommendation: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}

export interface SocialProfiles {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  linkedin?: string;
}

export interface Lead {
  id: string;
  company: string;
  niche: string;
  city: string;
  country: string;
  address?: string;
  mapsUrl?: string;
  rating?: number;
  reviews?: number;
  phone?: string;
  email?: string;
  website?: string;
  websiteStatus: WebsiteStatus;
  social: SocialProfiles;
  score: LeadScore;
  status: LeadStatus;
  owner?: string;
  estimatedValue?: number;
  source: string;
  campaign?: string;
  lastContacted?: string;
  followUpDate?: string;
  contactAttempts?: number;
  createdAt: string;
  description?: string;
  hours?: string;
}

export interface ActivityEntry {
  id: string;
  leadId: string;
  timestamp: string;
  message: string;
  type: "system" | "email" | "ai" | "call" | "note";
}

export interface LeadPreview {
  external_ref: string;
  name: string;
  niche: string;
  country: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  website: string | null;
  maps_url: string | null;
  rating: number | null;
  reviews_count: number | null;
  hours: string | null;
  description: string | null;
  website_status: WebsiteStatus;
  score: LeadScore;
  saved?: boolean;
}
