import type { LeadStatus, WebsiteStatus } from "./lead";

export interface ApiUser {
  id: string;
  email: string;
  full_name: string | null;
  /** Platform administrator. Decides whether the admin section is shown -
   *  never whether it is allowed, which the server checks on every call. */
  is_superuser?: boolean;
  email_verified_at?: string | null;
}

// ---------------------------------------------------------------- admin

export interface AdminWorkspaceRef {
  id: string;
  name: string;
  plan: string;
  role: string;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
  workspaces: AdminWorkspaceRef[];
}

export interface AdminWorkspace {
  id: string;
  name: string;
  slug: string;
  plan: string;
  created_at: string;
  member_count: number;
  lead_count: number;
  subscription_status: string | null;
  payment_provider: string | null;
}

export interface AdminOverview {
  total_users: number;
  active_users: number;
  total_workspaces: number;
  total_leads: number;
  total_companies: number;
  active_coupons: number;
  paying_subscriptions: number;
  payment_provider_connected: boolean;
}

export interface AdminCoupon {
  id: string;
  code: string;
  description: string | null;
  percent_off: number | null;
  amount_off_cents: number | null;
  max_redemptions: number | null;
  redeemed_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ApiWorkspace {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: ApiUser;
  workspace: ApiWorkspace;
}

export interface MeResponse {
  user: ApiUser;
  workspaces: ApiWorkspace[];
}

export interface ApiScoreBreakdownItem {
  label: string;
  points: number;
}

export interface ApiContact {
  phone: string | null;
  email: string | null;
  contact_name: string | null;
}

export interface ApiSocialProfile {
  platform: string;
  handle: string;
  url: string;
  follower_count: number | null;
}

export interface ApiWebsite {
  website_url: string | null;
  domain: string | null;
  http_status: number | null;
  ssl_status: boolean | null;
  status: WebsiteStatus;
  mobile_friendly: boolean | null;
  last_checked_at: string | null;
}

export interface ApiCompany {
  id: string;
  name: string;
  niche: string;
  country: string;
  city: string;
  address: string | null;
  maps_url: string | null;
  rating: number | null;
  reviews_count: number | null;
  hours: string | null;
  description: string | null;
  contacts: ApiContact[];
  social_profiles: ApiSocialProfile[];
  website: ApiWebsite | null;
}

export interface ApiLead {
  /** False until this workspace unlocks the lead. While false the contact
   *  fields are absent from the response, not merely hidden. */
  contact_revealed?: boolean;
  id: string;
  workspace_id: string;
  company: ApiCompany;
  status: LeadStatus;
  score: number;
  score_breakdown: ApiScoreBreakdownItem[];
  score_recommendation: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  estimated_value: number | null;
  source: string;
  contact_attempts: number;
  follow_up_date: string | null;
  last_contacted_at: string | null;
  created_at: string;
}

export interface LeadSearchFilters {
  country?: string;
  city?: string;
  niche?: string;
  custom_niche?: string;
  website_status?: WebsiteStatus;
  min_rating?: number;
  max_reviews?: number;
  min_reviews?: number;
  require_phone?: boolean;
  require_email?: boolean;
  require_instagram?: boolean;
  min_score?: number;
  radius_km?: number;
}

export interface LeadSearchResult {
  total_found: number;
  leads: ApiLead[];
}

export interface ApiNote {
  id: string;
  lead_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
}

export interface ApiTask {
  id: string;
  lead_id: string;
  title: string;
  due_date: string | null;
  completed: boolean;
  assignee_id: string | null;
}

export interface ApiActivity {
  id: string;
  lead_id: string;
  type: string;
  message: string;
}

export interface ApiAnalytics {
  leads_found: number;
  leads_won: number;
  leads_lost: number;
  leads_contacted: number;
  conversion_rate: number;
  pipeline_value: number;
  revenue: number;
  leads_by_niche: { name: string; value: number }[];
  leads_by_country: { name: string; value: number }[];
}

export interface ApiAcquisitionPoint {
  day: string;
  found: number;
  won: number;
}

export interface ApiOutreachPoint {
  day: string;
  sent: number;
  replied: number;
}

export interface ApiFunnelStage {
  name: string;
  value: number;
}

export interface ApiEmailSettings {
  configured: boolean;
  from_address: string | null;
  from_name: string | null;
  reply_to: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_use_tls: boolean;
  daily_send_limit: number | null;
  verified_at: string | null;
}

export interface ApiProviderStatus {
  key: string;
  name: string;
  description: string;
  active: string;
  live: boolean;
  env_var: string;
  note?: string;
}

export interface ApiTimeseries {
  acquisition: ApiAcquisitionPoint[];
  outreach: ApiOutreachPoint[];
  funnel: ApiFunnelStage[];
}

export type CampaignStatus = "DRAFT" | "SCHEDULED" | "RUNNING" | "PAUSED" | "COMPLETED";

export interface ApiCampaign {
  id: string;
  name: string;
  description: string | null;
  sender: string;
  reply_to: string | null;
  subject: string;
  status: CampaignStatus;
  daily_send_limit: number;
  created_at: string;
}

export interface ApiCampaignRecipient {
  id: string;
  lead_id: string;
  email: string;
  status: string;
  sequence_step: number;
  sent_at: string | null;
  opened_at: string | null;
  replied_at: string | null;
  bounced_at: string | null;
  unsubscribed_at: string | null;
}

export interface ApiEmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

export interface AILeadAnalysis {
  opportunity_score: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  website_opportunities: string[];
  recommended_services: string[];
  recommended_pitch: string;
  recommended_contact_method: string;
  estimated_project_range: string;
}

export interface ApiWorkspaceMember {
  id: string;
  user_id: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  email: string;
  full_name: string | null;
}

export interface ApiUsage {
  lead_searches: number;
  ai_analyses: number;
  emails_sent: number;
  team_members: number;
  plan: string;
  // Lead unlocks: the metered unit. The limit comes from the API so the
  // interface cannot disagree with the server about someone's plan.
  lead_reveals?: number;
  lead_reveals_limit?: number;
  lead_reveals_remaining?: number;
  quota_exhausted?: boolean;
}

export interface ApiNotification {
  id: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
}

export interface ApiSavedSearch {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  created_at: string;
}
