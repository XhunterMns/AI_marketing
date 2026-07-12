import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CampaignService {

  private apiUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  generateCampaign(prompt: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/generate-campaign`, {
      prompt
    });
  }

  activateCampaign(campaignId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/activate-campaign`, {
      campaignId
    });
  }

  cancelCampaign(campaignId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/cancel-campaign`, {
      campaignId
    });
  }

}