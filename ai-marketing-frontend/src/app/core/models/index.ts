export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  channelId: string;
}

export interface CampaignRequest {
  prompt: string;
  businessName: string;
  businessDescription?: string;
  industry: string;
  targetAudience: string;
  goal: string;
  tone: string;
  language: string;
  platform: string;
  campaignType: string;
  duration?: string;
  budget?: string;
  telegram: TelegramConfig;
}

export interface SocialPost {
  platform?: string;
  content: string;
  day?: number;
}

export interface ContentCalendarItem {
  day: number;
  action: string;
}

export interface KpiItem {
  metric: string;
  target: string;
}

export interface CampaignResult {
  title?: string;
  overview?: string;
  strategy?: string;
  socialPosts?: SocialPost[];
  emailCampaign?: string;
  hashtags?: string[];
  contentCalendar?: ContentCalendarItem[];
  cta?: string;
  imageSuggestions?: string[];
  kpis?: KpiItem[];
  raw?: string;
}

export interface CampaignApiResponse {
  result: CampaignResult | string;
  telegramSent?: boolean;
  campaignId?: string;
}

export interface CompetitorAnalysisRequest {
  prompt: string;
  companyName?: string;
  websiteUrl?: string;
}

export interface CompetitorItem {
  name: string;
  strengths: string[];
  weaknesses: string[];
}

export interface TrendItem {
  title: string;
  importance: 'high' | 'medium' | 'low';
}

export interface CompetitorAnalysisResult {
  summary?: string;
  companyOverview?: string;
  seoSummary?: string;
  marketingStrategy?: string;
  socialPresence?: string;
  strengths?: string[];
  weaknesses?: string[];
  swot?: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  competitors?: CompetitorItem[];
  trends?: TrendItem[];
  recommendations?: string[];
  aiOpportunities?: string[];
  raw?: string;
}

export interface DashboardStats {
  campaignsGenerated: number;
  competitorReports: number;
  aiRequests: number;
  successRate: number;
}

export interface ActivityItem {
  id: string;
  type: 'campaign' | 'analysis';
  title: string;
  timestamp: Date;
  status: 'success' | 'pending' | 'error';
}

export interface HistoryItem {
  id: string;
  type: 'campaign' | 'analysis';
  title: string;
  createdAt: string;
  preview: string;
  campaignId?: string;
  result?: CampaignResult | CompetitorAnalysisResult;
}
