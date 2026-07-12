import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CampaignService {

  // Use a relative URL so the same build works in two environments:
  //  - in dev: Angular dev server hits the API directly (CORS is enabled).
  //  - in Docker: nginx on the same origin reverse-proxies /api/* and the
  //    bare backend endpoints to the backend service.
  // If you need an absolute backend URL, replace '' with e.g.
  // 'http://localhost:3000' or use Angular environment files.
  private apiUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  generateCampaign(prompt: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/generate-campaign`, {
      prompt
    });
  }

  approveCampaign(campaignId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/campaigns/${campaignId}/approve`, {});
  }

  declineCampaign(campaignId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/campaigns/${campaignId}/decline`, {});
  }

  cancelCampaign(campaignId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/campaigns/${campaignId}/cancel`, {});
  }

}