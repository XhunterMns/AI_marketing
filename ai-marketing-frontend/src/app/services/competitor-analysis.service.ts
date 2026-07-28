import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CompetitorAnalysisService {

  constructor(private http: HttpClient) { }

  // See campaign.service.ts for why this is a relative URL.
  baseUrl = 'http://localhost:3000';
  competitorAnalysis(prompt: string): any {
    return this.http.post(`${this.baseUrl}/competitor-analysis`, { prompt });
  }
}
