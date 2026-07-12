import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CampaignApiResponse,
  CampaignRequest,
  CampaignResult,
  CompetitorAnalysisRequest,
  CompetitorAnalysisResult,
} from '../models';

@Injectable({ providedIn: 'root' })
export class CampaignService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api';

  generateCampaign(payload: CampaignRequest): Observable<CampaignApiResponse> {
    return this.http.post<CampaignApiResponse>(`${this.baseUrl}/generate-campaign`, payload);
  }

  approveCampaign(campaignId: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.baseUrl}/campaigns/${campaignId}/approve`, {});
  }

  declineCampaign(campaignId: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.baseUrl}/campaigns/${campaignId}/decline`, {});
  }

  cancelCampaign(campaignId: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.baseUrl}/campaigns/${campaignId}/cancel`, {});
  }

  sendToTelegram(message: string, botToken: string, channelId: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.baseUrl}/telegram/send`, {
      message,
      botToken,
      channelId,
    });
  }

  parseResult(data: CampaignApiResponse): CampaignResult {
    const raw = data?.result;
    if (typeof raw === 'object' && raw !== null) return raw as CampaignResult;
    if (typeof raw !== 'string') return { overview: '' };

    try {
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      return JSON.parse(cleaned) as CampaignResult;
    } catch {
      return { title: 'Generated Campaign', overview: raw, raw };
    }
  }
}

@Injectable({ providedIn: 'root' })
export class CompetitorAnalysisService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '';

  analyze(payload: CompetitorAnalysisRequest): Observable<{ result: string | CompetitorAnalysisResult }> {
    return this.http.post<{ result: string | CompetitorAnalysisResult }>(
      `${this.baseUrl}/competitor-analysis`,
      payload
    );
  }

  parseResult(data: { result: string | CompetitorAnalysisResult }): CompetitorAnalysisResult {
    const raw = data?.result;
    if (typeof raw === 'object' && raw !== null) return raw as CompetitorAnalysisResult;
    if (typeof raw !== 'string') return { summary: '' };

    try {
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      return JSON.parse(cleaned) as CompetitorAnalysisResult;
    } catch {
      return { summary: raw, raw };
    }
  }
}
